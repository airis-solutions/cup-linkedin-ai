import { InMemoryRepository } from '../../src/store/memory.js';
import { buildDailyReport, sendDailyReport } from '../../src/handlers/daily-report.js';
import type { Alert } from '../../src/lib/notify.js';
import type { CampaignStats, RawStats } from '../../src/store/repository.js';

const NOW = new Date('2026-11-03T17:00:00Z'); // Tuesday, 18:00 in Berlin

function raw(over: Partial<RawStats> = {}): RawStats {
  return {
    funnel: {},
    queueWaitingForInvite: 74,
    pendingApprovals: 0,
    actionsUsedToday: 0,
    eventsSince: {},
    leadsCreatedSince: 0,
    messagesSentSince: 0,
    repliesSince: 0,
    invitesTotal: 0,
    invitesAccepted: 0,
    bookedTotal: 0,
    ...over,
  };
}

function campaign(name: string, invited: number, accepted: number, over: Partial<CampaignStats> = {}): CampaignStats {
  return { name, active: true, exhausted: false, queued: 5, invited, accepted, replied: 0, booked: 0, ...over };
}

const base = { now: NOW, timezone: 'Europe/Berlin', weeklyInviteCap: 40 };

describe('buildDailyReport', () => {
  it('leads with today in plain numbers', () => {
    const r = buildDailyReport({
      ...base,
      today: raw({ eventsSince: { invite_sent: 8, opener_sent: 2 }, repliesSince: 3, messagesSentSince: 1 }),
      weekInvites: 23,
      campaigns: [],
    });
    expect(r.title).toContain('03.11.');
    expect(r.detail).toContain('8 Anfragen raus');
    expect(r.detail).toContain('2 angenommen');
    expect(r.detail).toContain('3 Antworten');
    expect(r.detail).toContain('74 Leads');
    expect(r.detail).toContain('23/40');
  });

  it('puts drafts waiting for a human first, so they are not missed', () => {
    const r = buildDailyReport({ ...base, today: raw({ pendingApprovals: 2 }), weekInvites: 0, campaigns: [] });
    expect(r.detail?.split('\n')[0]).toContain('2 Entwürfe warten auf Freigabe');
  });

  it('shows the acceptance rate per campaign once there is enough data, best first', () => {
    const r = buildDailyReport({
      ...base,
      today: raw(),
      weekInvites: 0,
      campaigns: [campaign('CH · Software · Founder', 20, 4), campaign('CH · Recht · Partner', 20, 8), campaign('AT · Software', 3, 1)],
    });
    const lines = r.detail?.split('\n') ?? [];
    const recht = lines.findIndex((l) => l.includes('CH · Recht'));
    const software = lines.findIndex((l) => l.includes('CH · Software'));
    expect(recht).toBeGreaterThan(-1);
    expect(recht).toBeLessThan(software);
    expect(lines[recht]).toContain('40 %');
    // Three invites say nothing yet.
    expect(lines.find((l) => l.includes('AT · Software'))).toContain('zu früh');
  });

  it('warns when the queue is about to run dry or campaigns are exhausted', () => {
    const r = buildDailyReport({
      ...base,
      today: raw({ queueWaitingForInvite: 6 }),
      weekInvites: 0,
      campaigns: [campaign('dry', 10, 2, { exhausted: true })],
    });
    expect(r.detail).toContain('⚠️');
    expect(r.detail).toContain('leergelaufen');
  });

  it('reports failed invites, but only when there are any', () => {
    const quiet = buildDailyReport({ ...base, today: raw(), weekInvites: 0, campaigns: [] });
    expect(quiet.detail).not.toContain('gescheitert');
    const loud = buildDailyReport({ ...base, today: raw({ eventsSince: { invite_failed: 2 } }), weekInvites: 0, campaigns: [] });
    expect(loud.detail).toContain('2 Anfragen gescheitert');
  });
});

describe('sendDailyReport', () => {
  it('sends one report alert built from the store', async () => {
    const repo = new InMemoryRepository(() => NOW);
    const alerts: Alert[] = [];

    await sendDailyReport({ repo, alert: async (a) => void alerts.push(a) }, base);

    expect(alerts).toHaveLength(1);
    expect(alerts[0].kind).toBe('report');
  });
});

describe('acceptance counting', () => {
  it('does not count withdrawn, failed or held invites as accepted', async () => {
    const repo = new InMemoryRepository(() => NOW);
    const c = await repo.upsertCampaign({ name: 'CH', filters: {}, priority: 1 });
    for (const stage of ['invited', 'invite_expired', 'invite_failed', 'on_hold', 'opener_sent', 'qualifying'] as const) {
      const lead = await repo.createLead({ source: 'cold_outbound', linkedinUrl: stage, campaignId: c.id });
      lead.stage = stage;
      lead.invitedAt = NOW.toISOString();
      await repo.saveLead(lead);
    }

    expect((await repo.dashboardStats(NOW.toISOString(), '2026-11-03')).invitesAccepted).toBe(2);
    const [stats] = await repo.campaignStats();
    expect(stats).toMatchObject({ name: 'CH', invited: 6, accepted: 2 });
  });
});
