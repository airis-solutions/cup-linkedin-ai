/**
 * The conversation orchestrator: the spine that runs one turn end to end.
 *
 *   inbound DM ──▶ classify (understand) ──▶ engine.advance (decide) ──▶ guard (safety)
 *               ──▶ persist outbound as pending_hitl ──▶ update lead state + events
 *
 * It depends only on the Repository interface and an injected classifier, so it runs
 * fully in tests with an in-memory store and a stubbed classifier (no network, no LinkedIn).
 * Actually sending an approved message is the channel layer's job (next build step).
 */
import { advance, onSilence, opener } from './brain/engine.js';
import { scanMessage } from './brain/guard.js';
import type { ClassifyParams } from './brain/classify.js';
import type { BrainState, FlowVars, InboundUnderstanding } from './brain/types.js';
import type { LeadRecord, MessageRecord, Repository } from './store/repository.js';

export interface OrchestratorDeps {
  repo: Repository;
  classify: (params: ClassifyParams) => Promise<InboundUnderstanding>;
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
): Promise<MessageRecord | undefined> {
  let draft: MessageRecord | undefined;
  if (decision.reply) {
    draft = await persistOutbound(deps, lead.id, decision.reply, decision.nextNode);
  }

  const qualification = { ...lead.qualification, ...decision.qualificationPatch };
  lead.qualification = qualification;
  if (decision.contactPatch?.email) lead.email = decision.contactPatch.email;
  if (decision.contactPatch?.phone) lead.phone = decision.contactPatch.phone;
  lead.brain = {
    node: decision.nextNode,
    qualification,
    ...nextCounters(lead.brain, decision.nextNode),
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
  const draft = await commitDecision(deps, lead, decision);
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

  await deps.repo.appendMessage({
    leadId,
    direction: 'inbound',
    status: 'received',
    body: inboundText,
  });
  await deps.repo.appendEvent({ leadId, kind: 'reply_received', payload: { node: lead.brain.node } });

  const understanding = await deps.classify({ node: lead.brain.node, inboundText });
  const decision = advance(lead.brain, understanding, deps.vars(lead));
  const draft = await commitDecision(deps, lead, decision);

  return { understanding, draft, leadId, node: decision.nextNode };
}

/** Drive a silence timeout (value-touch / booking reminder / park). */
export async function handleSilence(deps: OrchestratorDeps, leadId: string): Promise<TurnResult> {
  const lead = await deps.repo.getLead(leadId);
  if (!lead) throw new Error(`lead not found: ${leadId}`);

  const decision = onSilence(lead.brain, deps.vars(lead));
  const draft = await commitDecision(deps, lead, decision);
  return { draft, leadId, node: decision.nextNode };
}
