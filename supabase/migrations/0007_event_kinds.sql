-- Two event kinds the application writes but the enum never had.
--
-- `flagged_non_prospect` fires whenever the AI routes an agency pitch / spam out of the
-- funnel, and `invite_sent` on every cold connection request. Both would have thrown
-- "invalid input value for enum event_kind" mid-turn, failing the whole webhook.

alter type event_kind add value if not exists 'flagged_non_prospect';
alter type event_kind add value if not exists 'invite_sent';
