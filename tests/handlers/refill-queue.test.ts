import { InMemoryRepository } from '../../src/store/memory.js';
import { refillQueue } from '../../src/handlers/refill-queue.js';
import type { PeopleSearchFilters, SearchPageResult, SearchProfile } from '../../src/channel/unipile.js';
import type { Alert } from '../../src/lib/notify.js';

const NOW = new Date('2026-11-03T06:30:00Z');

function profile(id: string, location = 'Zürich, Schweiz'): SearchProfile {
  return {
    providerId: id,
    name: `Person ${id}`,
    profileUrl: `https://www.linkedin.com/in/${id}`,
    headline: 'Geschäftsführer',
    location,
  };
}

/** Each campaign keyword gets its own list of pages; the cursor is the page index. */
function fakeSearch(byKeyword: Record<string, SearchProfile[][]>, failKeyword?: string) {
  const calls: { keywords?: string; cursor?: string }[] = [];
  return {
    calls,
    searchPeople: async (f: PeopleSearchFilters, o: { cursor?: string } = {}): Promise<SearchPageResult> => {
      calls.push({ keywords: f.keywords, cursor: o.cursor });
      if (f.keywords === failKeyword) return { ok: false, items: [], error: 'Unipile 429: too many searches' };
      const pages = byKeyword[f.keywords ?? ''] ?? [];
      const idx = o.cursor ? Number(o.cursor) : 0;
      return { ok: true, items: pages[idx] ?? [], cursor: idx + 1 < pages.length ? String(idx + 1) : undefined };
    },
  };
}

async function campaign(repo: InMemoryRepository, name: string, keywords: string, lastRunAt?: string) {
  return repo.upsertCampaign({ name, filters: { keywords, location: ['CH'] }, priority: 100, lastRunAt });
}

async function queued(repo: InMemoryRepository, n: number) {
  for (let i = 0; i < n; i += 1) {
    const lead = await repo.createLead({ source: 'cold_outbound', linkedinUrl: `q${i}` });
    lead.linkedinProviderId = `q${i}`;
    await repo.saveLead(lead);
  }
}

const base = { now: () => NOW, target: 3, maxPages: 5, delayMs: () => 0, sleep: async () => {} };

describe('refillQueue', () => {
  it('does nothing while the queue is full enough', async () => {
    const repo = new InMemoryRepository();
    await queued(repo, 3);
    await campaign(repo, 'CH Software', 'founder');
    const unipile = fakeSearch({ founder: [[profile('a')]] });

    const res = await refillQueue({ repo, unipile }, base);

    expect(res.ran).toBe(false);
    expect(unipile.calls).toEqual([]);
  });

  it('tops the queue up from the campaign that ran longest ago and tags the leads', async () => {
    const repo = new InMemoryRepository();
    await campaign(repo, 'recent', 'ceo', '2026-11-02T06:30:00Z');
    const stale = await campaign(repo, 'stale', 'founder', '2026-10-20T06:30:00Z');
    const unipile = fakeSearch({ founder: [[profile('a'), profile('b'), profile('c')], [profile('d')]] });

    const res = await refillQueue({ repo, unipile }, base);

    expect(res.queued).toBe(3);
    expect(unipile.calls.map((c) => c.keywords)).toEqual(['founder']);
    const leads = await repo.listQueuedForInvite(10);
    expect(leads.every((l) => l.campaignId === stale.id)).toBe(true);
    // German opener for a Swiss profile.
    expect(leads[0].brain.language).toBe('de');
    const after = (await repo.listRunnableCampaigns()).find((c) => c.id === stale.id);
    expect(after?.cursor).toBe('1');
    expect(after?.lastRunAt).toBe(NOW.toISOString());
  });

  it('moves on to the next campaign when one runs dry, and retires the dry one', async () => {
    const repo = new InMemoryRepository();
    const dry = await campaign(repo, 'small', 'founder', '2026-10-01T00:00:00Z');
    await campaign(repo, 'big', 'ceo', '2026-10-02T00:00:00Z');
    const unipile = fakeSearch({ founder: [[profile('a')]], ceo: [[profile('b'), profile('c')]] });

    const res = await refillQueue({ repo, unipile }, base);

    expect(res.queued).toBe(3);
    expect((await repo.listRunnableCampaigns()).map((c) => c.id)).not.toContain(dry.id);
  });

  it('stays within the page budget for one run', async () => {
    const repo = new InMemoryRepository();
    await campaign(repo, 'thin', 'founder');
    // Every page holds only already-known people, so the target is never reached.
    const pages = Array.from({ length: 10 }, (_, i) => [profile(`known${i}`)]);
    for (let i = 0; i < 10; i += 1) {
      const known = await repo.createLead({ source: 'cold_outbound', linkedinUrl: `https://www.linkedin.com/in/known${i}` });
      known.stage = 'invited'; // known, but not in the queue
      await repo.saveLead(known);
    }
    const unipile = fakeSearch({ founder: pages });

    await refillQueue({ repo, unipile }, { ...base, maxPages: 2 });

    expect(unipile.calls).toHaveLength(2);
  });

  it('alerts and keeps the cursor when the search fails', async () => {
    const repo = new InMemoryRepository();
    const c = await campaign(repo, 'CH', 'founder');
    const alerts: Alert[] = [];
    const unipile = fakeSearch({}, 'founder');

    const res = await refillQueue({ repo, unipile, alert: async (a) => void alerts.push(a) }, base);

    expect(res.error).toContain('429');
    expect(alerts[0]?.kind).toBe('system');
    const after = (await repo.listRunnableCampaigns()).find((x) => x.id === c.id);
    expect(after?.cursor).toBeUndefined();
  });

  it('alerts when every campaign has run dry, so the queue does not silently empty', async () => {
    const repo = new InMemoryRepository();
    const alerts: Alert[] = [];

    const res = await refillQueue({ repo, unipile: fakeSearch({}), alert: async (a) => void alerts.push(a) }, base);

    expect(res.queued).toBe(0);
    expect(alerts[0]?.title).toContain('Kampagne');
  });
});
