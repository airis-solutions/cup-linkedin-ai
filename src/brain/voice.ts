/**
 * The voice layer: turns the engine's approved reference line into a natural, bilingual
 * message written as Robin. The state machine (engine.ts) decides WHAT the next message
 * must accomplish (the locked `canonical` line); this layer decides HOW Robin would
 * actually say it — in the prospect's language, register-mixed, human.
 *
 * Safety: the generated text is self-checked against the guard. If it trips a banned-phrase
 * rule, we retry once with the violations fed back, then fall back to the canonical copy
 * (which is always guard-clean). So a draft is never worse than the approved line.
 *
 * It is an injected dependency on the orchestrator, so tests run offline with a stub.
 */
import { callClaude, asCacheableSystem, type ClaudeCallParams } from '../lib/claude.js';
import type Anthropic from '@anthropic-ai/sdk';
import { scanMessage } from './guard.js';
import { ROBIN_BRIEFING } from './knowledge.js';
import { logger } from '../lib/logger.js';
import type { FlowNode, Language, ReplyIntent } from './types.js';

export interface GenerateTurn {
  direction: 'inbound' | 'outbound';
  body: string;
}

export interface GenerateParams {
  /** Current flow node — context for what this message is doing. */
  node: FlowNode;
  /** The engine's approved reference line: the exact meaning + single question/CTA to convey. */
  canonical: string;
  /** Language to write in (mirrors the prospect). */
  language: Language;
  firstName: string;
  /** Recent conversation turns, oldest first, for natural context + read-backs. */
  history: GenerateTurn[];
  /** The prospect's latest inbound message, if this turn is a reply. */
  inbound?: string;
  intent?: ReplyIntent;
}

export type GenerateReply = (p: GenerateParams) => Promise<string>;

function transcript(history: GenerateTurn[]): string {
  if (history.length === 0) return '(no prior messages)';
  return history
    .slice(-10)
    .map((t) => `${t.direction === 'inbound' ? 'Them' : 'You (Robin)'}: ${t.body}`)
    .join('\n');
}

function instruction(p: GenerateParams, avoid?: string): string {
  const lang = p.language === 'de' ? 'German (informal "du")' : 'English';

  // Non-prospect (vendor/agency/recruiter/spam): a brief, final, polite decline — never a
  // call invite, never a question, never qualification.
  if (p.node === 'not_prospect') {
    return [
      `Conversation so far:\n${transcript(p.history)}`,
      p.inbound ? `\nTheir latest message: "${p.inbound}"` : '',
      `\nThis person is NOT a potential customer — they are pitching or spamming you. Reply as Robin in ${lang}: politely and briefly decline, matching the intent of: """${p.canonical}""".`,
      `One or two lines, warm but final. Do NOT invite them to a call, do NOT ask any question, do NOT try to qualify them. No emoji, no em dashes, no exclamation marks.`,
      avoid ? `\nYour previous attempt broke a rule. Avoid: ${avoid}. Rewrite cleanly.` : '',
      `\nOutput only the message text, nothing else.`,
    ]
      .filter(Boolean)
      .join('\n');
  }

  const askedAboutCgp = p.intent === 'content_question';
  return [
    `Conversation so far:\n${transcript(p.history)}`,
    p.inbound ? `\nTheir latest message: "${p.inbound}"` : '',
    `\nReply as Robin, in ${lang} — a real person texting on LinkedIn, not a script. Sound human and relaxed, and genuinely respond to what they just said.`,
    askedAboutCgp
      ? `They asked a real question about CGP. Answer it honestly first, in one or two plain sentences from what you actually know (no invented numbers, deep detail belongs on the call). Don't dodge it.`
      : '',
    `Where you're steering this conversation right now (your intent for this reply, NOT a line to recite):`,
    `"""${p.canonical}"""`,
    `Move toward that the way a person naturally would. Usually that means asking the one thing you still want to know, or nudging toward a call — but you don't have to fire it as a stiff question every message. Being conversational and flexible is good. Keep any URL exactly as written.`,
    `Your north star is getting them on a call with you. The things worth knowing (their crypto experience, what they want to improve and why, their capital level) you gather naturally as it comes up, never as an interrogation. Qualifying can keep happening loosely, even around the call, so never let it make you sound like a form.`,
    `Keep it short (a line or two). Mix one formal and one casual beat. No emoji, no em dashes, no exclamation marks.`,
    avoid ? `\nYour previous attempt broke a rule. Avoid: ${avoid}. Rewrite cleanly.` : '',
    `\nOutput only the message text, nothing else.`,
  ]
    .filter(Boolean)
    .join('\n');
}

function extractText(content: { type: string; text?: string }[]): string {
  return content
    .filter((b) => b.type === 'text')
    .map((b) => b.text ?? '')
    .join('')
    .trim()
    .replace(/^["']|["']$/g, '')
    .trim();
}

const SYSTEM = asCacheableSystem(ROBIN_BRIEFING);

/** The model call, injectable so the guard/fallback logic is testable offline. */
export type ClaudeCaller = (params: ClaudeCallParams) => Promise<Anthropic.Message>;

/** Generate Robin's reply for one turn. Always returns a guard-clean message. */
export async function generateReply(p: GenerateParams, call: ClaudeCaller = callClaude): Promise<string> {
  let avoid: string | undefined;

  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await call({
      role: 'brain',
      maxTokens: 400,
      system: SYSTEM,
      messages: [{ role: 'user', content: instruction(p, avoid) }],
      metadata: { step: p.node, lang: p.language },
    });

    const text = extractText(response.content as { type: string; text?: string }[]);
    if (!text) break;

    const guard = scanMessage(text);
    if (guard.ok) return text;

    avoid = guard.violations
      .filter((v) => v.severity === 'error')
      .map((v) => `${v.rule} (${v.match})`)
      .join(', ');
    logger.warn({ node: p.node, attempt, violations: avoid }, 'voice.guard_retry');
  }

  // Both attempts failed the guard (or produced nothing) — fall back to the approved copy.
  logger.warn({ node: p.node }, 'voice.fallback_to_canonical');
  return p.canonical;
}
