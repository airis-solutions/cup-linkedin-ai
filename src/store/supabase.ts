/**
 * Supabase-backed Repository — the production persistence layer.
 *
 * Implements the same interface as InMemoryRepository, so the orchestrator/channel don't
 * change. Uses the service-role key (server-side, bypasses RLS). Maps DB rows
 * (snake_case, jsonb) to the domain records.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { loadEnv } from '../config/env.js';
import { defaultBrainState } from '../brain/types.js';
import type { BrainState, Qualification } from '../brain/types.js';
import {
  emptyQualification,
  type CreateLeadInput,
  type EventRecord,
  type LeadRecord,
  type MessageRecord,
  type MessageStatus,
  type Repository,
} from './repository.js';

type Row = Record<string, unknown>;

function rowToLead(r: Row): LeadRecord {
  return {
    id: r.id as string,
    linkedinUrl: (r.linkedin_url as string) ?? undefined,
    linkedinProviderId: (r.linkedin_provider_id as string) ?? undefined,
    unipileChatId: (r.unipile_chat_id as string) ?? undefined,
    fullName: (r.full_name as string) ?? undefined,
    firstName: (r.first_name as string) ?? undefined,
    email: (r.email as string) ?? undefined,
    phone: (r.phone as string) ?? undefined,
    source: r.source as LeadRecord['source'],
    stage: r.stage as LeadRecord['stage'],
    brain: r.brain as BrainState,
    qualification: r.qualification as Qualification,
    doNotContact: Boolean(r.do_not_contact),
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  };
}

function rowToMessage(r: Row): MessageRecord {
  return {
    id: r.id as string,
    leadId: r.lead_id as string,
    direction: r.direction as MessageRecord['direction'],
    status: r.status as MessageStatus,
    body: r.body as string,
    node: (r.node as string) ?? undefined,
    guardFlagged: Boolean(r.guard_flagged),
    createdAt: r.created_at as string,
  };
}

export class SupabaseRepository implements Repository {
  constructor(private readonly sb: SupabaseClient) {}

  async getLead(id: string): Promise<LeadRecord | null> {
    const { data, error } = await this.sb.from('leads').select('*').eq('id', id).maybeSingle();
    if (error) throw new Error(`getLead: ${error.message}`);
    return data ? rowToLead(data) : null;
  }

  async findLeadByLinkedinUrl(url: string): Promise<LeadRecord | null> {
    const { data, error } = await this.sb.from('leads').select('*').eq('linkedin_url', url).maybeSingle();
    if (error) throw new Error(`findLeadByLinkedinUrl: ${error.message}`);
    return data ? rowToLead(data) : null;
  }

  async findLeadByProviderId(providerId: string): Promise<LeadRecord | null> {
    const { data, error } = await this.sb
      .from('leads')
      .select('*')
      .eq('linkedin_provider_id', providerId)
      .maybeSingle();
    if (error) throw new Error(`findLeadByProviderId: ${error.message}`);
    return data ? rowToLead(data) : null;
  }

  async createLead(input: CreateLeadInput): Promise<LeadRecord> {
    const { data, error } = await this.sb
      .from('leads')
      .insert({
        linkedin_url: input.linkedinUrl,
        linkedin_provider_id: input.linkedinProviderId,
        unipile_chat_id: input.unipileChatId,
        full_name: input.fullName,
        first_name: input.firstName,
        source: input.source,
        stage: 'new',
        brain: defaultBrainState(),
        qualification: emptyQualification(),
      })
      .select('*')
      .single();
    if (error) throw new Error(`createLead: ${error.message}`);
    return rowToLead(data);
  }

  async saveLead(lead: LeadRecord): Promise<void> {
    const { error } = await this.sb
      .from('leads')
      .update({
        linkedin_url: lead.linkedinUrl,
        linkedin_provider_id: lead.linkedinProviderId,
        unipile_chat_id: lead.unipileChatId,
        full_name: lead.fullName,
        first_name: lead.firstName,
        email: lead.email,
        phone: lead.phone,
        source: lead.source,
        stage: lead.stage,
        brain: lead.brain,
        qualification: lead.qualification,
        do_not_contact: lead.doNotContact,
        updated_at: new Date().toISOString(),
      })
      .eq('id', lead.id);
    if (error) throw new Error(`saveLead: ${error.message}`);
  }

  async appendMessage(msg: Omit<MessageRecord, 'id' | 'createdAt'>): Promise<MessageRecord> {
    const { data, error } = await this.sb
      .from('messages')
      .insert({
        lead_id: msg.leadId,
        direction: msg.direction,
        status: msg.status,
        body: msg.body,
        node: msg.node,
        guard_flagged: msg.guardFlagged ?? false,
      })
      .select('*')
      .single();
    if (error) throw new Error(`appendMessage: ${error.message}`);
    return rowToMessage(data);
  }

  async appendEvent(evt: Omit<EventRecord, 'id' | 'occurredAt'>): Promise<EventRecord> {
    const { data, error } = await this.sb
      .from('events')
      .insert({ lead_id: evt.leadId, kind: evt.kind, payload: evt.payload })
      .select('*')
      .single();
    if (error) throw new Error(`appendEvent: ${error.message}`);
    return { id: data.id, leadId: data.lead_id, kind: data.kind, payload: data.payload, occurredAt: data.occurred_at };
  }

  async pendingApprovals(): Promise<MessageRecord[]> {
    const { data, error } = await this.sb
      .from('messages')
      .select('*')
      .eq('status', 'pending_hitl')
      .order('created_at', { ascending: true });
    if (error) throw new Error(`pendingApprovals: ${error.message}`);
    return (data ?? []).map(rowToMessage);
  }

  async messagesForLead(leadId: string): Promise<MessageRecord[]> {
    const { data, error } = await this.sb
      .from('messages')
      .select('*')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: true });
    if (error) throw new Error(`messagesForLead: ${error.message}`);
    return (data ?? []).map(rowToMessage);
  }

  async setMessageStatus(messageId: string, status: MessageStatus): Promise<void> {
    const { error } = await this.sb.from('messages').update({ status }).eq('id', messageId);
    if (error) throw new Error(`setMessageStatus: ${error.message}`);
  }
}

/** Build the Supabase repository from env (service-role). */
export function createSupabaseRepoFromEnv(): SupabaseRepository {
  const env = loadEnv();
  const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
  return new SupabaseRepository(sb);
}
