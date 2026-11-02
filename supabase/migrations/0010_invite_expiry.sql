-- Connection requests nobody accepted within three weeks are withdrawn (daily cycle).
-- The lead moves to `invite_expired`, so the acceptance rate counts it as a "no" instead of
-- leaving it in `invited` forever.

alter type funnel_stage add value if not exists 'invite_expired' after 'invite_failed';
alter type event_kind add value if not exists 'invite_withdrawn';
