/**
 * Inbound LinkedIn message → the AI.
 *
 * A Unipile webhook fires when someone messages Robin. We map the sender to a lead
 * (creating one for a brand-new contact), remember the chat id so replies land in the
 * right thread, and hand the text to the orchestrator. The resulting draft is stored
 * pending human approval; sending happens in outbound.ts.
 */
import { handleInbound, type OrchestratorDeps, type TurnResult } from '../orchestrator.js';
import { parseInbound, type UnipileInboundWebhook } from './unipile.js';

export async function handleUnipileWebhook(
  deps: OrchestratorDeps,
  payload: UnipileInboundWebhook,
): Promise<TurnResult | null> {
  const { chatId, senderId, text, fromSelf } = parseInbound(payload);
  // Unipile echoes the account owner's OWN sent messages back as message_received —
  // ignore them, otherwise the AI keeps replying to itself.
  if (fromSelf || !senderId || !text.trim()) return null;

  let lead = await deps.repo.findLeadByProviderId(senderId);
  if (!lead) {
    lead = await deps.repo.createLead({
      source: 'manual',
      linkedinProviderId: senderId,
      unipileChatId: chatId,
    });
  } else if (!lead.unipileChatId && chatId) {
    lead.unipileChatId = chatId;
    await deps.repo.saveLead(lead);
  }

  return handleInbound(deps, lead.id, text);
}
