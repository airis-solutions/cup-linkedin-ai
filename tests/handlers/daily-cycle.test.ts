import { InMemoryRepository } from '../../src/store/memory.js';
import { inSendWindow, localParts, runDailyCycle, defaultCycleOptions } from '../../src/handlers/daily-cycle.js';
import type { CycleDeps } from '../../src/handlers/daily-cycle.js';
import type { LeadRecord } from '../../src/store/repository.js';

const VARS = (lead: LeadRecord) => ({
  firstName: lead.firstName ?? 'there',
  bookingLink: 'https://www.crypto-gameplan.com/booking',
  walkthroughLink: 'https://crypto-gameplan.com',
});

/** Tuesday 2026-08-11, 10:00 Berlin — inside the default window. */
const TUESDAY_10 = new Date('2026-08-11T08:00:00Z');
/** Sunday 2026-08-09, 10:00 Berlin. */
const SUNDAY_10 = new Date('2026-08-09T08:00:00Z');
/** Tuesday 03:00 Berlin. */
const TUESDAY_03 = new Date('2026-08-11T01:00:00Z');

interface Fake {
  invites: string[];
  sent: string[];
}

function makeDeps(repo: InMemoryRepository, now: Date, fake: Fake): CycleDeps {
  return {
    repo,
    hitlRequired: true,
    vars: VARS,
    now: () => now,
    classify: async () => ({ intent: 'other' }),
    generate: async ({ canonical }) => canonical,
    unipile: {
      sendInvitation: async (providerId: string) => {
        fake.invites.push(providerId);
        return { ok: true as const };
      },
      sendInChat: async (chatId: string, text: string) => {
        fake.sent.push(text);
        return { ok: true as const };
      },
      startChat: async () => ({ ok: true as const, chatId: 'chat1' }),
    } as unknown as CycleDeps['unipile'],
  };
}

async function queueColdLead(repo: InMemoryRepository, providerId: string): Promise<LeadRecord> {
  const lead = await repo.createLead({ source: 'cold_outbound', firstName: 'Max', linkedinUrl: `u-${providerId}` });
  lead.linkedinProviderId = providerId;
  await repo.saveLead(lead);
  return lead;
}

describe('sending window', () => {
  it('is closed at night and on weekends, open in working hours', () => {
    const at = (d: Date) => inSendWindow(defaultCycleOptions({ now: () => d }));
    expect(at(TUESDAY_10)).toBe(true);
    expect(at(TUESDAY_03)).toBe(false);
    expect(at(SUNDAY_10)).toBe(false);
  });

  it('derives the local calendar day for the budget', () => {
    expect(localParts(TUESDAY_10, 'Europe/Berlin').day).toBe('2026-08-11');
  });
});

describe('runDailyCycle', () => {
  const opts = { invitesPerRun: 5, jitterMs: () => 0, sleep: async () => {} };

  it('drips invites to queued cold leads and marks them invited', async () => {
    const repo = new InMemoryRepository();
    const fake: Fake = { invites: [], sent: [] };
    await queueColdLead(repo, 'p1');
    await queueColdLead(repo, 'p2');

    const res = await runDailyCycle(makeDeps(repo, TUESDAY_10, fake), { ...opts, now: () => TUESDAY_10 });

    expect(res.ran).toBe(true);
    expect(res.invited).toBe(2);
    expect(fake.invites).toEqual(['p1', 'p2']);
    expect((await repo.listQueuedForInvite(10)).length).toBe(0);
  });

  it('does nothing outside the sending window', async () => {
    const repo = new InMemoryRepository();
    const fake: Fake = { invites: [], sent: [] };
    await queueColdLead(repo, 'p1');

    const res = await runDailyCycle(makeDeps(repo, TUESDAY_03, fake), { ...opts, now: () => TUESDAY_03 });

    expect(res.ran).toBe(false);
    expect(res.reason).toBe('outside_send_window');
    expect(fake.invites).toEqual([]);
  });

  it('never exceeds the daily cap, even across repeated runs', async () => {
    const repo = new InMemoryRepository();
    const fake: Fake = { invites: [], sent: [] };
    for (const p of ['p1', 'p2', 'p3', 'p4', 'p5']) await queueColdLead(repo, p);

    const deps = makeDeps(repo, TUESDAY_10, fake);
    const cap = { ...opts, now: () => TUESDAY_10, dailyCap: 3 };
    await runDailyCycle(deps, cap);
    await runDailyCycle(deps, cap);
    await runDailyCycle(deps, cap);

    expect(fake.invites.length).toBe(3);
  });

  it('runs the follow-up clock for a due lead and moves the clock forward', async () => {
    const repo = new InMemoryRepository();
    const fake: Fake = { invites: [], sent: [] };
    const lead = await repo.createLead({ source: 'cold_outbound', firstName: 'Max' });
    lead.stage = 'qualifying';
    lead.brain = { ...lead.brain, node: 'q1', openerSent: true };
    lead.nextActionAt = new Date(TUESDAY_10.getTime() - 3_600_000).toISOString();
    await repo.saveLead(lead);

    const res = await runDailyCycle(makeDeps(repo, TUESDAY_10, fake), { ...opts, now: () => TUESDAY_10 });

    expect(res.followUps).toBe(1);
    const after = await repo.getLead(lead.id);
    // Crucial: the lead must no longer be due, or every run would touch it again.
    expect(after?.nextActionAt && after.nextActionAt > TUESDAY_10.toISOString()).toBe(true);
    expect(await repo.listDueForFollowUp(TUESDAY_10.toISOString(), 10)).toEqual([]);
  });

  it('leaves booked and do-not-contact leads alone', async () => {
    const repo = new InMemoryRepository();
    const fake: Fake = { invites: [], sent: [] };
    const booked = await repo.createLead({ source: 'cold_outbound', firstName: 'Chris' });
    booked.stage = 'booked';
    booked.nextActionAt = undefined;
    await repo.saveLead(booked);
    const dnc = await repo.createLead({ source: 'manual', firstName: 'Steven' });
    dnc.doNotContact = true;
    dnc.stage = 'do_not_contact';
    dnc.nextActionAt = new Date(TUESDAY_10.getTime() - 3_600_000).toISOString();
    await repo.saveLead(dnc);

    const res = await runDailyCycle(makeDeps(repo, TUESDAY_10, fake), { ...opts, now: () => TUESDAY_10 });

    expect(res.followUps).toBe(0);
    expect(fake.invites).toEqual([]);
  });
});
