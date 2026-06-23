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

function makeDeps(repo: InMemoryRepository, unipile: UnipileClient | null, webhookSecret?: string): AppDeps {
  return {
    repo,
    unipile,
    webhookSecret,
    hitlRequired: true,
    vars: (lead: LeadRecord) => ({
      firstName: lead.firstName ?? 'there',
      bookingLink: 'https://www.crypto-gameplan.com/booking',
      walkthroughLink: 'https://crypto-gameplan.com',
    }),
    classify: async ({ node }) => SCRIPT[node] ?? { intent: 'other' },
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

    const pend = await route(deps, req('GET', '/pending'));
    const list = pend.json as MessageRecord[];
    expect(list.length).toBe(1);

    const appr = await route(deps, req('POST', '/approve', { messageId: list[0].id, leadId }));
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
});
