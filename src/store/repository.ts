/**
 * Storage contract for the operational state of leads + conversations.
 *
 * The orchestrator talks to this interface only, so the engine stays testable with an
 * in-memory store (store/memory.ts) and the production Supabase implementation can be
 * swapped in later without touching the brain. Mirrors supabase/migrations/0001_init.sql.
 */
import type { BrainState, BrainEventKind, FunnelStage, Qualification } from '../brain/types.js';

export type LeadSource =
  | 'cold_outbound'
  | 'cta_reply_system'
  | 'post_engagement'
  | 'lead_magnet_completer'
  | 'application_completer'
  | 'manual';

export type MessageDirection = 'outbound' | 'inbound';

export type MessageStatus = 'pending_hitl' | 'approved' | 'sent' | 'failed' | 'received' | 'skipped';

export type EventKind = BrainEventKind | 'lead_created' | 'reply_received' | 'opener_sent';

export interface LeadRecord {
  id: string;
  linkedinUrl?: string;
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
  fullName?: string;
  firstName?: string;
}

export interface Repository {
  getLead(id: string): Promise<LeadRecord | null>;
  findLeadByLinkedinUrl(url: string): Promise<LeadRecord | null>;
  createLead(input: CreateLeadInput): Promise<LeadRecord>;
  /** Persist brain state, stage, qualification, do-not-contact. */
  saveLead(lead: LeadRecord): Promise<void>;
  appendMessage(
    msg: Omit<MessageRecord, 'id' | 'createdAt'>,
  ): Promise<MessageRecord>;
  appendEvent(evt: Omit<EventRecord, 'id' | 'occurredAt'>): Promise<EventRecord>;
  /** Messages awaiting a human approve/reject before send. */
  pendingApprovals(): Promise<MessageRecord[]>;
  messagesForLead(leadId: string): Promise<MessageRecord[]>;
}

export function emptyQualification(): Qualification {
  return { status: 'Not Reviewed' };
}
