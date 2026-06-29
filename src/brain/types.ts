/**
 * Domain types for the qualification brain.
 *
 * The qualification fields mirror CGP's EXISTING GoHighLevel custom fields (confirmed by
 * Fabi 2026-06-18) so the one-way sync to GHL is a direct mapping, not a translation.
 * Option strings match GHL's dropdown values verbatim — do not rename.
 */

/** GHL "Experience Level" dropdown. */
export type ExperienceLevel = 'Less than 1 year' | '1 to 3 years' | '3 to 5 years' | '5+ years';

/** GHL "Portfolio Value" dropdown (verbatim option strings). */
export type PortfolioValue =
  | "I don't hold crypto yet"
  | 'Under $25,000'
  | '$25,000 - $50,000'
  | '$50,000 - $100,000'
  | '$100,000 - $250,000'
  | '$250,000 - $500,000'
  | '$500,000 - $1M'
  | 'Over $1M';

/** GHL "Qualification Status" dropdown. The brain sets this; Robin reviews. */
export type QualificationStatus = 'Not Reviewed' | 'Qualified' | 'Not Qualified' | 'Needs Manual Review';

/** Internal fit tier from the flow's post-Q4 classification table. */
export type FitTier = 'strong' | 'borderline' | 'weak' | 'disqualified';

/**
 * The four qualification answers + derived status, mapped to GHL fields:
 * - Q1 experience      -> Experience Level
 * - Q2 what to improve -> Biggest Challenge
 * - Q3 why that        -> Desired Outcome
 * - Q4 capital         -> Portfolio Value (+ Holds Assets)
 */
export interface Qualification {
  experienceLevel?: ExperienceLevel; // Q1 -> GHL Experience Level
  biggestChallenge?: string; // Q2 -> GHL Biggest Challenge
  desiredOutcome?: string; // Q3 -> GHL Desired Outcome
  portfolioValue?: PortfolioValue; // Q4 -> GHL Portfolio Value
  holdsAssets?: boolean; // Q4 -> GHL Holds Assets
  status: QualificationStatus;
  fit?: FitTier;
  /** Soft signal: prospect needed "deployed" swapped to "invested" -> less experienced. */
  deployedSwappedToInvested?: boolean;
}

/** Nodes of the canonical qualification flow (see docs/business/dm-flows/qualification-flow.md). */
export type FlowNode =
  | 'welcome'
  | 'objection_price'
  | 'q1'
  | 'q2'
  | 'q3'
  | 'q4'
  | 'pitch_call'
  | 'hesitant'
  | 'ask_email'
  | 'send_link'
  | 'booking_reminder'
  | 'value_touch'
  | 're_engage'
  | 'soft_close_low_capital'
  | 'disqualified'
  | 'not_prospect'
  | 'booked'
  | 'parked';

/** DB funnel_stage enum (mirrors supabase/migrations/0001_init.sql). */
export type FunnelStage =
  | 'new'
  | 'opener_sent'
  | 'qualifying'
  | 'qualified'
  | 'booking_offered'
  | 'booked'
  | 'disqualified'
  | 'parked'
  | 'do_not_contact';

/** What the prospect's latest inbound message means, in the current node's context. */
export type ReplyIntent =
  | 'agree' // agrees to proceed / answers yes
  | 'answer' // substantive answer to the current question
  | 'wants_price' // asks price/signup before the screen
  | 'hesitant' // unease about the call
  | 'not_interested' // firm no / disengage
  | 'questions_vocab' // questions the word "deployed"
  | 'content_question' // asks something about the shared content/value
  | 'not_a_prospect' // not a potential customer at all (vendor/agency pitch, recruiter, spam)
  | 'other';

/** Conversation language. Detected from the prospect's inbound; the AI mirrors it. */
export type Language = 'de' | 'en';

/** Contact details collected in-chat (email captured before booking; phone optional/A-B). */
export interface ContactDetails {
  email?: string;
  phone?: string;
}

/** Output of the understanding layer (Haiku router). Pure data, no side effects. */
export interface InboundUnderstanding {
  intent: ReplyIntent;
  /** Language the prospect wrote in. Drives the reply language. */
  language?: Language;
  /** Short Robin-voice read-back of their answer (for Q2 / the Q4 vocab swap). */
  readback?: string;
  /** Structured fields extracted from this answer, if any. */
  extracted?: Partial<Qualification>;
  /** Contact details detected in the message (email / phone). */
  contact?: ContactDetails;
  /** Free-text rationale for logging/manual review. */
  notes?: string;
}

/** Brain state persisted per conversation (stored in leads.qualification + conversation). */
export interface BrainState {
  node: FlowNode;
  qualification: Qualification;
  valueTouchCount: number;
  hesitantExchanges: number;
  objectionPriceCount: number;
  /** True once the warm opener (welcome) has been sent — so an inbound-first lead gets
   * the opener before the screen, and a Robin-initiated lead does not get it twice. */
  openerSent: boolean;
  /** Sticky conversation language; set from the first inbound, mirrors the prospect. */
  language?: Language;
}

/** Variables filled into canonical copy. */
export interface FlowVars {
  firstName: string;
  bookingLink: string;
  /** A piece of value (walkthrough link) for value_touch. */
  walkthroughLink: string;
}

export type BrainEventKind =
  | 'qualification_advanced'
  | 'objection_handled'
  | 'booking_link_sent'
  | 'lead_parked'
  | 'lead_disqualified'
  | 'flagged_non_prospect'
  | 'hitl_requested';

/** The brain's decision for one turn. Pure: no I/O, fully testable. */
export interface BrainDecision {
  /** Outbound message body (canonical copy, variables filled). Undefined = no auto-reply. */
  reply?: string;
  nextNode: FlowNode;
  nextStage: FunnelStage;
  qualificationPatch: Partial<Qualification>;
  /** Contact details to persist on the lead (e.g. email captured before booking). */
  contactPatch?: ContactDetails;
  events: BrainEventKind[];
  /** Borderline capital etc. -> route to a human before/after sending. */
  flagForHuman?: boolean;
  /** If the lead is parked/waiting, when to next act. */
  parkUntilHours?: number;
}

export function defaultBrainState(): BrainState {
  return {
    node: 'welcome',
    qualification: { status: 'Not Reviewed' },
    valueTouchCount: 0,
    hesitantExchanges: 0,
    objectionPriceCount: 0,
    openerSent: false,
  };
}
