/**
 * One-off: push a single lead's state into GHL using the production sync path.
 * Usage: npx tsx scripts/sync-one-lead.ts <email>
 */
import 'dotenv/config';
import { createSupabaseRepoFromEnv } from '../src/store/supabase.js';
import { createGhlFromEnv } from '../src/channel/ghl.js';
import { syncLeadToGhl } from '../src/channel/ghl-sync.js';

const email = process.argv[2];
if (!email) throw new Error('usage: tsx scripts/sync-one-lead.ts <email>');

const repo = createSupabaseRepoFromEnv();
const ghl = createGhlFromEnv();
if (!ghl) throw new Error('GHL not configured');

const lead = await repo.findLeadByEmail(email);
if (!lead) throw new Error(`no lead for ${email}`);

console.log('VORHER  ', JSON.stringify({ stage: lead.stage, contact: lead.ghlContactId, opp: lead.ghlOpportunityId }));
console.log('Qualifizierung', JSON.stringify(lead.qualification));

const { changed } = await syncLeadToGhl(ghl, lead);
if (changed) await repo.saveLead(lead);

console.log('NACHHER ', JSON.stringify({ stage: lead.stage, contact: lead.ghlContactId, opp: lead.ghlOpportunityId, changed }));
