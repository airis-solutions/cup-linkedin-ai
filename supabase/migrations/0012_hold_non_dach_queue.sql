-- Outreach is DACH only for now. The queue still holds 56 leads from the early UAE / Singapore
-- / UK test lists; hold them back instead of deleting them, so they are there if the target
-- region widens. The opener language was set from the LinkedIn location at import: 'de' means
-- a DACH location, everything else got 'en'.
--
-- Separate from 0011 because Postgres refuses a new enum value in the transaction that adds it.

update leads
set stage = 'on_hold', updated_at = now()
where stage = 'new'
  and source = 'cold_outbound'
  and coalesce(brain->>'language', 'en') <> 'de';
