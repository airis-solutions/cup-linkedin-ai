/**
 * Approved drafts → LinkedIn.
 *
 * After a human approves a pending message, it is sent via Unipile. The first message to
 * a cold lead has no chat yet, so we start the chat (which also gives us the chat id to
 * remember for the rest of the conversation); replies go into the existing chat.
 */
import type { Repository } from '../store/repository.js';
import type { UnipileClient } from './unipile.js';

/** Mark a pending message approved (the human said yes). */
export async function approveMessage(repo: Repository, messageId: string): Promise<void> {
  await repo.setMessageStatus(messageId, 'approved');
}

/** Mark a pending message skipped (the human said no). */
export async function rejectMessage(repo: Repository, messageId: string): Promise<void> {
  await repo.setMessageStatus(messageId, 'skipped');
}

export interface DispatchResult {
  sent: number;
  failed: number;
}

export interface DispatchDeps {
  repo: Repository;
  unipile: UnipileClient;
}

/** Send every approved outbound message for a lead via Unipile, oldest first. */
export async function dispatchApprovedForLead(deps: DispatchDeps, leadId: string): Promise<DispatchResult> {
  const lead = await deps.repo.getLead(leadId);
  if (!lead) return { sent: 0, failed: 0 };

  const messages = (await deps.repo.messagesForLead(leadId))
    .filter((m) => m.direction === 'outbound' && m.status === 'approved')
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  let chatId = lead.unipileChatId;
  let sent = 0;
  let failed = 0;

  for (const m of messages) {
    let result;
    if (!chatId && lead.linkedinProviderId) {
      // First touch to a cold lead — start the conversation.
      result = await deps.unipile.startChat(lead.linkedinProviderId, m.body);
      if (result.ok && result.chatId) {
        chatId = result.chatId;
        lead.unipileChatId = chatId;
        await deps.repo.saveLead(lead);
      }
    } else if (chatId) {
      result = await deps.unipile.sendInChat(chatId, m.body);
    } else {
      failed += 1;
      continue;
    }

    if (result.ok) {
      await deps.repo.setMessageStatus(m.id, 'sent');
      sent += 1;
    } else {
      await deps.repo.setMessageStatus(m.id, 'failed');
      failed += 1;
    }
  }

  return { sent, failed };
}
