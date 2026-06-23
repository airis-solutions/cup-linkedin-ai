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

  /** Test helper: all recorded events. */
  allEvents(): EventRecord[] {
    return this.events;
  }
}
