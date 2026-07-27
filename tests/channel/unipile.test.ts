import {
  UnipileClient,
  parseInbound,
  firstNameOf,
  publicIdentifierFromUrl,
  parseNewRelation,
} from '../../src/channel/unipile.js';

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

describe('UnipileClient.resolveProfile', () => {
  it('GETs /users/{identifier} with the account_id and returns the provider id', async () => {
    const captured: Captured[] = [];
    const client = new UnipileClient({
      ...cfgBase,
      fetchImpl: stub(captured, { json: { provider_id: 'prov_77', name: 'Felix Schreppel', location: 'Berlin, Germany' } }),
    });
    const res = await client.resolveProfile('felix-schreppel');

    expect(res.ok).toBe(true);
    expect(res.providerId).toBe('prov_77');
    expect(res.name).toBe('Felix Schreppel');
    expect(res.location).toBe('Berlin, Germany');
    expect(captured[0].url).toBe('https://api8.unipile.com:13845/api/v1/users/felix-schreppel?account_id=ACC1');
    expect(captured[0].method).toBe('GET');
    expect(captured[0].headers?.['X-API-KEY']).toBe('KEY123');
  });

  it('fails when the response has no provider id', async () => {
    const client = new UnipileClient({ ...cfgBase, fetchImpl: stub([], { json: {} }) });
    const res = await client.resolveProfile('ghost');
    expect(res.ok).toBe(false);
  });
});

describe('UnipileClient.sendInvitation', () => {
  it('POSTs /users/invite with account_id + provider_id as JSON (blank connect)', async () => {
    const captured: Captured[] = [];
    const client = new UnipileClient({
      ...cfgBase,
      fetchImpl: stub(captured, { json: { invitation_id: 'inv_1' } }),
    });
    const res = await client.sendInvitation('prov_77');

    expect(res.ok).toBe(true);
    expect(res.id).toBe('inv_1');
    expect(captured[0].url).toBe('https://api8.unipile.com:13845/api/v1/users/invite');
    expect(captured[0].method).toBe('POST');
    expect(captured[0].headers?.['content-type']).toBe('application/json');
    expect(JSON.parse(captured[0].body as string)).toEqual({ account_id: 'ACC1', provider_id: 'prov_77' });
  });

  it('returns an error result on a non-ok response', async () => {
    const client = new UnipileClient({ ...cfgBase, fetchImpl: stub([], { ok: false, status: 422, text: 'already invited' }) });
    const res = await client.sendInvitation('p1');
    expect(res.ok).toBe(false);
    expect(res.error).toContain('422');
  });
});

describe('publicIdentifierFromUrl', () => {
  it('extracts the /in/ slug from profile URLs', () => {
    expect(publicIdentifierFromUrl('https://www.linkedin.com/in/felix-schreppel/')).toBe('felix-schreppel');
    expect(publicIdentifierFromUrl('https://linkedin.com/in/max-muster?foo=bar')).toBe('max-muster');
    expect(publicIdentifierFromUrl('linkedin.com/in/jane.doe')).toBe('jane.doe');
  });

  it('returns undefined for a Sales Navigator lead URL or empty input', () => {
    expect(publicIdentifierFromUrl('https://www.linkedin.com/sales/lead/ACwAAA')).toBeUndefined();
    expect(publicIdentifierFromUrl(undefined)).toBeUndefined();
    expect(publicIdentifierFromUrl('')).toBeUndefined();
  });
});

describe('parseNewRelation', () => {
  it('normalises a new_relation webhook to provider id + name', () => {
    const r = parseNewRelation({
      event: 'new_relation',
      account_id: 'ACC1',
      user_provider_id: 'prov_88',
      user_full_name: 'Max Mustermann',
      user_profile_url: 'https://www.linkedin.com/in/max-mustermann',
    });
    expect(r).toEqual({
      providerId: 'prov_88',
      name: 'Max Mustermann',
      profileUrl: 'https://www.linkedin.com/in/max-mustermann',
    });
  });

  it('yields no provider id when the field is absent', () => {
    expect(parseNewRelation({ event: 'new_relation' }).providerId).toBeUndefined();
  });
});

describe('parseInbound', () => {
  it('normalises a webhook payload from a real prospect, including the sender name', () => {
    const r = parseInbound({
      account_id: 'ACC1',
      chat_id: 'c7',
      account_info: { user_id: 'robin_self' },
      sender: { attendee_provider_id: 'lnkd_55', attendee_name: 'Felix Schreppel' },
      message: 'yeah sure',
    });
    expect(r).toEqual({
      accountId: 'ACC1',
      chatId: 'c7',
      senderId: 'lnkd_55',
      senderName: 'Felix Schreppel',
      text: 'yeah sure',
      fromSelf: false,
    });
  });

  it('extracts the Unipile message_id for deduping', () => {
    const r = parseInbound({
      account_id: 'ACC1', chat_id: 'c7', message_id: 'msg-42',
      sender: { attendee_provider_id: 'lnkd_55' }, message: 'hi',
    });
    expect(r.messageId).toBe('msg-42');
  });

  it('firstNameOf takes the first token (or undefined)', () => {
    expect(firstNameOf('Felix Schreppel')).toBe('Felix');
    expect(firstNameOf('  Max  Mustermann ')).toBe('Max');
    expect(firstNameOf(undefined)).toBeUndefined();
    expect(firstNameOf('')).toBeUndefined();
  });

  it('flags the account owner\'s own echoed messages via is_sender', () => {
    const r = parseInbound({
      account_id: 'ACC1',
      chat_id: 'c7',
      is_sender: 1,
      sender: { attendee_provider_id: 'robin_self' },
      message: 'a message Robin sent',
    });
    expect(r.fromSelf).toBe(true);
  });

  it('flags self when account owner id equals the sender id', () => {
    const r = parseInbound({
      account_id: 'ACC1',
      chat_id: 'c7',
      account_info: { user_id: 'robin_self' },
      sender: { attendee_provider_id: 'robin_self' },
      message: 'echoed back',
    });
    expect(r.fromSelf).toBe(true);
  });
});
