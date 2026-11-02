import { InMemoryRepository } from '../../src/store/memory.js';
import { inSendWindow, localParts, runDailyCycle, defaultCycleOptions } from '../../src/handlers/daily-cycle.js';
import type { CycleDeps } from '../../src/handlers/daily-cycle.js';
import type { LeadRecord } from '../../src/store/repository.js';
import type { Alert } from '../../src/lib/notify.js';

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

describe('priority when the budget is tight', () => {
  const opts = { invitesPerRun: 5, jitterMs: () => 0, sleep: async () => {} };

  /** A lead mid-conversation with an approved reply waiting to go out. */
  async function leadWithApprovedReply(repo: InMemoryRepository, text: string): Promise<LeadRecord> {
    const lead = await repo.createLead({ source: 'cold_outbound', firstName: 'Anna' });
    lead.stage = 'qualifying';
    lead.unipileChatId = 'chat-open';
    lead.brain = { ...lead.brain, node: 'q2', openerSent: true };
    await repo.saveLead(lead);
    await repo.appendMessage({ leadId: lead.id, direction: 'outbound', status: 'approved', body: text });
    return lead;
  }

  it('answers an open conversation before introducing itself to strangers', async () => {
    const repo = new InMemoryRepository();
    const fake: Fake = { invites: [], sent: [] };
    await leadWithApprovedReply(repo, 'Antwort im laufenden Chat');
    for (const p of ['p1', 'p2', 'p3']) await queueColdLead(repo, p);

    // Budget for exactly one action: the conversation must win it.
    const res = await runDailyCycle(makeDeps(repo, TUESDAY_10, fake), {
      ...opts,
      now: () => TUESDAY_10,
      dailyCap: 1,
    });

    expect(res.dispatched).toBe(1);
    expect(fake.sent).toEqual(['Antwort im laufenden Chat']);
    expect(res.invited).toBe(0);
    expect(fake.invites).toEqual([]);
  });

  it('still invites with whatever budget the conversations leave over', async () => {
    const repo = new InMemoryRepository();
    const fake: Fake = { invites: [], sent: [] };
    await leadWithApprovedReply(repo, 'Antwort');
    for (const p of ['p1', 'p2', 'p3']) await queueColdLead(repo, p);

    const res = await runDailyCycle(makeDeps(repo, TUESDAY_10, fake), {
      ...opts,
      now: () => TUESDAY_10,
      dailyCap: 3,
    });

    expect(res.dispatched).toBe(1);
    expect(res.invited).toBe(2); // 3 budget − 1 reply
  });
});

describe('failing invites', () => {
  const opts = { invitesPerRun: 2, jitterMs: () => 0, sleep: async () => {}, now: () => TUESDAY_10 };

  /** Unipile stub that rejects some provider ids and records every attempt. */
  function depsWithFailures(repo: InMemoryRepository, failing: Set<string>, alerts: Alert[]): CycleDeps {
    const base = makeDeps(repo, TUESDAY_10, { invites: [], sent: [] });
    return {
      ...base,
      alert: async (a) => {
        alerts.push(a);
      },
      unipile: {
        ...base.unipile,
        sendInvitation: async (providerId: string) =>
          failing.has(providerId)
            ? { ok: false as const, error: 'Unipile 422: cannot invite' }
            : { ok: true as const, id: `inv-${providerId}` },
      } as unknown as CycleDeps['unipile'],
    };
  }

  it('does not let a lead that keeps failing block the rest of the queue', async () => {
    // The live bug from 12.10.: the two oldest leads failed every run and nobody behind them
    // was ever invited.
    const repo = new InMemoryRepository();
    for (const p of ['bad1', 'bad2', 'good1', 'good2']) await queueColdLead(repo, p);
    const deps = depsWithFailures(repo, new Set(['bad1', 'bad2']), []);

    await runDailyCycle(deps, { ...opts, dailyCap: 50 });
    const second = await runDailyCycle(deps, { ...opts, dailyCap: 50 });

    expect(second.invited).toBe(2);
  });

  it('takes a lead out of the queue after three failed attempts', async () => {
    const repo = new InMemoryRepository();
    const bad = await queueColdLead(repo, 'bad1');
    const deps = depsWithFailures(repo, new Set(['bad1']), []);

    for (let i = 0; i < 3; i += 1) await runDailyCycle(deps, { ...opts, dailyCap: 50 });

    const after = await repo.getLead(bad.id);
    expect(after?.stage).toBe('invite_failed');
    expect(after?.inviteAttempts).toBe(3);
    expect(await repo.listQueuedForInvite(10)).toEqual([]);
  });

  it('remembers the invitation id so the request can be withdrawn later', async () => {
    const repo = new InMemoryRepository();
    const lead = await queueColdLead(repo, 'good1');

    await runDailyCycle(depsWithFailures(repo, new Set(), []), { ...opts, dailyCap: 50 });

    expect((await repo.getLead(lead.id))?.invitationId).toBe('inv-good1');
  });

  it('raises a system alert when a run tries to invite and nothing goes out', async () => {
    const repo = new InMemoryRepository();
    await queueColdLead(repo, 'bad1');
    const alerts: Alert[] = [];

    const res = await runDailyCycle(depsWithFailures(repo, new Set(['bad1']), alerts), { ...opts, dailyCap: 50 });

    expect(res.invited).toBe(0);
    expect(res.inviteFailures).toBe(1);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].kind).toBe('system');
    expect(alerts[0].detail).toContain('Unipile 422');
  });

  it('stays quiet when invites go out', async () => {
    const repo = new InMemoryRepository();
    await queueColdLead(repo, 'good1');
    const alerts: Alert[] = [];

    await runDailyCycle(depsWithFailures(repo, new Set(), alerts), { ...opts, dailyCap: 50 });

    expect(alerts).toEqual([]);
  });
});

describe('weekly invite cap', () => {
  const opts = { invitesPerRun: 5, dailyCap: 50, jitterMs: () => 0, sleep: async () => {}, now: () => TUESDAY_10 };

  it('stops inviting once the rolling 7-day cap is reached', async () => {
    const repo = new InMemoryRepository(() => TUESDAY_10);
    // Three invites already went out earlier this week.
    for (const p of ['old1', 'old2', 'old3']) {
      const lead = await queueColdLead(repo, p);
      await repo.appendEvent({ leadId: lead.id, kind: 'invite_sent', payload: {} });
      lead.stage = 'invited';
      await repo.saveLead(lead);
    }
    for (const p of ['p1', 'p2', 'p3']) await queueColdLead(repo, p);
    const fake: Fake = { invites: [], sent: [] };

    const res = await runDailyCycle(makeDeps(repo, TUESDAY_10, fake), { ...opts, weeklyInviteCap: 4 });

    expect(res.invited).toBe(1);
    expect(fake.invites).toEqual(['p1']);
  });

  it('only counts invites from the last seven days', async () => {
    const repo = new InMemoryRepository(() => TUESDAY_10);
    const lead = await queueColdLead(repo, 'old');
    await repo.appendEvent({ leadId: lead.id, kind: 'invite_sent', payload: {} });
    lead.stage = 'invited';
    await repo.saveLead(lead);
    await queueColdLead(repo, 'p1');
    const fake: Fake = { invites: [], sent: [] };
    const nextWeek = new Date(TUESDAY_10.getTime() + 8 * 86_400_000);

    const res = await runDailyCycle(makeDeps(repo, nextWeek, fake), { ...opts, now: () => nextWeek, weeklyInviteCap: 1 });

    expect(res.invited).toBe(1);
  });
});
