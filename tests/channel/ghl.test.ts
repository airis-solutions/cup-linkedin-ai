import { GhlClient } from '../../src/channel/ghl.js';
import { GHL } from '../../src/config/ghl.js';

type Captured = { url: string; method?: string; body?: string; headers?: Record<string, string> };

function stub(captured: Captured[], response: { ok?: boolean; status?: number; json?: unknown; text?: string }) {
  return async (url: string, init?: { method?: string; headers?: Record<string, string>; body?: string }) => {
    captured.push({ url, method: init?.method, body: init?.body, headers: init?.headers });
    return {
      ok: response.ok ?? true,
      status: response.status ?? 200,
      json: async () => response.json ?? {},
      text: async () => response.text ?? '',
    };
  };
}

const cfg = (fetchImpl: ReturnType<typeof stub>) => ({ token: 'pit-x', locationId: 'LOC1', fetchImpl });

describe('GhlClient.upsertContact', () => {
  it('POSTs to /contacts/upsert with the location and returns the contact id', async () => {
    const cap: Captured[] = [];
    const ghl = new GhlClient(cfg(stub(cap, { json: { contact: { id: 'c1' }, new: true } })));
    const res = await ghl.upsertContact({ firstName: 'Max', email: 'max@x.com', tags: ['src:linkedin'] });

    expect(res.ok).toBe(true);
    expect(res.data).toEqual({ id: 'c1', isNew: true });
    expect(cap[0].url).toBe('https://services.leadconnectorhq.com/contacts/upsert');
    expect(cap[0].method).toBe('POST');
    expect(cap[0].headers?.Authorization).toBe('Bearer pit-x');
    const body = JSON.parse(cap[0].body ?? '{}');
    expect(body.locationId).toBe('LOC1');
    expect(body.firstName).toBe('Max');
    expect(body.tags).toEqual(['src:linkedin']);
  });

  it('returns an error result on a non-ok response', async () => {
    const ghl = new GhlClient(cfg(stub([], { ok: false, status: 401, text: 'bad token' })));
    const res = await ghl.upsertContact({ email: 'x@y.com' });
    expect(res.ok).toBe(false);
    expect(res.error).toContain('401');
  });
});

describe('GhlClient.createOpportunity', () => {
  it('POSTs to /opportunities/ with the pipeline + stage + contact', async () => {
    const cap: Captured[] = [];
    const ghl = new GhlClient(cfg(stub(cap, { json: { opportunity: { id: 'o1' } } })));
    const res = await ghl.createOpportunity({ name: 'Max', pipelineStageId: GHL.stages.qualified, contactId: 'c1' });

    expect(res.ok).toBe(true);
    expect(res.data?.id).toBe('o1');
    const body = JSON.parse(cap[0].body ?? '{}');
    expect(body.pipelineId).toBe(GHL.pipelineId);
    expect(body.pipelineStageId).toBe(GHL.stages.qualified);
    expect(body.contactId).toBe('c1');
    expect(body.status).toBe('open');
  });
});

describe('GhlClient.getFreeSlots', () => {
  it('flattens the day-grouped slot response and ignores traceId', async () => {
    const json = {
      '2026-07-01': { slots: ['2026-07-01T09:00:00+02:00', '2026-07-01T09:30:00+02:00'] },
      '2026-07-02': { slots: ['2026-07-02T10:00:00+02:00'] },
      traceId: 'abc',
    };
    const cap: Captured[] = [];
    const ghl = new GhlClient(cfg(stub(cap, { json })));
    const res = await ghl.getFreeSlots(1000, 2000, 'Europe/Berlin');

    expect(res.ok).toBe(true);
    expect(res.data).toEqual([
      '2026-07-01T09:00:00+02:00',
      '2026-07-01T09:30:00+02:00',
      '2026-07-02T10:00:00+02:00',
    ]);
    expect(cap[0].url).toContain(`/calendars/${GHL.bookingCalendarId}/free-slots`);
    expect(cap[0].url).toContain('timezone=Europe%2FBerlin');
  });
});

describe('GhlClient.bookAppointment', () => {
  it('POSTs the appointment with calendar + contact + start time', async () => {
    const cap: Captured[] = [];
    const ghl = new GhlClient(cfg(stub(cap, { json: { id: 'a1' } })));
    const res = await ghl.bookAppointment({
      contactId: 'c1',
      startTime: '2026-07-01T09:00:00+02:00',
      timezone: 'Europe/Berlin',
    });

    expect(res.ok).toBe(true);
    expect(res.data?.id).toBe('a1');
    expect(cap[0].url).toBe('https://services.leadconnectorhq.com/calendars/events/appointments');
    const body = JSON.parse(cap[0].body ?? '{}');
    expect(body.calendarId).toBe(GHL.bookingCalendarId);
    expect(body.contactId).toBe('c1');
    expect(body.startTime).toBe('2026-07-01T09:00:00+02:00');
  });
});
