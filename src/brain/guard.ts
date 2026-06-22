/**
 * Pre-send guard: scans an outbound message against the banned-phrases reference
 * (docs/business/personal-voice/banned-phrases.md). Pure and synchronous so it can run
 * on every message before it leaves the system, and is fully unit-testable.
 *
 * This is a safety net, not the author. Fixed copy should always pass; the guard mainly
 * protects the model-generated read-back fragments (Q2 / Q4 swap).
 */

export type Severity = 'error' | 'warn';

export interface GuardViolation {
  rule: string;
  severity: Severity;
  match: string;
}

export interface GuardResult {
  ok: boolean; // false if any error-level violation
  violations: GuardViolation[];
}

/** Section 1.1 — AI-writing tell words (high-signal subset; case-insensitive, word-boundary). */
const BANNED_WORDS = [
  'delve',
  'moreover',
  'furthermore',
  'additionally',
  'crucial',
  'paramount',
  'pivotal',
  'comprehensive',
  'robust',
  'nuanced',
  'multifaceted',
  'tapestry',
  'leverage',
  'facilitate',
  'harness',
  'unleash',
  'navigate',
  'landscape',
  'embark',
  'foster',
  'underscore',
  'streamline',
  'groundbreaking',
  'revolutionary',
  'resonate',
  'illuminate',
  'seamless',
  'elevate',
  'testament',
  'meticulously',
  'intricate',
  'holistic',
  'showcase',
  'enhance',
  'unparalleled',
  'cutting-edge',
  'game-changer',
  'realm',
  'endeavour',
];

/** Layer 2 — sales-speak / low-status phrases (case-insensitive substring). */
const BANNED_PHRASES = [
  "i'd love to",
  'just following up',
  'just checking in',
  'circling back',
  'bumping this',
  'did you see my last message',
  'still interested?',
  'hope this finds you well',
  'sorry to bother you',
  'if you want',
  "if you're open to",
  'would you be interested in',
  'act now',
  'limited-time offer',
  "don't miss out",
  'last chance',
  'to the moon',
  'diamond hands',
  'ape in',
];

/** Layer 2.1 — evaluation words (banned with exclamation; we flag the word regardless). */
const EVALUATION_WORDS = ['great', 'awesome', 'perfect', 'amazing', 'wow', 'excellent', 'fantastic'];

const EMOJI = /\p{Extended_Pictographic}/u;

export function scanMessage(text: string): GuardResult {
  const violations: GuardViolation[] = [];
  const lower = text.toLowerCase();

  // Em dash — zero tolerance.
  if (text.includes('—')) {
    violations.push({ rule: 'em-dash', severity: 'error', match: '—' });
  }

  // Banned AI-tell words (word boundary).
  for (const word of BANNED_WORDS) {
    const re = new RegExp(`\\b${word.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}\\b`, 'i');
    const m = re.exec(text);
    if (m) violations.push({ rule: 'banned-word', severity: 'error', match: m[0] });
  }

  // Banned sales/chasing/permission phrases.
  for (const phrase of BANNED_PHRASES) {
    if (lower.includes(phrase)) {
      violations.push({ rule: 'banned-phrase', severity: 'error', match: phrase });
    }
  }

  // Evaluation words with exclamation ("Great!", "Awesome!", ...).
  for (const w of EVALUATION_WORDS) {
    const re = new RegExp(`\\b${w}\\b\\s*!`, 'i');
    const m = re.exec(text);
    if (m) violations.push({ rule: 'evaluation-word', severity: 'error', match: m[0] });
  }

  // Emoji — banned on LinkedIn.
  if (EMOJI.test(text)) {
    violations.push({ rule: 'emoji', severity: 'error', match: 'emoji' });
  }

  // "Not X" parallel-structure: sentence starting with "Not" within 5 words then a period/comma.
  const notPattern = /(^|[.!?]\s+)Not\b[^.,!?]{0,40}[.,]/;
  if (notPattern.test(text)) {
    violations.push({ rule: 'not-parallel', severity: 'warn', match: 'Not ...,' });
  }

  // Exclamation marks — warn (rare functional exceptions allowed).
  if (text.includes('!')) {
    violations.push({ rule: 'exclamation', severity: 'warn', match: '!' });
  }

  return { ok: !violations.some((v) => v.severity === 'error'), violations };
}
