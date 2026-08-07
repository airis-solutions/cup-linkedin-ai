-- Scheduling for the autonomous daily cycle.
--
-- Until now the engine could decide "touch this lead again in 24h" but nothing stored
-- when that was due, so follow-ups never ran. These columns are that clock.

alter table leads
  add column if not exists next_action_at timestamptz,
  add column if not exists last_outbound_at timestamptz,
  add column if not exists invited_at timestamptz;

-- The daily cycle scans for due follow-ups and for queued cold leads awaiting an invite.
create index if not exists leads_next_action_at_idx
  on leads (next_action_at)
  where next_action_at is not null;

create index if not exists leads_invite_queue_idx
  on leads (created_at)
  where stage = 'new' and do_not_contact = false;

-- Backfill: leads already invited before this migration keep an honest timestamp.
update leads set invited_at = updated_at
  where stage = 'invited' and invited_at is null;

-- ─── Daily budget ────────────────────────────────────────────────
-- Atomic reservation so two overlapping cycle runs can never exceed the day's cap.
-- Returns how many sends were actually granted (0 when the budget is spent).
create or replace function reserve_daily_sends(p_day date, p_limit int, p_count int)
returns int
language plpgsql
as $$
declare
  v_used int;
  v_granted int;
begin
  insert into daily_send_counter (day, sent_count, limit_value)
  values (p_day, 0, p_limit)
  on conflict (day) do update set limit_value = excluded.limit_value
  returning sent_count into v_used;

  v_granted := greatest(0, least(p_count, p_limit - v_used));

  if v_granted > 0 then
    update daily_send_counter
      set sent_count = sent_count + v_granted, updated_at = now()
      where day = p_day;
  end if;

  return v_granted;
end;
$$;
