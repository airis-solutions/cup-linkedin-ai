import { buildView, loadDashboard } from '../../src/handlers/dashboard.js';
import { InMemoryRepository } from '../../src/store/memory.js';
import type { RawStats } from '../../src/store/repository.js';

const TUESDAY_10 = new Date('2026-08-11T08:00:00Z');
const SUNDAY_10 = new Date('2026-08-09T08:00:00Z');

const OPTS = { days: 7, paused: false, approvalRequired: true, cycle: { dailyCap: 20 } };

function raw(over: Partial<RawStats> = {}): RawStats {
  return {
    funnel: {},
    queueWaitingForInvite: 0,
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

describe('dashboard view', () => {
  it('reports rates as null when there is nothing to divide by', () => {
    // An empty pipeline must not read as "0 % acceptance" — that is a different claim.
    const v = buildView(raw(), OPTS, TUESDAY_10);
    expect(v.totals.acceptanceRate).toBeNull();
    expect(v.totals.bookingRate).toBeNull();
    expect(v.period.replyRate).toBeNull();
  });

  it('computes acceptance and booking rates', () => {
    const v = buildView(raw({ invitesTotal: 40, invitesAccepted: 14, bookedTotal: 7 }), OPTS, TUESDAY_10);
    expect(v.totals.acceptanceRate).toBe(35);
    expect(v.totals.bookingRate).toBe(50);
  });

  it('counts everyone past the opener as in conversation, and qualified cumulatively', () => {
    const v = buildView(
      raw({ funnel: { opener_sent: 3, qualifying: 5, qualified: 2, booking_offered: 1, booked: 4 } }),
      OPTS,
      TUESDAY_10,
    );
    expect(v.totals.inConversation).toBe(8);
    expect(v.totals.qualified).toBe(7); // qualified + booking_offered + booked
  });

  it('shows the sending window as closed on a Sunday', () => {
    expect(buildView(raw(), OPTS, SUNDAY_10).system.sendWindowOpen).toBe(false);
    expect(buildView(raw(), OPTS, TUESDAY_10).system.sendWindowOpen).toBe(true);
  });

  it('tracks the remaining daily budget', () => {
    const v = buildView(raw({ actionsUsedToday: 12 }), OPTS, TUESDAY_10);
    expect(v.today).toMatchObject({ actionsUsed: 12, actionsCap: 20, actionsLeft: 8 });
  });

  it('reads real repository counters end to end', async () => {
    const repo = new InMemoryRepository();
    const a = await repo.createLead({ source: 'cold_outbound', firstName: 'A' });
    a.invitedAt = new Date().toISOString();
    a.stage = 'qualifying';
    await repo.saveLead(a);
    await repo.createLead({ source: 'cold_outbound', firstName: 'B' }); // still queued

    const v = await loadDashboard(repo, OPTS, TUESDAY_10);

    expect(v.queue.waitingForInvite).toBe(1);
    expect(v.totals.invitesSent).toBe(1);
    expect(v.totals.invitesAccepted).toBe(1);
    expect(v.funnel.find((f) => f.stage === 'qualifying')?.count).toBe(1);
  });
});
