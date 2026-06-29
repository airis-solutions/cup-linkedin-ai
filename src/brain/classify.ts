/**
 * Understanding layer: turns a prospect's inbound DM into structured data
 * (intent + extracted qualification fields + a short Robin-voice read-back).
 *
 * Runs on the fast router model (Haiku). The model never writes the outbound copy —
 * the locked templates do that. It only classifies and extracts, plus a tight read-back
 * fragment that the guard re-checks before sending.
 */
import { z } from 'zod';
import { callClaude } from '../lib/claude.js';
import { logger } from '../lib/logger.js';
import type { FlowNode, InboundUnderstanding, Qualification } from './types.js';

const EXPERIENCE_LEVELS = ['Less than 1 year', '1 to 3 years', '3 to 5 years', '5+ years'] as const;
const PORTFOLIO_VALUES = [
  "I don't hold crypto yet",
  'Under $25,000',
  '$25,000 - $50,000',
  '$50,000 - $100,000',
  '$100,000 - $250,000',
  '$250,000 - $500,000',
  '$500,000 - $1M',
  'Over $1M',
] as const;

const ResponseSchema = z.object({
  intent: z.enum([
    'agree',
    'answer',
    'wants_price',
    'hesitant',
    'not_interested',
    'questions_vocab',
    'content_question',
    'not_a_prospect',
    'other',
  ]),
  language: z.enum(['de', 'en']).optional(),
  readback: z.string().max(160).optional(),
  experienceLevel: z.enum(EXPERIENCE_LEVELS).optional(),
  biggestChallenge: z.string().max(400).optional(),
  desiredOutcome: z.string().max(400).optional(),
  portfolioValue: z.enum(PORTFOLIO_VALUES).optional(),
  holdsAssets: z.boolean().optional(),
  email: z.string().max(160).optional(),
  phone: z.string().max(60).optional(),
  notes: z.string().max(400).optional(),
});

const NODE_TASK: Partial<Record<FlowNode, string>> = {
  welcome: 'They were asked to go through a few qualification questions. Did they agree, ask about price, or decline?',
  objection_price: 'They were nudged back to the screen. Did they agree, or insist on price only?',
  q1: `Q1 was "how long have you been investing in crypto?". Map their answer to experienceLevel: one of ${EXPERIENCE_LEVELS.join(' | ')}.`,
  re_engage: `They were re-asked Q1 ("how long in crypto"). Map to experienceLevel: ${EXPERIENCE_LEVELS.join(' | ')}.`,
  q2: 'Q2 asked the main thing they want to improve in managing their portfolio. Put a concise version in biggestChallenge.',
  q3: 'Q3 asked why that specifically. Put a concise version in desiredOutcome.',
  q4: `Q4 asked roughly how much they have deployed in crypto. Map to portfolioValue: ${PORTFOLIO_VALUES.join(' | ')}, and set holdsAssets. If they push back on the word "deployed", intent = questions_vocab.`,
  pitch_call: 'They were pitched a call. Did they agree, express hesitation, or decline?',
  hesitant: 'They were reassured about the call. Did they agree, stay hesitant, or decline?',
  ask_email: 'They were asked for their email for the calendar invite. Put any email in "email" and any phone number in "phone". intent = answer if they provided contact details.',
};

function systemPrompt(node: FlowNode, priorAnswer?: string): string {
  return [
    'You classify a prospect\'s reply in a LinkedIn qualification chat and extract structured fields. Output JSON only, no prose.',
    '',
    `Current step: ${node}.`,
    NODE_TASK[node] ?? 'Classify the intent of their reply.',
    '',
    'IMPORTANT first: is this even a potential CGP customer? If the message is someone selling something TO us, an agency/partnership/collab pitch, a recruiter, an affiliate/"prop firm"/"funded account" offer, or spam — i.e. NOT a person who might become a CGP client — set intent = "not_a_prospect" (this overrides every other intent). Genuine prospects asking about CGP are NOT this.',
    priorAnswer ? `Their previous answer (for the read-back): "${priorAnswer}"` : '',
    '',
    'Also detect "language": "de" if they wrote in German, otherwise "en".',
    '',
    'Also produce "readback": a SHORT acknowledgement of what they just said, in Robin\'s voice.',
    'Read-back rules: under 14 words. Acknowledge, never evaluate (no "great", "awesome", "perfect"). No emoji. No em dashes. No "I\'d love to". Sound human, mix one casual + one precise beat. Example: "Alright got it, 2 years since you started looking into crypto."',
    '',
    'Return exactly this JSON shape (omit fields you cannot determine):',
    '{"intent": "...", "language": "de|en", "readback": "...", "experienceLevel": "...", "biggestChallenge": "...", "desiredOutcome": "...", "portfolioValue": "...", "holdsAssets": true, "notes": "..."}',
  ]
    .filter(Boolean)
    .join('\n');
}

function extractText(content: { type: string; text?: string }[]): string {
  return content
    .filter((b) => b.type === 'text')
    .map((b) => b.text ?? '')
    .join('')
    .trim();
}

function firstJsonObject(text: string): string | null {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) return null;
  return text.slice(start, end + 1);
}

export interface ClassifyParams {
  node: FlowNode;
  inboundText: string;
  /** The prospect's previous answer, used to ground the read-back (mainly for Q2). */
  priorAnswer?: string;
}

/** Classify + extract. Falls back to intent 'other' if the model output can't be parsed. */
export async function classifyInbound(params: ClassifyParams): Promise<InboundUnderstanding> {
  const { node, inboundText, priorAnswer } = params;

  const response = await callClaude({
    role: 'router',
    temperature: 0,
    maxTokens: 400,
    system: systemPrompt(node, priorAnswer),
    messages: [{ role: 'user', content: inboundText }],
    metadata: { step: node },
  });

  const raw = extractText(response.content as { type: string; text?: string }[]);
  const json = firstJsonObject(raw);
  if (!json) {
    logger.warn({ node, raw }, 'classify.no_json');
    return { intent: 'other', notes: 'unparseable model output' };
  }

  let parsedUnknown: unknown;
  try {
    parsedUnknown = JSON.parse(json);
  } catch {
    logger.warn({ node, json }, 'classify.json_parse_failed');
    return { intent: 'other', notes: 'invalid json' };
  }

  const result = ResponseSchema.safeParse(parsedUnknown);
  if (!result.success) {
    logger.warn({ node, issues: result.error.issues }, 'classify.schema_failed');
    return { intent: 'other', notes: 'schema mismatch' };
  }

  const d = result.data;
  const extracted: Partial<Qualification> = {};
  if (d.experienceLevel) extracted.experienceLevel = d.experienceLevel;
  if (d.biggestChallenge) extracted.biggestChallenge = d.biggestChallenge;
  if (d.desiredOutcome) extracted.desiredOutcome = d.desiredOutcome;
  if (d.portfolioValue) extracted.portfolioValue = d.portfolioValue;
  if (typeof d.holdsAssets === 'boolean') extracted.holdsAssets = d.holdsAssets;

  const contact = d.email || d.phone ? { email: d.email, phone: d.phone } : undefined;

  return {
    intent: d.intent,
    language: d.language,
    readback: d.readback,
    extracted: Object.keys(extracted).length ? extracted : undefined,
    contact,
    notes: d.notes,
  };
}
