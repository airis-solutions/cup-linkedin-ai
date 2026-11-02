import { route, type AppDeps } from '../src/server.js';
import { InMemoryRepository } from '../src/store/memory.js';
import type { UnipileClient } from '../src/channel/index.js';
import type { FlowNode, InboundUnderstanding, LeadRecord, MessageRecord } from '../src/brain/types.js';

const SCRIPT: Partial<Record<FlowNode, InboundUnderstanding>> = { welcome: { intent: 'agree' } };

function fakeUnipile() {
  const send: { chatId: string; text: string }[] = [];
  const client = {
    sendInChat: async (chatId: string, text: string) => {
      send.push({ chatId, text });
      return { ok: true, id: 'm1' };
    },
    startChat: async () => ({ ok: true, id: 'c', chatId: 'c' }),
  };
  return { send, client: client as unknown as UnipileClient };
}

const TOKEN = 'dash-token';
const AUTH = { 'x-dashboard-token': TOKEN };

function makeDeps(repo: InMemoryRepository, unipile: UnipileClient | null, webhookSecret?: string): AppDeps {
  return {
    repo,
    unipile,
    webhookSecret,
    dashboardToken: TOKEN,
    sendGate: async () => true,
    hitlRequired: true,
    vars: (lead: LeadRecord) => ({
      firstName: lead.firstName ?? 'there',
      bookingLink: 'https://www.crypto-gameplan.com/booking',
      walkthroughLink: 'https://crypto-gameplan.com',
    }),
    classify: async ({ node }) => SCRIPT[node] ?? { intent: 'other' },
    generate: async ({ canonical }) => canonical,
  };
}

const req = (method: string, path: string, body: Record<string, unknown> = {}, headers = {}) => ({
  method,
  path,
  body,
  headers,
});

describe('server routes', () => {
  it('health check', async () => {
    const repo = new InMemoryRepository();
    const r = await route(makeDeps(repo, null), req('GET', '/health'));
    expect(r.status).toBe(200);
  });

  it('webhook → pending → approve → sent', async () => {
    const repo = new InMemoryRepository();
    const uni = fakeUnipile();
    const deps = makeDeps(repo, uni.client);

    const wh = await route(
      deps,
      req('POST', '/webhooks/unipile', {
        account_id: 'ACC',
        chat_id: 'chatX',
        sender: { attendee_provider_id: 'p1' },
        message: 'yes please',
      }),
    );
    expect(wh.status).toBe(200);
    const leadId = (wh.json as { leadId: string }).leadId;
    expect(leadId).toBeTruthy();

    const pend = await route(deps, req('GET', '/pending', {}, AUTH));
    const list = pend.json as MessageRecord[];
    expect(list.length).toBe(1);

    const appr = await route(deps, req('POST', '/approve', { messageId: list[0].id, leadId }, AUTH));
    expect(appr.status).toBe(200);
    expect((appr.json as { dispatched: { sent: number } }).dispatched.sent).toBe(1);
    expect(uni.send[0].chatId).toBe('chatX');
  });

  it('rejects webhook without the shared secret', async () => {
    const repo = new InMemoryRepository();
    const deps = makeDeps(repo, null, 's3cret');
    const r = await route(deps, req('POST', '/webhooks/unipile', { account_id: 'A', chat_id: 'c' }));
    expect(r.status).toBe(401);
  });

  it('GHL booking webhook marks a matching lead booked', async () => {
    const repo = new InMemoryRepository();
    const lead = await repo.createLead({ source: 'manual', firstName: 'Chris' });
    lead.email = 'chris@example.com';
    lead.stage = 'booking_offered';
    lead.brain = { ...lead.brain, node: 'send_link' };
    await repo.saveLead(lead);

    const deps = makeDeps(repo, null);
    const r = await route(deps, req('POST', '/webhooks/ghl', { email: 'chris@example.com', status: 'confirmed' }));

    expect(r.status).toBe(200);
    expect((r.json as { booking: { status: string } }).booking.status).toBe('booked');
    expect((await repo.getLead(lead.id))?.stage).toBe('booked');
  });

  describe('approval endpoints', () => {
    /** A lead with one draft waiting for approval. */
    async function leadWithDraft(repo: InMemoryRepository): Promise<{ leadId: string; messageId: string }> {
      const lead = await repo.createLead({ source: 'cold_outbound', firstName: 'Anna' });
      lead.unipileChatId = 'chat-a';
      await repo.saveLead(lead);
      const m = await repo.appendMessage({ leadId: lead.id, direction: 'outbound', status: 'pending_hitl', body: 'Hi Anna' });
      return { leadId: lead.id, messageId: m.id };
    }

    it.each([
      ['GET', '/pending'],
      ['POST', '/approve'],
      ['POST', '/reject'],
    ])('%s %s refuses a request without the dashboard token', async (method, path) => {
      const repo = new InMemoryRepository();
      const { leadId, messageId } = await leadWithDraft(repo);
      const r = await route(makeDeps(repo, fakeUnipile().client), req(method, path, { leadId, messageId }));
      expect(r.status).toBe(401);
      expect((await repo.messagesForLead(leadId))[0].status).toBe('pending_hitl');
    });

    it('fails closed when no dashboard token is configured', async () => {
      const repo = new InMemoryRepository();
      const deps = { ...makeDeps(repo, null), dashboardToken: undefined };
      const r = await route(deps, req('GET', '/pending', {}, AUTH));
      expect(r.status).toBe(503);
    });

    it('approves without sending when the send gate is closed (night, weekend, budget spent)', async () => {
      const repo = new InMemoryRepository();
      const uni = fakeUnipile();
      const { leadId, messageId } = await leadWithDraft(repo);
      const deps = { ...makeDeps(repo, uni.client), sendGate: async () => false };

      const r = await route(deps, req('POST', '/approve', { messageId, leadId }, AUTH));

      expect(r.status).toBe(200);
      expect(uni.send).toEqual([]);
      // Stays approved, so the next cycle run inside the window picks it up.
      expect((await repo.messagesForLead(leadId))[0].status).toBe('approved');
    });
  });
});
