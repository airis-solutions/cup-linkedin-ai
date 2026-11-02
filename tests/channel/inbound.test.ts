import { InMemoryRepository } from '../../src/store/memory.js';
import { handleUnipileWebhook } from '../../src/channel/inbound.js';
import type { OrchestratorDeps } from '../../src/orchestrator.js';
import type { LeadRecord } from '../../src/store/repository.js';

function deps(repo: InMemoryRepository, classify: OrchestratorDeps['classify']): OrchestratorDeps {
  return {
    repo,
    hitlRequired: true,
    classify,
    generate: async ({ canonical }) => canonical,
    vars: (lead: LeadRecord) => ({
      firstName: lead.firstName ?? 'there',
      bookingLink: 'https://www.crypto-gameplan.com/booking',
      walkthroughLink: 'https://crypto-gameplan.com',
    }),
  };
}

const webhook = {
  account_id: 'ACC',
  chat_id: 'chat1',
  message_id: 'msg-1',
  sender: { attendee_provider_id: 'p1', attendee_name: 'Anna Muster' },
  message: 'Hallo Robin, klingt spannend',
};

describe('inbound webhook retries', () => {
  it('processes a redelivered message whose first attempt crashed', async () => {
    const repo = new InMemoryRepository();
    let calls = 0;
    const flaky: OrchestratorDeps['classify'] = async () => {
      calls += 1;
      if (calls === 1) throw new Error('Claude 529 overloaded');
      return { intent: 'agree' };
    };

    await expect(handleUnipileWebhook(deps(repo, flaky), webhook)).rejects.toThrow('overloaded');
    const turn = await handleUnipileWebhook(deps(repo, flaky), webhook);

    expect(turn?.draft).toBeDefined();
    const msgs = await repo.messagesForLead(turn!.leadId);
    // One inbound row, not two, and it ends up processed.
    expect(msgs.filter((m) => m.direction === 'inbound').map((m) => m.status)).toEqual(['received']);
  });

  it('still ignores a redelivery of a message that was processed fine', async () => {
    const repo = new InMemoryRepository();
    const ok: OrchestratorDeps['classify'] = async () => ({ intent: 'agree' });

    await handleUnipileWebhook(deps(repo, ok), webhook);
    const again = await handleUnipileWebhook(deps(repo, ok), webhook);

    expect(again).toBeNull();
  });
});
