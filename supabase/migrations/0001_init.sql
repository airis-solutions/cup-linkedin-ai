-- ─── Extensions ──────────────────────────────────────────────────
create extension if not exists "pgcrypto";

-- ─── Enums ───────────────────────────────────────────────────────
create type lead_source as enum (
  'cold_outbound',
  'cta_reply_system',
  'post_engagement',
  'lead_magnet_completer',
  'application_completer',
  'manual'
);

create type funnel_stage as enum (
  'new',
  'opener_sent',
  'qualifying',
  'qualified',
  'booking_offered',
  'booked',
  'disqualified',
  'parked',
  'do_not_contact'
);

create type message_direction as enum ('outbound', 'inbound');

create type message_status as enum (
  'pending_hitl',
  'approved',
  'sent',
  'failed',
  'received',
  'skipped'
);

create type event_kind as enum (
  'lead_created',
  'opener_sent',
  'reply_received',
  'qualification_advanced',
  'objection_handled',
  'booking_link_sent',
  'booking_confirmed',
  'lead_parked',
  'lead_disqualified',
  'hitl_requested',
  'hitl_approved',
  'hitl_rejected',
  'safety_limit_hit',
  'error'
);

-- ─── Leads ────────────────────────────────────────────────────────
create table leads (
  id uuid primary key default gen_random_uuid(),
  linkedin_url text unique,
  linkedin_provider_id text,
  unipile_chat_id text,
  full_name text,
  first_name text,
  email text,
  phone text,
  headline text,
  company text,
  source lead_source not null,
  stage funnel_stage not null default 'new',
  ghl_contact_id text unique,
  do_not_contact boolean not null default false,
  do_not_contact_reason text,
  brain jsonb not null default '{}'::jsonb,
  qualification jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_leads_provider on leads(linkedin_provider_id);

create index idx_leads_stage on leads(stage);
create index idx_leads_source on leads(source);
create index idx_leads_ghl on leads(ghl_contact_id);

-- ─── Conversations ───────────────────────────────────────────────
create table conversations (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references leads(id) on delete cascade,
  unipile_thread_id text unique,
  current_stage funnel_stage not null default 'new',
  next_action_at timestamptz,
  last_inbound_at timestamptz,
  last_outbound_at timestamptz,
  parked_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_conv_lead on conversations(lead_id);
create index idx_conv_next_action on conversations(next_action_at) where next_action_at is not null;

-- ─── Messages ────────────────────────────────────────────────────
create table messages (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references leads(id) on delete cascade,
  conversation_id uuid references conversations(id) on delete cascade,
  direction message_direction not null,
  status message_status not null,
  body text not null,
  node text,
  guard_flagged boolean not null default false,
  template_id text,
  variant text,
  unipile_message_id text unique,
  hitl_approved_by text,
  hitl_approved_at timestamptz,
  sent_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index idx_msg_conv on messages(conversation_id, created_at desc);
create index idx_msg_lead on messages(lead_id, created_at desc);
create index idx_msg_status on messages(status) where status in ('pending_hitl', 'approved');

-- ─── Events (audit log) ──────────────────────────────────────────
create table events (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references leads(id) on delete set null,
  conversation_id uuid references conversations(id) on delete set null,
  kind event_kind not null,
  payload jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);

create index idx_events_lead on events(lead_id, occurred_at desc);
create index idx_events_kind on events(kind, occurred_at desc);

-- ─── Daily send counter (LinkedIn safety) ────────────────────────
create table daily_send_counter (
  day date primary key,
  sent_count int not null default 0,
  limit_value int not null,
  updated_at timestamptz not null default now()
);

-- ─── Updated_at trigger ──────────────────────────────────────────
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger leads_updated_at before update on leads
  for each row execute function set_updated_at();

create trigger conversations_updated_at before update on conversations
  for each row execute function set_updated_at();
