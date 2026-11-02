-- Numbers for the daily Telegram report.
--
-- 1. dashboard_stats counted every invited lead past 'new'/'invited' as accepted. Since
--    0009–0011 an invite can also fail, be withdrawn or be put on hold, none of which means
--    the person let us in, so the acceptance rate read too high. Same function otherwise.
-- 2. campaign_stats: invited / accepted / replied / booked per search campaign, the number
--    that decides which campaigns keep running.
--
-- The not-accepted stage list is mirrored in src/store/repository.ts (NOT_ACCEPTED_STAGES).

create or replace function dashboard_stats(p_since timestamptz, p_day date)
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'funnel', (
      select coalesce(jsonb_object_agg(stage, n), '{}'::jsonb)
      from (select stage::text as stage, count(*) as n from leads group by stage) s
    ),
    'queueWaitingForInvite', (
      select count(*) from leads where stage = 'new' and do_not_contact = false
    ),
    'pendingApprovals', (
      select count(*) from messages where status = 'pending_hitl'
    ),
    'actionsUsedToday', (
      select coalesce(sent_count, 0) from daily_send_counter where day = p_day
    ),
    'eventsSince', (
      select coalesce(jsonb_object_agg(kind, n), '{}'::jsonb)
      from (
        select kind::text as kind, count(*) as n
        from events where occurred_at >= p_since group by kind
      ) e
    ),
    'leadsCreatedSince', (
      select count(*) from leads where created_at >= p_since
    ),
    'messagesSentSince', (
      select count(*) from messages
      where direction = 'outbound' and status = 'sent' and created_at >= p_since
    ),
    'repliesSince', (
      select count(*) from messages
      where direction = 'inbound' and created_at >= p_since
    ),
    'invitesTotal', (
      select count(*) from leads where invited_at is not null
    ),
    'invitesAccepted', (
      select count(*) from leads
      where invited_at is not null
        and stage not in ('new', 'invited', 'invite_failed', 'invite_expired', 'on_hold')
    ),
    'bookedTotal', (
      select count(*) from leads where stage = 'booked'
    )
  );
$$;

create or replace function campaign_stats()
returns jsonb
language sql
stable
as $$
  select coalesce(jsonb_agg(row_to_json(s) order by s.name), '[]'::jsonb)
  from (
    select
      c.name,
      c.active,
      c.exhausted,
      count(l.id) filter (where l.stage = 'new' and not l.do_not_contact) as queued,
      count(l.id) filter (where l.invited_at is not null) as invited,
      count(l.id) filter (
        where l.invited_at is not null
          and l.stage not in ('new', 'invited', 'invite_failed', 'invite_expired', 'on_hold')
      ) as accepted,
      count(l.id) filter (
        where exists (select 1 from messages m where m.lead_id = l.id and m.direction = 'inbound')
      ) as replied,
      count(l.id) filter (where l.stage = 'booked') as booked
    from search_campaigns c
    left join leads l on l.campaign_id = c.id
    group by c.id, c.name, c.active, c.exhausted
  ) s;
$$;
