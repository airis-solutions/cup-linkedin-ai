-- Search campaigns keep the invite queue topped up without anyone running a CLI.
--
-- One row = one saved LinkedIn search (country x industry x keyword). `filters` holds
-- LinkedIn's own ids, resolved once by scripts/seed-campaigns.ts. `cursor` is where the next
-- run continues paging, so a campaign is read through once instead of re-reading page 1.
-- Every lead remembers its campaign, which gives an acceptance rate per campaign.
--
-- `on_hold`: imported but deliberately not invited (e.g. outside the current target region).

alter type funnel_stage add value if not exists 'on_hold' after 'invite_expired';

create table if not exists search_campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  filters jsonb not null,
  priority integer not null default 100,
  active boolean not null default true,
  exhausted boolean not null default false,
  cursor text,
  last_run_at timestamptz,
  created_at timestamptz not null default now()
);

alter table search_campaigns enable row level security;

alter table leads add column if not exists campaign_id uuid references search_campaigns(id);
create index if not exists leads_campaign_idx on leads (campaign_id);
