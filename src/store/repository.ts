/**
 * Storage contract for the operational state of leads + conversations.
 *
 * The orchestrator talks to this interface only, so the engine stays testable with an
 * in-memory store (store/memory.ts) and the production Supabase implementation can be
 * swapped in later without touching the brain. Mirrors supabase/migrations/0001_init.sql.
 */
import type { BrainState, BrainEventKind, FunnelStage, Qualification } from '../brain/types.js';
import type { PeopleSearchFilters } from '../channel/unipile.js';

export type LeadSource =
  | 'cold_outbound'
  | 'cta_reply_system'
  | 'post_engagement'
  | 'lead_magnet_completer'
  | 'application_completer'
  | 'manual';

export type MessageDirection = 'outbound' | 'inbound';

export type MessageStatus = 'pending_hitl' | 'approved' | 'sent' | 'failed' | 'received' | 'skipped';

export type EventKind =
  | BrainEventKind
  | 'lead_created'
  | 'reply_received'
  | 'opener_sent'
  | 'invite_sent'
  | 'invite_failed'
  | 'invite_withdrawn'
  | 'compliance_blocked'
  | 'booking_confirmed';

export interface LeadRecord {
  id: string;
  linkedinUrl?: string;
  /** LinkedIn provider id (the attendee id Unipile uses to address this person). */
  linkedinProviderId?: string;
  /** Unipile chat id for the ongoing conversation (where replies are sent). */
  unipileChatId?: string;
  fullName?: string;
  firstName?: string;
  /** Contact details collected in-chat before booking. */
  email?: string;
  phone?: string;
  source: LeadSource;
  stage: FunnelStage;
  brain: BrainState;
  qualification: Qualification;
  doNotContact: boolean;
  /** GHL contact id once synced (for idempotent updates). */
  ghlContactId?: string;
  /** GHL opportunity id once a qualified lead is in the pipeline. */
  ghlOpportunityId?: string;
  /** When the daily cycle should touch this lead again (follow-up clock). Null = never. */
  nextActionAt?: string;
  /** When we last sent this lead a message (audit + pacing). */
  lastOutboundAt?: string;
  /** When the connection request went out (cold outbound). */
  invitedAt?: string;
  /** Unipile's id for the sent request — needed to withdraw it if it is never accepted. */
  invitationId?: string;
  /** Failed connection-request attempts; a lead that keeps failing leaves the queue. */
  inviteAttempts?: number;
  /** The search campaign that found this lead (for acceptance rate per campaign). */
  campaignId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MessageRecord {
  id: string;
  leadId: string;
  direction: MessageDirection;
  status: MessageStatus;
  body: string;
  /** Flow node that produced an outbound message (for audit). */
  node?: string;
  /** Set when the guard flagged the body for human review before send. */
  guardFlagged?: boolean;
  /** Unipile message id for an inbound message — dedupes redelivered webhooks. */
  unipileMessageId?: string;
  createdAt: string;
}

export interface EventRecord {
  id: string;
  leadId: string;
  kind: EventKind;
  payload: Record<string, unknown>;
  occurredAt: string;
}

export interface CreateLeadInput {
  source: LeadSource;
  linkedinUrl?: string;
  linkedinProviderId?: string;
  unipileChatId?: string;
  fullName?: string;
  firstName?: string;
  campaignId?: string;
}

/**
 * One saved LinkedIn search that keeps the invite queue topped up. Filters hold LinkedIn's own
 * ids (resolved once by scripts/seed-campaigns.ts), so a run never has to guess what
 * "Germany" or "Software" means.
 */
export interface SearchCampaign {
  id: string;
  /** Unique, human readable, e.g. "CH · Software · Gründer". */
  name: string;
  filters: PeopleSearchFilters;
  /** Lower runs first among campaigns that ran equally long ago. */
  priority: number;
  active: boolean;
  /** LinkedIn has no more results; the campaign is retired. */
  exhausted: boolean;
  /** Where the next run continues paging. */
  cursor?: string;
  lastRunAt?: string;
}

export type UpsertCampaignInput = Pick<SearchCampaign, 'name' | 'filters' | 'priority'> &
  Partial<Pick<SearchCampaign, 'active' | 'lastRunAt'>>;

export interface Repository {
  getLead(id: string): Promise<LeadRecord | null>;
  findLeadByLinkedinUrl(url: string): Promise<LeadRecord | null>;
  /** Find a lead by their LinkedIn provider id (used to map inbound webhooks). */
  findLeadByProviderId(providerId: string): Promise<LeadRecord | null>;
  /** Find a lead by the email captured in-chat (used to map GHL booking webhooks). */
  findLeadByEmail(email: string): Promise<LeadRecord | null>;
  createLead(input: CreateLeadInput): Promise<LeadRecord>;
  /** Persist brain state, stage, qualification, do-not-contact. */
  saveLead(lead: LeadRecord): Promise<void>;
  appendMessage(
    msg: Omit<MessageRecord, 'id' | 'createdAt'>,
  ): Promise<MessageRecord>;
  appendEvent(evt: Omit<EventRecord, 'id' | 'occurredAt'>): Promise<EventRecord>;
  /** Find an inbound message by its Unipile id (dedupe redelivered webhooks). */
  findInboundByUnipileId(unipileMessageId: string): Promise<MessageRecord | null>;
  /** Messages awaiting a human approve/reject before send. */
  pendingApprovals(): Promise<MessageRecord[]>;
  messagesForLead(leadId: string): Promise<MessageRecord[]>;
  getMessage(messageId: string): Promise<MessageRecord | null>;
  /** Update an outbound message's status (e.g. approved -> sent). */
  setMessageStatus(messageId: string, status: MessageStatus): Promise<void>;
  /** Replace a draft's text with the reviewer's edit. */
  updateMessageBody(messageId: string, body: string): Promise<void>;

