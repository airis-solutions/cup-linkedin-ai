/**
 * Inbound LinkedIn message → the AI.
 *
 * A Unipile webhook fires when someone messages Robin. We map the sender to a lead
 * (creating one for a brand-new contact), remember the chat id so replies land in the
 * right thread, and hand the text to the orchestrator. The resulting draft is stored
 * pending human approval; sending happens in outbound.ts.
 */
import { handleInbound, type OrchestratorDeps, type TurnResult } from '../orchestrator.js';
import { parseInbound, firstNameOf, type UnipileInboundWebhook } from './unipile.js';

export async function handleUnipileWebhook(
  deps: OrchestratorDeps,
  payload: UnipileInboundWebhook,
): Promise<TurnResult | null> {
  const { chatId, senderId, senderName, text, fromSelf } = parseInbound(payload);
  // Unipile echoes the account owner's OWN sent messages back as message_received —
  // ignore them, otherwise the AI keeps replying to itself.
  if (fromSelf || !senderId || !text.trim()) return null;

  const firstName = firstNameOf(senderName);

  let lead = await deps.repo.findLeadByProviderId(senderId);
  if (!lead) {
    lead = await deps.repo.createLead({
      source: 'manual',
      linkedinProviderId: senderId,
      unipileChatId: chatId,
      firstName,
      fullName: senderName,
    });
  } else {
    // Backfill chat id / name on an existing lead if we didn't have them yet.
    let dirty = false;
    if (!lead.unipileChatId && chatId) {
      lead.unipileChatId = chatId;
      dirty = true;
    }
    if (!lead.firstName && firstName) {
      lead.firstName = firstName;
      dirty = true;
    }
    if (!lead.fullName && senderName) {
      lead.fullName = senderName;
      dirty = true;
    }
    if (dirty) await deps.repo.saveLead(lead);
  }

  return handleInbound(deps, lead.id, text);
}
