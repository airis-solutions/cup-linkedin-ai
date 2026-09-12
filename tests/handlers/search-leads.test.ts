import { searchLeads, DEFAULT_HEADLINE_EXCLUSIONS } from '../../src/handlers/search-leads.js';
import type { PeopleSearchFilters, SearchPageResult, SearchProfile } from '../../src/channel/unipile.js';
import type { LeadRecord } from '../../src/store/repository.js';

function profile(n: number, over: Partial<SearchProfile> = {}): SearchProfile {
  return {
    providerId: `ACo${n}`,
    name: `Person ${n}`,
    profileUrl: `https://www.linkedin.com/in/person-${n}`,
    headline: 'Managing Director',
    location: 'Zurich, Switzerland',
    networkDistance: 'DISTANCE_2',
    ...over,
  };
}

/** Unipile stub that serves fixed pages and records the filters it was called with. */
function fakeUnipile(pages: SearchProfile[][], opts: { failOn?: number } = {}) {
  const calls: { filters: PeopleSearchFilters; cursor?: string; limit?: number }[] = [];
  return {
    calls,
    searchPeople: async (
      filters: PeopleSearchFilters,
      o: { cursor?: string; limit?: number } = {},
    ): Promise<SearchPageResult> => {
      calls.push({ filters, cursor: o.cursor, limit: o.limit });
      const idx = o.cursor ? Number(o.cursor) : 0;
      if (opts.failOn === idx) return { ok: false, items: [], error: 'Unipile 429: slow down' };
      const items = pages[idx] ?? [];
      const hasMore = idx + 1 < pages.length;
      return { ok: true, items, cursor: hasMore ? String(idx + 1) : undefined };
    },
  };
}

/** Repo stub: every URL in `known` counts as an existing lead. */
function fakeRepo(known: string[] = []) {
  return {
    findLeadByLinkedinUrl: async (url: string): Promise<LeadRecord | null> =>
      known.includes(url) ? ({ id: 'existing' } as LeadRecord) : null,
  };
}

const noSleep = { delayMs: () => 0, sleep: async (): Promise<void> => undefined };

describe('searchLeads', () => {
  it('collects candidates across pages and stops once the target is met', async () => {
    const unipile = fakeUnipile([
      [profile(1), profile(2), profile(3)],
      [profile(4), profile(5), profile(6)],
      [profile(7)],
    ]);
    const res = await searchLeads(
      { repo: fakeRepo(), unipile },
      { filters: { keywords: 'director' }, target: 5, pageSize: 3, ...noSleep },
    );

    expect(res.candidates).toHaveLength(5);
    expect(res.pages).toBe(2); // third page never requested
    expect(res.short).toBe(false);
    expect(unipile.calls[1].cursor).toBe('1'); // paged on with the cursor
    expect(unipile.calls[0].limit).toBe(3);
  });

  it('carries the provider id and profile url through, so the import can skip resolving', async () => {
    const unipile = fakeUnipile([[profile(1)]]);
    const res = await searchLeads(
      { repo: fakeRepo(), unipile },
      { filters: {}, target: 1, ...noSleep },
    );

    expect(res.candidates[0]).toMatchObject({
      providerId: 'ACo1',
      linkedinUrl: 'https://www.linkedin.com/in/person-1',
      fullName: 'Person 1',
      firstName: 'Person',
      location: 'Zurich, Switzerland',
    });
  });

  it('drops the crypto and finance professionals the ICP rules out', async () => {
    const unipile = fakeUnipile([
      [
        profile(1, { headline: 'Crypto Expert | Country Director' }),
        profile(2, { headline: 'Day Trading Coach' }),
        profile(3, { headline: 'Partner at a Venture Capital fund' }),
        profile(4, { headline: 'Finanzberater' }),
        profile(5, { headline: 'Managing Director, Engineering' }),
      ],
    ]);
    const res = await searchLeads(
      { repo: fakeRepo(), unipile },
      { filters: {}, target: 10, ...noSleep },
    );

    expect(res.candidates.map((c) => c.providerId)).toEqual(['ACo5']);
    expect(res.excluded).toBe(4);
  });

  it('keeps a founder who merely invests — "investor" alone is not a disqualifier', async () => {
    const unipile = fakeUnipile([[profile(1, { headline: 'Technologist | Engineer | Investor' })]]);
    const res = await searchLeads(
      { repo: fakeRepo(), unipile },
      { filters: {}, target: 5, ...noSleep },
    );

    expect(res.candidates).toHaveLength(1);
    expect(res.excluded).toBe(0);
  });

  it('skips profiles that are already leads in the database', async () => {
    const unipile = fakeUnipile([[profile(1), profile(2)]]);
    const res = await searchLeads(
      { repo: fakeRepo(['https://www.linkedin.com/in/person-1']), unipile },
      { filters: {}, target: 5, ...noSleep },
    );

    expect(res.candidates.map((c) => c.providerId)).toEqual(['ACo2']);
    expect(res.known).toBe(1);
  });

  it('does not list the same person twice when pages overlap', async () => {
    const unipile = fakeUnipile([[profile(1), profile(2)], [profile(2), profile(3)]]);
    const res = await searchLeads(
      { repo: fakeRepo(), unipile },
      { filters: {}, target: 10, ...noSleep },
    );

    expect(res.candidates.map((c) => c.providerId)).toEqual(['ACo1', 'ACo2', 'ACo3']);
    expect(res.unusable).toBe(1);
  });

  it('rebuilds the profile url from the public identifier when LinkedIn omits it', async () => {
    const unipile = fakeUnipile([
      [profile(1, { profileUrl: undefined, publicIdentifier: 'robin-ritter' })],
    ]);
    const res = await searchLeads({ repo: fakeRepo(), unipile }, { filters: {}, target: 1, ...noSleep });

    expect(res.candidates[0].linkedinUrl).toBe('https://www.linkedin.com/in/robin-ritter');
  });

  it('stops at the page bound instead of paging forever on a wide filter', async () => {
    const many = Array.from({ length: 6 }, (_, i) => [profile(i + 1, { headline: 'Crypto trader' })]);
    const unipile = fakeUnipile(many);
    const res = await searchLeads(
      { repo: fakeRepo(), unipile },
      { filters: {}, target: 50, maxPages: 3, ...noSleep },
    );

    expect(res.pages).toBe(3);
    expect(res.candidates).toHaveLength(0);
    expect(res.short).toBe(true);
  });

  it('keeps what it already found when a page fails, and reports the error', async () => {
    const unipile = fakeUnipile([[profile(1), profile(2)], [profile(3)]], { failOn: 1 });
    const res = await searchLeads(
      { repo: fakeRepo(), unipile },
      { filters: {}, target: 10, ...noSleep },
    );

    expect(res.candidates).toHaveLength(2);
    expect(res.error).toContain('429');
  });

  it('defaults the exclusions but honours an empty list', async () => {
    const unipile = fakeUnipile([[profile(1, { headline: 'Crypto trader' })]]);
    const res = await searchLeads(
      { repo: fakeRepo(), unipile },
      { filters: {}, target: 5, excludeHeadline: [], ...noSleep },
    );

    expect(res.candidates).toHaveLength(1);
    expect(DEFAULT_HEADLINE_EXCLUSIONS.length).toBeGreaterThan(0);
  });
});
