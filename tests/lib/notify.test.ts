import { notify } from '../../src/lib/notify.js';

const OLD = process.env.ALERT_WEBHOOK_URL;

afterEach(() => {
  if (OLD === undefined) delete process.env.ALERT_WEBHOOK_URL;
  else process.env.ALERT_WEBHOOK_URL = OLD;
});

describe('notify', () => {
  it('does not deliver when no channel is configured, and says so', async () => {
    delete process.env.ALERT_WEBHOOK_URL;
    let called = false;
    const fake = (async () => {
      called = true;
      return new Response('', { status: 200 });
    }) as unknown as typeof fetch;

    expect(await notify({ kind: 'escalation', title: 'x' }, fake)).toBe(false);
    expect(called).toBe(false);
  });

  it('never throws when the alert channel is down — a conversation must not break', async () => {
    process.env.ALERT_WEBHOOK_URL = 'https://example.invalid/hook';
    const exploding = (async () => {
      throw new Error('connection refused');
    }) as unknown as typeof fetch;

    await expect(notify({ kind: 'system', title: 'x' }, exploding)).resolves.toBe(false);
  });

  it('reports a non-2xx response as undelivered', async () => {
    process.env.ALERT_WEBHOOK_URL = 'https://example.invalid/hook';
    const failing = (async () => new Response('nope', { status: 500 })) as unknown as typeof fetch;
    expect(await notify({ kind: 'compliance', title: 'x' }, failing)).toBe(false);
  });
});
