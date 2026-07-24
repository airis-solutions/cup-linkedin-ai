import { InMemoryRepository } from '../../src/store/memory.js';
import { handleOpener, handleInbound, type OrchestratorDeps } from '../../src/orchestrator.js';
import {
  handleUnipileWebhook,
  handleNewRelation,
  approveMessage,
  dispatchApprovedForLead,
} from '../../src/channel/index.js';
import type { UnipileClient } from '../../src/channel/index.js';
import { importColdLeads } from '../../src/handlers/import-cold-leads.js';
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
      sender: { attendee_provider_id: 'p1', attendee_name: 'Max Mustermann' },
      message: 'yes sure',
    });

    // Welcome-first: a lead who DMs cold gets the warm opener before the screen.
    expect(turn?.node).toBe('welcome');
    const lead = await repo.findLeadByProviderId('p1');
    expect(lead?.unipileChatId).toBe('chatX');
    // The first name is captured from the webhook for booking-link / copy personalisation.
    expect(lead?.firstName).toBe('Max');

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

  it('ignores the account owner\'s own messages echoed back by Unipile', async () => {
    const repo = new InMemoryRepository();
    const deps = makeDeps(repo);

    const turn = await handleUnipileWebhook(deps, {
      account_id: 'ACC',
      chat_id: 'chatX',
      account_info: { user_id: 'robin_self' },
      sender: { attendee_provider_id: 'robin_self' },
      message: 'a reply Robin just sent',
    });

    expect(turn).toBeNull();
    expect(await repo.findLeadByProviderId('robin_self')).toBeNull();
    expect((await repo.pendingApprovals()).length).toBe(0);
  });
});

describe('Trigger A: full chain — cold import → accept → opener → cold DM sent', () => {
  it('imports a Sales Nav row, invites, fires the opener on accept, and sends it once approved', async () => {
    const repo = new InMemoryRepository();
    const deps = makeDeps(repo);

    // Unipile stub spanning both halves: resolve + invite (import) and startChat (dispatch).
    const invited: string[] = [];
    const started: { attendeeId: string; text: string }[] = [];
    const unipile = {
      resolveProfile: async (identifier: string) => ({ ok: true, providerId: `prov_${identifier}`, name: 'Max Mustermann' }),
      sendInvitation: async (providerId: string) => {
        invited.push(providerId);
        return { ok: true, id: 'inv1' };
      },
      startChat: async (attendeeId: string, text: string) => {
        started.push({ attendeeId, text });
        return { ok: true, id: 'cNew', chatId: 'cNew' };
      },
    } as unknown as UnipileClient;

    // 1. Import one Sales Nav lead -> connection request sent, lead sits at 'invited', no message yet.
    const imp = await importColdLeads({ repo, unipile }, [{ linkedinUrl: 'https://www.linkedin.com/in/max-mustermann', firstName: 'Max' }], { cap: 5 });
    expect(imp).toMatchObject({ total: 1, invited: 1, skipped: 0, failed: 0 });
    expect(invited).toEqual(['prov_max-mustermann']);
    const lead = await repo.findLeadByProviderId('prov_max-mustermann');
    expect(lead?.stage).toBe('invited');
    expect((await repo.pendingApprovals()).length).toBe(0);

    // 2. They accept the request -> new_relation webhook fires the warm opener (pending approval).
    const turn = await handleNewRelation(deps, { user_provider_id: 'prov_max-mustermann', user_full_name: 'Max Mustermann' });
    expect(turn?.leadId).toBe(lead!.id);
    const pending = await repo.pendingApprovals();
    expect(pending.length).toBe(1);

    // 3. Human approves -> dispatch opens the cold chat with the opener, personalised to the lead.
    await approveMessage(repo, pending[0].id);
    const res = await dispatchApprovedForLead({ repo, unipile }, lead!.id);
    expect(res.sent).toBe(1);
    expect(started[0].attendeeId).toBe('prov_max-mustermann');
    expect(started[0].text).toContain('Hi Max');
    expect((await repo.getLead(lead!.id))?.unipileChatId).toBe('cNew');
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
