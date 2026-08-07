/**
 * In-memory Repository implementation for tests and local dev.
 * Not for production (no persistence across restarts) — the Supabase implementation
 * will replace it behind the same interface.
 */
import { randomUUID } from 'node:crypto';
import { defaultBrainState } from '../brain/types.js';
import type {
  CreateLeadInput,
  EventRecord,
  LeadRecord,
  MessageRecord,
  Repository,
} from './repository.js';
import { emptyQualification } from './repository.js';

export class InMemoryRepository implements Repository {
  private leads = new Map<string, LeadRecord>();
  private messages: MessageRecord[] = [];
  private events: EventRecord[] = [];
  private dailySends = new Map<string, number>();

  async getLead(id: string): Promise<LeadRecord | null> {
    return this.leads.get(id) ?? null;
  }

  async findLeadByLinkedinUrl(url: string): Promise<LeadRecord | null> {
    for (const lead of this.leads.values()) {
      if (lead.linkedinUrl === url) return lead;
    }
    return null;
  }

  async findLeadByProviderId(providerId: string): Promise<LeadRecord | null> {
    for (const lead of this.leads.values()) {
      if (lead.linkedinProviderId === providerId) return lead;
    }
    return null;
  }

  async findLeadByEmail(email: string): Promise<LeadRecord | null> {
    const needle = email.trim().toLowerCase();
    if (!needle) return null;
    for (const lead of this.leads.values()) {
      if (lead.email?.trim().toLowerCase() === needle) return lead;
    }
    return null;
  }

  async createLead(input: CreateLeadInput): Promise<LeadRecord> {
    const now = new Date().toISOString();
    const lead: LeadRecord = {
      id: randomUUID(),
      linkedinUrl: input.linkedinUrl,
      linkedinProviderId: input.linkedinProviderId,
      unipileChatId: input.unipileChatId,
      fullName: input.fullName,
      firstName: input.firstName,
      source: input.source,
      stage: 'new',
      brain: defaultBrainState(),
      qualification: emptyQualification(),
      doNotContact: false,
      createdAt: now,
      updatedAt: now,
    };
    this.leads.set(lead.id, lead);
    return lead;
  }

  async saveLead(lead: LeadRecord): Promise<void> {
    lead.updatedAt = new Date().toISOString();
    this.leads.set(lead.id, lead);
  }

  async appendMessage(msg: Omit<MessageRecord, 'id' | 'createdAt'>): Promise<MessageRecord> {
    const record: MessageRecord = { ...msg, id: randomUUID(), createdAt: new Date().toISOString() };
    this.messages.push(record);
    return record;
  }

  async appendEvent(evt: Omit<EventRecord, 'id' | 'occurredAt'>): Promise<EventRecord> {
    const record: EventRecord = { ...evt, id: randomUUID(), occurredAt: new Date().toISOString() };
    this.events.push(record);
    return record;
  }

  async findInboundByUnipileId(unipileMessageId: string): Promise<MessageRecord | null> {
    return this.messages.find((m) => m.direction === 'inbound' && m.unipileMessageId === unipileMessageId) ?? null;
  }

  async pendingApprovals(): Promise<MessageRecord[]> {
    return this.messages.filter((m) => m.status === 'pending_hitl');
  }

  async messagesForLead(leadId: string): Promise<MessageRecord[]> {
    return this.messages.filter((m) => m.leadId === leadId);
  }

  async setMessageStatus(messageId: string, status: MessageRecord['status']): Promise<void> {
    const msg = this.messages.find((m) => m.id === messageId);
    if (msg) msg.status = status;
  }

  async listQueuedForInvite(limit: number): Promise<LeadRecord[]> {
    return [...this.leads.values()]
      .filter((l) => l.stage === 'new' && !l.doNotContact)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .slice(0, limit);
  }

  async listDueForFollowUp(nowIso: string, limit: number): Promise<LeadRecord[]> {
    return [...this.leads.values()]
      .filter((l) => !l.doNotContact && l.nextActionAt && l.nextActionAt <= nowIso)
      .sort((a, b) => (a.nextActionAt ?? '').localeCompare(b.nextActionAt ?? ''))
      .slice(0, limit);
  }

  async listApprovedUnsent(limit: number): Promise<MessageRecord[]> {
    return this.messages
      .filter((m) => m.direction === 'outbound' && m.status === 'approved')
      .slice(0, limit);
  }

  async reserveDailySends(day: string, limit: number, count: number): Promise<number> {
    const used = this.dailySends.get(day) ?? 0;
    const granted = Math.max(0, Math.min(count, limit - used));
    this.dailySends.set(day, used + granted);
    return granted;
  }

  async sentToday(day: string): Promise<number> {
    return this.dailySends.get(day) ?? 0;
  }

  /** Test helper: all recorded events. */
  allEvents(): EventRecord[] {
    return this.events;
  }
}
