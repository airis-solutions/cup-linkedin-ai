/**
 * One-way sync of a lead's state into GoHighLevel.
 *
 * Fabi/Robin's model: every real conversation -> a Contact (answers stored on it);
 * qualified leads -> an Opportunity in the Leads pipeline; non-prospects / not-yet-engaged
 * are not synced. The lead remembers its GHL ids so repeated syncs update instead of duplicate.
 *
 * Best-effort: callers run this in a try/catch so a GHL hiccup never breaks the chat.
 */
import type { GhlClient, UpsertContactInput } from './ghl.js';
import { ghlCustomFields, ghlStageId, shouldCreateOpportunity } from '../config/ghl.js';
import type { LeadRecord } from '../store/repository.js';
import { logger } from '../lib/logger.js';

const LINKEDIN_TAG = 'src:linkedin';
const LEAD_SOURCE = 'LinkedIn';

/** Non-prospects (do-not-contact) and leads that haven't engaged yet are not synced. */
export function shouldSync(lead: LeadRecord): boolean {
  if (lead.doNotContact) return false;
  return lead.stage !== 'do_not_contact' && lead.stage !== 'new' && lead.stage !== 'opener_sent';
}

function contactPayload(lead: LeadRecord): UpsertContactInput {
  return {
    firstName: lead.firstName,
    name: lead.fullName,
    email: lead.email,
    phone: lead.phone,
    source: LEAD_SOURCE,
    tags: [LINKEDIN_TAG],
    customFields: ghlCustomFields(lead.qualification),
  };
}

/**
 * Push the lead's current state to GHL. Mutates lead.ghlContactId / ghlOpportunityId and
 * returns whether they changed, so the caller can persist the lead.
 */
export async function syncLeadToGhl(ghl: GhlClient, lead: LeadRecord): Promise<{ changed: boolean }> {
  if (!shouldSync(lead)) return { changed: false };
  let changed = false;

  // 1) Contact — create once, then update by id on every later sync.
  if (!lead.ghlContactId) {
    const r = await ghl.upsertContact(contactPayload(lead));
    if (!r.ok || !r.data) {
      logger.warn({ leadId: lead.id, error: r.error }, 'ghl.contact_upsert_failed');
      return { changed };
    }
    lead.ghlContactId = r.data.id;
    changed = true;
  } else {
    const r = await ghl.updateContact(lead.ghlContactId, contactPayload(lead));
    if (!r.ok) logger.warn({ leadId: lead.id, error: r.error }, 'ghl.contact_update_failed');
  }

  // 2) Opportunity — only for qualified+ leads (Fabi: unqualified = contact only).
  const stageId = ghlStageId(lead.stage);
  if (shouldCreateOpportunity(lead.stage) && stageId && lead.ghlContactId) {
    if (!lead.ghlOpportunityId) {
      const name = lead.fullName || lead.firstName || 'LinkedIn lead';
      const r = await ghl.createOpportunity({ name, pipelineStageId: stageId, contactId: lead.ghlContactId });
      if (r.ok && r.data) {
        lead.ghlOpportunityId = r.data.id;
        changed = true;
      } else {
        logger.warn({ leadId: lead.id, error: r.error }, 'ghl.opportunity_create_failed');
      }
    } else {
      const r = await ghl.updateOpportunityStage(lead.ghlOpportunityId, stageId);
      if (!r.ok) logger.warn({ leadId: lead.id, error: r.error }, 'ghl.opportunity_stage_failed');
    }
  }

  return { changed };
}
