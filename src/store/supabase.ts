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
  type RawStats,
  type Repository,
  type SearchCampaign,
  type CampaignStats,
  type UpsertCampaignInput,
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
    ghlContactId: (r.ghl_contact_id as string) ?? undefined,
    ghlOpportunityId: (r.ghl_opportunity_id as string) ?? undefined,
    nextActionAt: (r.next_action_at as string) ?? undefined,
    lastOutboundAt: (r.last_outbound_at as string) ?? undefined,
    invitedAt: (r.invited_at as string) ?? undefined,
    invitationId: (r.invitation_id as string) ?? undefined,
    inviteAttempts: (r.invite_attempts as number) ?? 0,
    campaignId: (r.campaign_id as string) ?? undefined,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  };
}

function rowToCampaign(r: Row): SearchCampaign {
  return {
    id: r.id as string,
    name: r.name as string,
    filters: r.filters as SearchCampaign['filters'],
    priority: r.priority as number,
    active: Boolean(r.active),
    exhausted: Boolean(r.exhausted),
    cursor: (r.cursor as string) ?? undefined,
    lastRunAt: (r.last_run_at as string) ?? undefined,
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
    unipileMessageId: (r.unipile_message_id as string) ?? undefined,
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

  async findLeadByEmail(email: string): Promise<LeadRecord | null> {
    const needle = email.trim();
    if (!needle) return null;
    // Case-insensitive; newest first in the rare case two leads share an email.
    const { data, error } = await this.sb
      .from('leads')
      .select('*')
      .ilike('email', needle)
      .order('updated_at', { ascending: false })
      .limit(1);
    if (error) throw new Error(`findLeadByEmail: ${error.message}`);
    return data && data.length > 0 ? rowToLead(data[0]) : null;
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
        campaign_id: input.campaignId,
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
        ghl_contact_id: lead.ghlContactId,
        ghl_opportunity_id: lead.ghlOpportunityId,
        next_action_at: lead.nextActionAt ?? null,
        last_outbound_at: lead.lastOutboundAt ?? null,
        invited_at: lead.invitedAt ?? null,
        invitation_id: lead.invitationId ?? null,
        invite_attempts: lead.inviteAttempts ?? 0,
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
        unipile_message_id: msg.unipileMessageId,
      })
      .select('*')
      .single();
    if (error) throw new Error(`appendMessage: ${error.message}`);
    return rowToMessage(data);
  }

  async findInboundByUnipileId(unipileMessageId: string): Promise<MessageRecord | null> {
    const { data, error } = await this.sb
      .from('messages')
      .select('*')
      .eq('unipile_message_id', unipileMessageId)
      .eq('direction', 'inbound')
      .maybeSingle();
    if (error) throw new Error(`findInboundByUnipileId: ${error.message}`);
    return data ? rowToMessage(data) : null;
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

  async getMessage(messageId: string): Promise<MessageRecord | null> {
    const { data, error } = await this.sb.from('messages').select('*').eq('id', messageId).maybeSingle();
    if (error) throw new Error(`getMessage: ${error.message}`);
    return data ? rowToMessage(data) : null;
  }

  async setMessageStatus(messageId: string, status: MessageStatus): Promise<void> {
    const { error } = await this.sb.from('messages').update({ status }).eq('id', messageId);
    if (error) throw new Error(`setMessageStatus: ${error.message}`);
  }

  async updateMessageBody(messageId: string, body: string): Promise<void> {
    const { error } = await this.sb.from('messages').update({ body }).eq('id', messageId);
    if (error) throw new Error(`updateMessageBody: ${error.message}`);
  }

  // ── Daily cycle ────────────────────────────────────────────────

  async listQueuedForInvite(limit: number): Promise<LeadRecord[]> {
    const { data, error } = await this.sb
      .from('leads')
      .select('*')
      .eq('stage', 'new')
      .eq('do_not_contact', false)
      .order('invite_attempts', { ascending: true })
      .order('created_at', { ascending: true })
      .limit(limit);
    if (error) throw new Error(`listQueuedForInvite: ${error.message}`);
    return (data ?? []).map(rowToLead);
  }

  async countQueuedForInvite(): Promise<number> {
    const { count, error } = await this.sb
      .from('leads')
      .select('id', { count: 'exact', head: true })
      .eq('stage', 'new')
      .eq('do_not_contact', false);
    if (error) throw new Error(`countQueuedForInvite: ${error.message}`);
    return count ?? 0;
  }

  async listRunnableCampaigns(): Promise<SearchCampaign[]> {
    const { data, error } = await this.sb
      .from('search_campaigns')
      .select('*')
      .eq('active', true)
      .eq('exhausted', false)
      .order('last_run_at', { ascending: true, nullsFirst: true })
      .order('priority', { ascending: true });
    if (error) throw new Error(`listRunnableCampaigns: ${error.message}`);
    return (data ?? []).map(rowToCampaign);
  }

  async upsertCampaign(input: UpsertCampaignInput): Promise<SearchCampaign> {
    const row: Row = { name: input.name, filters: input.filters, priority: input.priority };
    if (input.active !== undefined) row.active = input.active;
    if (input.lastRunAt !== undefined) row.last_run_at = input.lastRunAt;
    const { data, error } = await this.sb
      .from('search_campaigns')
      .upsert(row, { onConflict: 'name' })
      .select('*')
      .single();
    if (error) throw new Error(`upsertCampaign: ${error.message}`);
    return rowToCampaign(data);
  }

  async saveCampaign(c: SearchCampaign): Promise<void> {
    const { error } = await this.sb
      .from('search_campaigns')
      .update({ cursor: c.cursor ?? null, exhausted: c.exhausted, last_run_at: c.lastRunAt ?? null })
      .eq('id', c.id);
    if (error) throw new Error(`saveCampaign: ${error.message}`);
  }

  async listInvitedBefore(beforeIso: string, limit: number): Promise<LeadRecord[]> {
    const { data, error } = await this.sb
      .from('leads')
      .select('*')
      .eq('stage', 'invited')
      .lt('invited_at', beforeIso)
      .order('invited_at', { ascending: true })
      .limit(limit);
    if (error) throw new Error(`listInvitedBefore: ${error.message}`);
    return (data ?? []).map(rowToLead);
  }

  async listDueForFollowUp(nowIso: string, limit: number): Promise<LeadRecord[]> {
    const { data, error } = await this.sb
      .from('leads')
      .select('*')
      .eq('do_not_contact', false)
      .not('next_action_at', 'is', null)
      .lte('next_action_at', nowIso)
      .order('next_action_at', { ascending: true })
      .limit(limit);
    if (error) throw new Error(`listDueForFollowUp: ${error.message}`);
    return (data ?? []).map(rowToLead);
  }

  async listApprovedUnsent(limit: number): Promise<MessageRecord[]> {
    const { data, error } = await this.sb
      .from('messages')
      .select('*')
      .eq('direction', 'outbound')
      .eq('status', 'approved')
      .order('created_at', { ascending: true })
      .limit(limit);
    if (error) throw new Error(`listApprovedUnsent: ${error.message}`);
    return (data ?? []).map(rowToMessage);
  }

  async reserveDailySends(day: string, limit: number, count: number): Promise<number> {
    const { data, error } = await this.sb.rpc('reserve_daily_sends', {
      p_day: day,
      p_limit: limit,
      p_count: count,
    });
    if (error) throw new Error(`reserveDailySends: ${error.message}`);
    return typeof data === 'number' ? data : 0;
  }

  async dashboardStats(sinceIso: string, day: string): Promise<RawStats> {
    const { data, error } = await this.sb.rpc('dashboard_stats', { p_since: sinceIso, p_day: day });
    if (error) throw new Error(`dashboardStats: ${error.message}`);
    const r = (data ?? {}) as Record<string, unknown>;
    const num = (v: unknown): number => (typeof v === 'number' ? v : 0);
    const counts = (v: unknown): Record<string, number> =>
      v && typeof v === 'object' ? (v as Record<string, number>) : {};
    return {
      funnel: counts(r.funnel),
      queueWaitingForInvite: num(r.queueWaitingForInvite),
      pendingApprovals: num(r.pendingApprovals),
      actionsUsedToday: num(r.actionsUsedToday),
      eventsSince: counts(r.eventsSince),
      leadsCreatedSince: num(r.leadsCreatedSince),
      messagesSentSince: num(r.messagesSentSince),
      repliesSince: num(r.repliesSince),
      invitesTotal: num(r.invitesTotal),
      invitesAccepted: num(r.invitesAccepted),
      bookedTotal: num(r.bookedTotal),
    };
  }

  async campaignStats(): Promise<CampaignStats[]> {
    const { data, error } = await this.sb.rpc('campaign_stats');
    if (error) throw new Error(`campaignStats: ${error.message}`);
    return (Array.isArray(data) ? data : []) as CampaignStats[];
  }

  async countEventsSince(kind: EventRecord['kind'], sinceIso: string): Promise<number> {
    const { count, error } = await this.sb
      .from('events')
      .select('id', { count: 'exact', head: true })
      .eq('kind', kind)
      .gte('occurred_at', sinceIso);
    if (error) throw new Error(`countEventsSince: ${error.message}`);
    return count ?? 0;
  }

  async sentToday(day: string): Promise<number> {
    const { data, error } = await this.sb
      .from('daily_send_counter')
      .select('sent_count')
      .eq('day', day)
      .maybeSingle();
    if (error) throw new Error(`sentToday: ${error.message}`);
    return (data?.sent_count as number) ?? 0;
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
