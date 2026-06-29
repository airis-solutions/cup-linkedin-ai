-- Store the GHL contact + opportunity ids on the lead so the sync is idempotent
-- (update instead of duplicate).
alter table leads add column if not exists ghl_contact_id text;
alter table leads add column if not exists ghl_opportunity_id text;
