import { UnipileClient, parseInbound } from '../../src/channel/unipile.js';

type Captured = { url: string; method?: string; headers?: Record<string, string>; body?: unknown };

function stub(captured: Captured[], response: { ok?: boolean; status?: number; json?: unknown; text?: string }) {
  return async (url: string, init?: { method?: string; headers?: Record<string, string>; body?: unknown }) => {
    captured.push({ url, method: init?.method, headers: init?.headers, body: init?.body });
    return {
      ok: response.ok ?? true,
      status: response.status ?? 200,
      json: async () => response.json ?? {},
      text: async () => response.text ?? '',
    };
  };
}

const cfgBase = { dsn: 'api8.unipile.com:13845', apiKey: 'KEY123', accountId: 'ACC1' };

describe('UnipileClient.sendInChat', () => {
  it('POSTs to the chat messages endpoint with the API key and text', async () => {
    const captured: Captured[] = [];
    const client = new UnipileClient({ ...cfgBase, fetchImpl: stub(captured, { json: { message_id: 'm1' } }) });
    const res = await client.sendInChat('chat42', 'hey there');

    expect(res.ok).toBe(true);
    expect(res.id).toBe('m1');
    expect(captured[0].url).toBe('https://api8.unipile.com:13845/api/v1/chats/chat42/messages');
    expect(captured[0].method).toBe('POST');
    expect(captured[0].headers?.['X-API-KEY']).toBe('KEY123');
    expect((captured[0].body as FormData).get('text')).toBe('hey there');
  });

  it('returns an error result on a non-ok response', async () => {
    const client = new UnipileClient({ ...cfgBase, fetchImpl: stub([], { ok: false, status: 429, text: 'rate limited' }) });
    const res = await client.sendInChat('c1', 'x');
    expect(res.ok).toBe(false);
    expect(res.error).toContain('429');
  });
});

describe('UnipileClient.startChat', () => {
  it('POSTs to /chats with account_id, attendee and text', async () => {
    const captured: Captured[] = [];
    const client = new UnipileClient({ ...cfgBase, fetchImpl: stub(captured, { json: { chat_id: 'newchat' } }) });
    const res = await client.startChat('attendee9', 'Hi Daniel, Robin here.');

    expect(res.ok).toBe(true);
    expect(res.chatId).toBe('newchat');
    expect(captured[0].url).toBe('https://api8.unipile.com:13845/api/v1/chats');
    const form = captured[0].body as FormData;
    expect(form.get('account_id')).toBe('ACC1');
    expect(form.get('attendees_ids')).toBe('attendee9');
    expect(form.get('text')).toBe('Hi Daniel, Robin here.');
  });
});

describe('parseInbound', () => {
  it('normalises a webhook payload', () => {
    const r = parseInbound({
      account_id: 'ACC1',
      chat_id: 'c7',
      sender: { attendee_provider_id: 'lnkd_55' },
      message: 'yeah sure',
    });
    expect(r).toEqual({ accountId: 'ACC1', chatId: 'c7', senderId: 'lnkd_55', text: 'yeah sure' });
  });
});