  // ── Daily cycle ────────────────────────────────────────────────
  /** Cold leads imported but not yet invited — fewest failed attempts first, then oldest. */
  listQueuedForInvite(limit: number): Promise<LeadRecord[]>;
  /** How many leads are waiting for an invite (what the refill tops up). */
  countQueuedForInvite(): Promise<number>;

  // ── Search campaigns ───────────────────────────────────────────
  /** Active, not exhausted campaigns: longest since last run first, then by priority. */
  listRunnableCampaigns(): Promise<SearchCampaign[]>;
  /** Create or update a campaign by name (filters/priority/active); keeps its cursor. */
  upsertCampaign(input: UpsertCampaignInput): Promise<SearchCampaign>;
  /** Persist a campaign's progress (cursor, exhausted, last run). */
  saveCampaign(campaign: SearchCampaign): Promise<void>;
  /** Leads whose connection request went out before `beforeIso` and is still unanswered. */
  listInvitedBefore(beforeIso: string, limit: number): Promise<LeadRecord[]>;
  /** Leads whose follow-up clock has come due. */
  listDueForFollowUp(nowIso: string, limit: number): Promise<LeadRecord[]>;
  /** Approved outbound messages that have not been dispatched yet. */
  listApprovedUnsent(limit: number): Promise<MessageRecord[]>;
  /**
   * Reserve `count` sends against the day's budget and return how many were actually
   * granted. Atomic per day so two overlapping runs can never exceed the cap.
   */
  reserveDailySends(day: string, limit: number, count: number): Promise<number>;
  /** Sends already used today (for reporting). */
  sentToday(day: string): Promise<number>;
  /** How many events of `kind` happened at or after `sinceIso` (e.g. invites this week). */
  countEventsSince(kind: EventKind, sinceIso: string): Promise<number>;

  /** Raw counters for the review dashboard, aggregated in one round trip. */
  dashboardStats(sinceIso: string, day: string): Promise<RawStats>;
}

/** Counters as they come out of the store, before any rate/labelling work. */
export interface RawStats {
  funnel: Partial<Record<FunnelStage, number>>;
  queueWaitingForInvite: number;
  pendingApprovals: number;
  actionsUsedToday: number;
  eventsSince: Record<string, number>;
  leadsCreatedSince: number;
  messagesSentSince: number;
  repliesSince: number;
  invitesTotal: number;
  invitesAccepted: number;
  bookedTotal: number;
}

export function emptyQualification(): Qualification {
  return { status: 'Not Reviewed' };
}
