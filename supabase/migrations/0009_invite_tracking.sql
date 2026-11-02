-- Connection requests that fail must not block the queue, and sent requests must be
-- withdrawable.
--
-- From 12.10. on every request failed silently: the two oldest queued leads were retried on
-- every run, burned the day's budget and kept everyone behind them waiting. `invite_attempts`
-- moves a failing lead to the back, and after three tries out of the queue
-- (stage `invite_failed`). `invitation_id` is Unipile's id for a sent request, needed to
-- withdraw requests nobody accepts.

alter type funnel_stage add value if not exists 'invite_failed' after 'invited';
alter type event_kind add value if not exists 'invite_failed';

alter table leads add column if not exists invitation_id text;
alter table leads add column if not exists invite_attempts integer not null default 0;

-- The queue is read as "fewest attempts, then oldest".
drop index if exists leads_invite_queue_idx;
create index if not exists leads_invite_queue_idx
  on leads (invite_attempts, created_at)
  where stage = 'new' and do_not_contact = false;
