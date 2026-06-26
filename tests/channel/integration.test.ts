import { InMemoryRepository } from '../../src/store/memory.js';
import { handleOpener, handleInbound, type OrchestratorDeps } from '../../src/orchestrator.js';
import { handleUnipileWebhook, approveMessage, dispatchApprovedForLead } from '../../src/channel/index.js';
import type { UnipileClient } from '../../src/channel/index.js';
import type { FlowNode, InboundUnderstanding, LeadRecord } from '../../src/brain/types.js';

const VARS = (lead: LeadRecord) => ({
  firstName: lead.firstName ?? 'there',
  bookingLink: 'https://www.crypto-gameplan.com/booking',
  walkthroughLink: 'https://crypto-gameplan.com',
});

const SCRIPT: Partial<Record<FlowNode, InboundUnderstanding>> = {
  welcome: { intent: 'agree' },
};

function makeDeps(repo: InMemoryRepository): OrchestratorDeps {
  return {
    repo,
    hitlRequired: true,
    vars: VARS,
    classify: async ({ node }) => SCRIPT[node] ?? { intent: 'other' },
    generate: async ({ canonical }) => canonical,
  };
}

function fakeUnipile() {
  const calls = { send: [] as { chatId: string; text: string }[], start: [] as { attendeeId: string; text: string }[] };
  const client = {
    sendInChat: async (chatId: string, text: string) => {
      calls.send.push({ chatId, text });
      return { ok: true, id: 'm1' };
    },
    startChat: async (attendeeId: string, text: string) => {
      calls.start.push({ attendeeId, text });
      return { ok: true, id: 'cNew', chatId: 'cNew' };
    },
  };
  return { calls, client: client as unknown as UnipileClient };
}

describe('inbound webhook → AI → reply via Unipile', () => {
  it('maps the sender to a lead, drafts a reply, and sends it once approved', async () => {
    const repo = new InMemoryRepository();
    const deps = makeDeps(repo);

    const turn = await handleUnipileWebhook(deps, {
      account_id: 'ACC',
      chat_id: 'chatX',
      sender: { attendee_provider_id: 'p1' },
      message: 'yes sure',
    });

    // Welcome-first: a lead who DMs cold gets the warm opener before the screen.
    expect(turn?.node).toBe('welcome');
    const lead = await repo.findLeadByProviderId('p1');
    expect(lead?.unipileChatId).toBe('chatX');

    const pending = await repo.pendingApprovals();
    expect(pending.length).toBe(1);

    // Human approves -> dispatch sends it into the existing chat.
    await approveMessage(repo, pending[0].id);
    const uni = fakeUnipile();
    const res = await dispatchApprovedForLead({ repo, unipile: uni.client }, lead!.id);

    expect(res.sent).toBe(1);
    expect(uni.calls.send[0].chatId).toBe('chatX');
    expect(uni.calls.send[0].text).toContain('happy to share more on CGP');
    expect((await repo.messagesForLead(lead!.id)).find((m) => m.direction === 'outbound')?.status).toBe('sent');

    // Their next reply advances into the qualification screen.
    const next = await handleInbound(deps, lead!.id, 'yeah lets do it');
    expect(next.node).toBe('q1');
  });
});

describe('cold opener → starts a new chat', () => {
  it('uses startChat for the first message and remembers the new chat id', async () => {
    const repo = new InMemoryRepository();
    const deps = makeDeps(repo);
    const lead = await repo.createLead({ source: 'cold_outbound', firstName: 'Max', linkedinProviderId: 'p2' });

    const turn = await handleOpener(deps, lead.id);
    await approveMessage(repo, turn.draft!.id);

    const uni = fakeUnipile();
    const res = await dispatchApprovedForLead({ repo, unipile: uni.client }, lead.id);

    expect(res.sent).toBe(1);
    expect(uni.calls.start[0].attendeeId).toBe('p2');
    expect(uni.calls.start[0].text).toContain('Hi Max');
    expect((await repo.getLead(lead.id))?.unipileChatId).toBe('cNew');
  });
});
