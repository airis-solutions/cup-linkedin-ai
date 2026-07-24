import { InMemoryRepository } from '../../src/store/memory.js';
import { importColdLeads, languageFromLocation, type ColdLeadRow, type ImportDeps } from '../../src/handlers/import-cold-leads.js';
import type { ResolveResult, SendResult } from '../../src/channel/unipile.js';

/** Configurable Unipile stub: resolves every identifier to `prov_<identifier>` unless overridden. */
function stubUnipile(over?: {
  resolve?: (id: string) => ResolveResult;
  invite?: (providerId: string) => SendResult;
}): { unipile: ImportDeps['unipile']; resolves: string[]; invites: string[] } {
  const resolves: string[] = [];
  const invites: string[] = [];
  const unipile: ImportDeps['unipile'] = {
    async resolveProfile(id) {
      resolves.push(id);
      return over?.resolve ? over.resolve(id) : { ok: true, providerId: `prov_${id}`, name: `Name ${id}` };
    },
    async sendInvitation(providerId) {
      invites.push(providerId);
      return over?.invite ? over.invite(providerId) : { ok: true, id: 'inv' };
    },
  };
  return { unipile, resolves, invites };
}

const row = (slug: string, extra?: Partial<ColdLeadRow>): ColdLeadRow => ({
  linkedinUrl: `https://www.linkedin.com/in/${slug}`,
  ...extra,
});

describe('importColdLeads', () => {
  it('resolves, creates a cold_outbound lead at stage "invited", and sends one invite', async () => {
    const repo = new InMemoryRepository();
    const { unipile, invites } = stubUnipile();

    const res = await importColdLeads({ repo, unipile }, [row('felix', { firstName: 'Felix' })], { cap: 10 });

    expect(res).toMatchObject({ total: 1, invited: 1, skipped: 0, failed: 0, dryRun: false });
    expect(invites).toEqual(['prov_felix']);
    const lead = await repo.findLeadByLinkedinUrl('https://www.linkedin.com/in/felix');
    expect(lead?.source).toBe('cold_outbound');
    expect(lead?.stage).toBe('invited');
    expect(lead?.linkedinProviderId).toBe('prov_felix');
    expect(lead?.firstName).toBe('Felix');
  });

  it('skips a lead that already exists (dedupe by URL) — no invite', async () => {
    const repo = new InMemoryRepository();
    await repo.createLead({ source: 'manual', linkedinUrl: 'https://www.linkedin.com/in/felix' });
    const { unipile, invites, resolves } = stubUnipile();

    const res = await importColdLeads({ repo, unipile }, [row('felix')], { cap: 10 });

    expect(res).toMatchObject({ invited: 0, skipped: 1, failed: 0 });
    expect(invites).toEqual([]);
    expect(resolves).toEqual([]); // deduped before we even resolve
  });

  it('stops inviting once the cap is reached, leaving the rest for the next run', async () => {
    const repo = new InMemoryRepository();
    const { unipile, invites } = stubUnipile();

    const res = await importColdLeads({ repo, unipile }, [row('a'), row('b'), row('c')], { cap: 2 });

    expect(res).toMatchObject({ total: 3, invited: 2, skipped: 1 });
    expect(invites).toHaveLength(2);
  });

  it('counts a row as failed (no lead) when the profile cannot be resolved', async () => {
    const repo = new InMemoryRepository();
    const { unipile, invites } = stubUnipile({ resolve: () => ({ ok: false, error: 'not found' }) });

    const res = await importColdLeads({ repo, unipile }, [row('ghost')], { cap: 10 });

    expect(res).toMatchObject({ invited: 0, failed: 1 });
    expect(invites).toEqual([]);
    expect(await repo.findLeadByLinkedinUrl('https://www.linkedin.com/in/ghost')).toBeNull();
  });

  it('fails a row when the invite is rejected but keeps the lead (stage stays "new")', async () => {
    const repo = new InMemoryRepository();
    const { unipile } = stubUnipile({ invite: () => ({ ok: false, error: 'already invited' }) });

    const res = await importColdLeads({ repo, unipile }, [row('bob')], { cap: 10 });

    expect(res).toMatchObject({ invited: 0, failed: 1 });
    const lead = await repo.findLeadByLinkedinUrl('https://www.linkedin.com/in/bob');
    expect(lead?.stage).toBe('new');
    expect(lead?.linkedinProviderId).toBe('prov_bob');
  });

  it('fails rows with no public identifier (Sales Navigator lead URL)', async () => {
    const repo = new InMemoryRepository();
    const { unipile, resolves } = stubUnipile();

    const res = await importColdLeads({ repo, unipile }, [{ linkedinUrl: 'https://www.linkedin.com/sales/lead/ACwAAA' }], { cap: 10 });

    expect(res).toMatchObject({ invited: 0, failed: 1 });
    expect(resolves).toEqual([]);
  });

  it('sets the opener language from the lead country (DACH -> de, else en)', async () => {
    const repo = new InMemoryRepository();
    const { unipile } = stubUnipile({
      resolve: (id) => ({ ok: true, providerId: `prov_${id}`, location: id === 'de' ? 'Stuttgart, Germany' : 'Austin, Texas, United States' }),
    });
    await importColdLeads({ repo, unipile }, [row('de'), row('us')], { cap: 10 });
    expect((await repo.findLeadByLinkedinUrl('https://www.linkedin.com/in/de'))?.brain.language).toBe('de');
    expect((await repo.findLeadByLinkedinUrl('https://www.linkedin.com/in/us'))?.brain.language).toBe('en');
  });

  it('dry-run resolves and previews without creating leads or sending invites', async () => {
    const repo = new InMemoryRepository();
    const { unipile, invites } = stubUnipile();

    const res = await importColdLeads({ repo, unipile }, [row('a'), row('b')], { cap: 10, dryRun: true });

    expect(res).toMatchObject({ total: 2, invited: 2, failed: 0, dryRun: true });
    expect(invites).toEqual([]);
    expect(await repo.findLeadByLinkedinUrl('https://www.linkedin.com/in/a')).toBeNull();
  });
});

describe('languageFromLocation', () => {
  it('maps DACH locations to German', () => {
    for (const loc of ['Stuttgart, Baden-Württemberg, Germany', 'Wien, Österreich', 'Zürich, Switzerland', 'Vaduz, Liechtenstein']) {
      expect(languageFromLocation(loc)).toBe('de');
    }
  });

  it('maps everything else (and unknown) to English', () => {
    for (const loc of ['Austin, Texas, United States', 'London, United Kingdom', 'Paris, France', undefined, '']) {
      expect(languageFromLocation(loc)).toBe('en');
    }
  });
});
