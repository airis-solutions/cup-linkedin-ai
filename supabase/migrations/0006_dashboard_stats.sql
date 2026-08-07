-- One round trip for the whole review dashboard.
--
-- The 0002 views were written before the model settled (they read the unused
-- `conversations` table and a `sent_at` column the app never fills), so the dashboard
-- reads this function instead. Counting happens in the database, not in the app.

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
      where invited_at is not null and stage not in ('new', 'invited')
    ),
    'bookedTotal', (
      select count(*) from leads where stage = 'booked'
    )
  );
$$;
