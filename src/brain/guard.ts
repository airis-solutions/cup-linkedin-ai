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

/**
 * Compliance — the rules that actually carry legal weight.
 *
 * Until now these lived only in the model's briefing (knowledge.ts). That was fine while a
 * human approved every message, but it means nothing deterministic stopped a return promise
 * from going out. Robin is not a licensed adviser and this runs on his account, so these
 * belong in code.
 *
 * Bilingual, because the AI writes in German and English. A hit does NOT drop the message —
 * it forces human review (see persistOutbound), which is the right severity: a false
 * positive costs a wait, a false negative costs a regulator.
 */
interface ComplianceRule {
  rule: string;
  pattern: RegExp;
}

const COMPLIANCE_RULES: ComplianceRule[] = [
  {
    // Guarantees and impossible promises.
    rule: 'compliance-guarantee',
    pattern:
      /\b(guarantee\w*|risk[-\s]?free|can'?t lose|cannot lose|no risk|garantie\w*|garantiert\w*|risikofrei|kannst (du )?nichts verlieren|ohne risiko|sichere rendite)\b/i,
  },
  {
    // Promised multiples / beating the market.
    rule: 'compliance-return-promise',
    pattern:
      /\b(double your|triple your|10x your|beat the market|verdoppel\w*|verdreifach\w*|vervielfach\w*|schlägt den markt)\b/i,
  },
  {
    // Any quoted performance figure: "30% return", "20 % pro Monat", "3x in 6 months".
    rule: 'compliance-performance-figure',
    pattern:
      /\d+\s?(%|percent|prozent)\s*(\w+\s+){0,3}(return|profit|gain|gains|roi|rendite|gewinn|plus|monat|month|jahr|year|woche|week)|\b\d+x\b\s*(\w+\s+){0,2}(in|within|innerhalb)\b/i,
  },
  {
    // Price / cost / contract length — belongs on the call, never in a DM.
    rule: 'compliance-pricing',
    pattern:
      /\b(costs? (only |just |about |around )?[€$£]?\d+|price is|pricing is|per month it|[€$£]\s?\d[\d.,]*\s?(\/|per |pro |im )\s?(mo|month|monat)|kostet( nur| etwa| rund)? [€$£]?\d+|monatlich[e]? (gebühr|kosten|beitrag)|mindestlaufzeit|vertragslaufzeit)\b/i,
  },
  {
    // Predictions about price or market direction.
    rule: 'compliance-prediction',
    pattern:
      /\b(will (hit|reach|go to|pump|moon|explode|crash)|is going to (hit|reach|pump|moon|crash)|price target|wird (steigen|fallen|explodieren|abgehen|crashen)|geht (hoch|runter|durch die decke)|bull ?run (kommt|incoming))\b/i,
  },
  {
    // Personal investment advice on their holdings.
    rule: 'compliance-advice',
    pattern:
      /\b(you should (buy|sell|hold|invest|put)|i'?d (buy|sell)|my advice is|kauf(e|en sie)? (dir |jetzt )?(btc|eth|sol|bitcoin|ethereum)|verkauf(e|en sie)? (dein|deine|ihre)|solltest du (kaufen|verkaufen)|leg (dein|ihr) geld)\b/i,
  },
];

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

  // Compliance — the rules with legal weight. Always error level.
  for (const { rule, pattern } of COMPLIANCE_RULES) {
    const m = pattern.exec(text);
    if (m) violations.push({ rule, severity: 'error', match: m[0] });
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

/** Did this message trip a compliance rule (as opposed to a style rule)? */
export function hasComplianceViolation(result: GuardResult): boolean {
  return result.violations.some((v) => v.rule.startsWith('compliance-'));
}
