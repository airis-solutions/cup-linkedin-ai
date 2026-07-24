/**
 * Accepted-connection webhook -> the AI's opener (Trigger A, second half).
 *
 * When a cold lead accepts Robin's connection request, Unipile's USERS webhook fires a
 * `new_relation` event (delayed up to ~8h — LinkedIn has no real-time signal). We map the
 * new relation to the lead we invited and fire the warm opener, which lands pending human
 * approval and is sent via outbound.ts on approve.
 *
 * Idempotent: Unipile may deliver the event more than once, so the `openerSent` guard makes
 * sure a lead never gets two openers. An unknown provider id (an organic accept outside
 * Trigger A) is ignored — we only auto-open leads we deliberately reached out to.
 */
import { handleOpener, type OrchestratorDeps, type TurnResult } from '../orchestrator.js';
import { parseNewRelation, type UnipileNewRelationWebhook } from './unipile.js';
import { logger } from '../lib/logger.js';

export async function handleNewRelation(
  deps: OrchestratorDeps,
  payload: UnipileNewRelationWebhook,
): Promise<TurnResult | null> {
  const { providerId } = parseNewRelation(payload);
  if (!providerId) return null;

  const lead = await deps.repo.findLeadByProviderId(providerId);
  // Only leads we invited (Trigger A) auto-open; skip unknown / already-opened / opted-out.
  if (!lead || lead.doNotContact || lead.brain.openerSent) {
    if (lead?.brain.openerSent) logger.info({ leadId: lead.id }, 'relation.opener_already_sent');
    return null;
  }

  logger.info({ leadId: lead.id }, 'relation.accepted_firing_opener');
  return handleOpener(deps, lead.id);
}
