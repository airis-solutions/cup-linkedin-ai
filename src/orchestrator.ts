/**
 * The conversation orchestrator: the spine that runs one turn end to end.
 *
 *   inbound DM ──▶ classify (understand + detect language) ──▶ engine.advance (decide WHAT)
 *               ──▶ voice.generate (write it as Robin, in their language) ──▶ guard (safety)
 *               ──▶ persist outbound as pending_hitl ──▶ update lead state + events
 *
 * The engine stays a pure state machine (the sales strategy + qualification data). The voice
 * layer turns each approved reference line into a natural, bilingual message. Both are
 * injected, so the orchestrator runs fully in tests with an in-memory store, a stubbed
 * classifier, and an identity voice stub (no network, no LinkedIn, no Claude).
 */
import { advance, onSilence, opener } from './brain/engine.js';
import { scanMessage } from './brain/guard.js';
import type { ClassifyParams } from './brain/classify.js';
import type { GenerateReply, GenerateTurn } from './brain/voice.js';
import type { BrainState, FlowVars, InboundUnderstanding, Language, ReplyIntent } from './brain/types.js';
import type { LeadRecord, MessageRecord, Repository } from './store/repository.js';

export interface OrchestratorDeps {
  repo: Repository;
  classify: (params: ClassifyParams) => Promise<InboundUnderstanding>;
  /** Writes the engine's approved line as a natural Robin message in the prospect's language. */
  generate: GenerateReply;
  vars: (lead: LeadRecord) => FlowVars;
  /** When true, outbound messages are stored as pending_hitl and wait for a human approve. */
  hitlRequired: boolean;
}

export interface TurnResult {
  understanding?: InboundUnderstanding;
  draft?: MessageRecord;
  leadId: string;
  node: string;
}

/** Per-turn context for the voice layer. */
interface TurnContext {
  language: Language;
  history: GenerateTurn[];
  inbound?: string;
  intent?: ReplyIntent;
}

function nextCounters(prev: BrainState, nextNode: BrainState['node']): Pick<
  BrainState,
  'hesitantExchanges' | 'objectionPriceCount' | 'valueTouchCount'
> {
  return {
    hesitantExchanges: nextNode === 'hesitant' ? prev.hesitantExchanges + 1 : 0,
    objectionPriceCount:
      nextNode === 'objection_price' ? prev.objectionPriceCount + 1 : prev.objectionPriceCount,
    valueTouchCount: nextNode === 'value_touch' ? prev.valueTouchCount + 1 : prev.valueTouchCount,
  };
}

/** Real conversation history (what was actually sent + what they wrote) for natural context. */
async function loadHistory(repo: Repository, leadId: string): Promise<GenerateTurn[]> {
  const msgs = await repo.messagesForLead(leadId);
  return msgs
    .filter((m) => m.direction === 'inbound' || m.status === 'sent')
    .map((m) => ({ direction: m.direction, body: m.body }));
}

async function persistOutbound(
  deps: OrchestratorDeps,
  leadId: string,
  reply: string,
  node: string,
): Promise<MessageRecord> {
  const guard = scanMessage(reply);
  return deps.repo.appendMessage({
    leadId,
    direction: 'outbound',
    // A guard failure forces human review even if HITL is otherwise off.
    status: deps.hitlRequired || !guard.ok ? 'pending_hitl' : 'approved',
    body: reply,
    node,
    guardFlagged: !guard.ok,
  });
}

async function commitDecision(
  deps: OrchestratorDeps,
  lead: LeadRecord,
  decision: ReturnType<typeof advance>,
  ctx: TurnContext,
): Promise<MessageRecord | undefined> {
  let draft: MessageRecord | undefined;
  if (decision.reply) {
    const text = await deps.generate({
      node: decision.nextNode,
      canonical: decision.reply,
      language: ctx.language,
      firstName: deps.vars(lead).firstName,
      history: ctx.history,
      inbound: ctx.inbound,
      intent: ctx.intent,
    });
    draft = await persistOutbound(deps, lead.id, text, decision.nextNode);
  }

  const qualification = { ...lead.qualification, ...decision.qualificationPatch };
  lead.qualification = qualification;
  if (decision.contactPatch?.email) lead.email = decision.contactPatch.email;
  if (decision.contactPatch?.phone) lead.phone = decision.contactPatch.phone;
  lead.brain = {
    node: decision.nextNode,
    qualification,
    ...nextCounters(lead.brain, decision.nextNode),
    // The opener is "sent" once the first outbound goes out (the welcome via welcome-first).
    openerSent: lead.brain.openerSent || Boolean(draft),
    language: ctx.language,
  };
  lead.stage = decision.nextStage;

  for (const kind of decision.events) {
    await deps.repo.appendEvent({ leadId: lead.id, kind, payload: { node: decision.nextNode } });
  }
  if (decision.flagForHuman) {
    await deps.repo.appendEvent({ leadId: lead.id, kind: 'hitl_requested', payload: { reason: 'borderline' } });
  }
  await deps.repo.saveLead(lead);
  return draft;
}

/** First outbound to a lead (cold open / positive opener reply). */
export async function handleOpener(deps: OrchestratorDeps, leadId: string): Promise<TurnResult> {
  const lead = await deps.repo.getLead(leadId);
  if (!lead) throw new Error(`lead not found: ${leadId}`);

  const decision = opener(deps.vars(lead));
  const ctx: TurnContext = { language: lead.brain.language ?? 'en', history: await loadHistory(deps.repo, leadId) };
  const draft = await commitDecision(deps, lead, decision, ctx);
  await deps.repo.appendEvent({ leadId, kind: 'opener_sent', payload: {} });
  return { draft, leadId, node: decision.nextNode };
}

/** Process one inbound message from the lead. */
export async function handleInbound(
  deps: OrchestratorDeps,
  leadId: string,
  inboundText: string,
): Promise<TurnResult> {
  const lead = await deps.repo.getLead(leadId);
  if (!lead) throw new Error(`lead not found: ${leadId}`);

  // History BEFORE recording the new inbound (it is passed separately as ctx.inbound).
  const history = await loadHistory(deps.repo, leadId);

  await deps.repo.appendMessage({ leadId, direction: 'inbound', status: 'received', body: inboundText });
  await deps.repo.appendEvent({ leadId, kind: 'reply_received', payload: { node: lead.brain.node } });

  const understanding = await deps.classify({ node: lead.brain.node, inboundText });
  const language: Language = understanding.language ?? lead.brain.language ?? 'en';

  // Welcome-first: a lead who messaged us cold (no opener sent yet) gets the warm opener
  // before the qualification screen — never a question fired straight at them.
  const decision = lead.brain.openerSent
    ? advance(lead.brain, understanding, deps.vars(lead))
    : opener(deps.vars(lead));

  const ctx: TurnContext = { language, history, inbound: inboundText, intent: understanding.intent };
  const draft = await commitDecision(deps, lead, decision, ctx);

  return { understanding, draft, leadId, node: decision.nextNode };
}

/** Drive a silence timeout (value-touch / booking reminder / park). */
export async function handleSilence(deps: OrchestratorDeps, leadId: string): Promise<TurnResult> {
  const lead = await deps.repo.getLead(leadId);
  if (!lead) throw new Error(`lead not found: ${leadId}`);

  const decision = onSilence(lead.brain, deps.vars(lead));
  const ctx: TurnContext = { language: lead.brain.language ?? 'en', history: await loadHistory(deps.repo, leadId) };
  const draft = await commitDecision(deps, lead, decision, ctx);
  return { draft, leadId, node: decision.nextNode };
}
