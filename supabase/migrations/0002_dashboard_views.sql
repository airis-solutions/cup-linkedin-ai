-- ─── Convenience views for monitoring during build ──────────────

create or replace view view_active_threads as
select
  c.id as conversation_id,
  l.full_name,
  l.linkedin_url,
  c.current_stage,
  c.last_inbound_at,
  c.last_outbound_at,
  c.next_action_at,
  l.source
from conversations c
join leads l on l.id = c.lead_id
where c.current_stage not in ('disqualified', 'do_not_contact')
order by c.next_action_at asc nulls last;

create or replace view view_daily_send_volume as
select
  date_trunc('day', sent_at)::date as day,
  count(*) as sent,
  count(*) filter (where status = 'sent') as delivered,
  count(*) filter (where status = 'failed') as failed
from messages
where direction = 'outbound' and sent_at is not null
group by 1
order by 1 desc;

create or replace view view_qualification_funnel as
select
  stage,
  count(*) as lead_count
from leads
group by stage
order by
  case stage
    when 'new' then 1
    when 'opener_sent' then 2
    when 'qualifying' then 3
    when 'qualified' then 4
    when 'booking_offered' then 5
    when 'booked' then 6
    when 'parked' then 7
    when 'disqualified' then 8
    when 'do_not_contact' then 9
  end;

create or replace view view_booking_conversion as
select
  l.source,
  count(*) filter (where l.stage in ('booked')) as booked,
  count(*) as total_leads,
  round(
    100.0 * count(*) filter (where l.stage = 'booked') / nullif(count(*), 0),
    2
  ) as booked_pct
from leads l
group by l.source
order by booked desc;
