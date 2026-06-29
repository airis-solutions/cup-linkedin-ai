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

  // Transactional steps carry a REQUIRED action — be precise, not loose, here.
  if (p.node === 'ask_email') {
    return [
      `Conversation so far:\n${transcript(p.history)}`,
      p.inbound ? `\nTheir latest message: "${p.inbound}"` : '',
      `\nThey just agreed to the call. Right now you need ONE thing: their email address for the calendar invite. Ask for it directly as Robin, in ${lang}, in one short line.`,
      `Do NOT send or mention any link yet, and never write a placeholder. The booking link only goes out AFTER they give their email.`,
      avoid ? `\nYour previous attempt broke a rule. Avoid: ${avoid}. Rewrite cleanly.` : '',
      `\nOutput only the message text, nothing else.`,
    ]
      .filter(Boolean)
      .join('\n');
  }
  if (p.node === 'send_link') {
    return [
      `Conversation so far:\n${transcript(p.history)}`,
      `\nSend them the booking link as Robin, in ${lang}, matching this approved message:`,
      `"""${p.canonical}"""`,
      `You MUST include the exact URL from it verbatim. NEVER replace it with a placeholder like [link] or [Kalender-Link]. Keep it to one or two short lines.`,
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
    `Move toward that the way a person naturally would. Usually that means asking the one thing you still want to know, or nudging toward a call — but you don't have to fire it as a stiff question every message. Being conversational and flexible is good. Keep any URL exactly as written, and never write a placeholder like [link] or [name] — only ever use real values.`,
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

/** Content problems the guard can't see: invented placeholders or a dropped booking URL. */
function contentIssues(text: string, canonical: string): string[] {
  const issues: string[] = [];
  if (/\[[^\]\n]{2,}\]/.test(text)) {
    issues.push('a bracketed placeholder — never write [like this], only real values');
  }
  for (const url of canonical.match(/https?:\/\/\S+/g) ?? []) {
    if (!text.includes(url)) issues.push(`the exact link ${url} (it must appear verbatim)`);
  }
  return issues;
}

/** The model call, injectable so the guard/fallback logic is testable offline. */
export type ClaudeCaller = (params: ClaudeCallParams) => Promise<Anthropic.Message>;

/** Generate Robin's reply for one turn. Always returns a guard-clean, placeholder-free message. */
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

    const issues = contentIssues(text, p.canonical);
    const guard = scanMessage(text);
    if (issues.length === 0 && guard.ok) return text;

    const guardIssues = guard.violations
      .filter((v) => v.severity === 'error')
      .map((v) => `${v.rule} (${v.match})`);
    avoid = [...issues, ...guardIssues].join('; ');
    logger.warn({ node: p.node, attempt, problems: avoid }, 'voice.retry');
  }

  // Both attempts failed (guard, placeholder, dropped link, or empty) — fall back to the
  // approved copy, which is always clean and carries the real URL.
  logger.warn({ node: p.node }, 'voice.fallback_to_canonical');
  return p.canonical;
}
