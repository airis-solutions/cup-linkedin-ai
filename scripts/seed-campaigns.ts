/**
 * Create or update the DACH search campaigns the morning refill pages through.
 *
 *   npm run seed:campaigns            # dry run: shows what each filter matches at LinkedIn
 *   npm run seed:campaigns -- --apply # saves them
 *
 * Filter names are resolved to LinkedIn's ids here, once, so a renamed industry shows up as a
 * visible mismatch now instead of a silently wrong search later. Re-running is safe: campaigns
 * are matched by name and keep their place in the search (cursor) and their exhausted flag.
 *
 * Targeting per docs/business/general-info/sales-nav-targeting.md: seniority via one keyword per
 * campaign, two-to-three industries at most, never "crypto" or "investor" as a keyword.
 * Lower priority runs first among campaigns that have never run; Switzerland leads.
 */
import 'dotenv/config';
import { createSupabaseRepoFromEnv } from '../src/store/supabase.js';
import { createUnipileFromEnv } from '../src/channel/index.js';
import type { SearchParameter, UnipileClient } from '../src/channel/unipile.js';

interface CampaignSpec {
  name: string;
  location: string;
  industry: string[];
  keywords: string;
  priority: number;
}

const CAMPAIGNS: CampaignSpec[] = [
  { name: 'CH · Software · Founder', location: 'Switzerland', industry: ['Software Development'], keywords: 'founder', priority: 10 },
  { name: 'CH · IT-Services · CEO', location: 'Switzerland', industry: ['IT Services and IT Consulting'], keywords: 'ceo', priority: 10 },
  { name: 'CH · Consulting · Partner', location: 'Switzerland', industry: ['Business Consulting and Services'], keywords: 'partner', priority: 10 },
  { name: 'CH · Immobilien · Geschäftsführer', location: 'Switzerland', industry: ['Real Estate'], keywords: 'geschäftsführer', priority: 20 },
  { name: 'CH · Arztpraxen · Inhaber', location: 'Switzerland', industry: ['Medical Practices'], keywords: 'inhaber', priority: 20 },
  { name: 'CH · Recht · Partner', location: 'Switzerland', industry: ['Law Practice'], keywords: 'partner', priority: 20 },
  { name: 'AT · Software · Geschäftsführer', location: 'Austria', industry: ['Software Development'], keywords: 'geschäftsführer', priority: 30 },
  { name: 'AT · Consulting · Geschäftsführer', location: 'Austria', industry: ['Business Consulting and Services'], keywords: 'geschäftsführer', priority: 30 },
  { name: 'DE · Software · Gründer', location: 'Germany', industry: ['Software Development'], keywords: 'gründer', priority: 40 },
  { name: 'DE · Consulting · Geschäftsführer', location: 'Germany', industry: ['Business Consulting and Services'], keywords: 'geschäftsführer', priority: 40 },
  { name: 'DE · Immobilien · Geschäftsführer', location: 'Germany', industry: ['Real Estate'], keywords: 'geschäftsführer', priority: 40 },
  { name: 'DE · Arztpraxen · Inhaber', location: 'Germany', industry: ['Medical Practices'], keywords: 'inhaber', priority: 40 },
];

/** Resolve one filter name, cached: the same country is looked up once, not per campaign. */
function resolver(unipile: UnipileClient) {
  const cache = new Map<string, Promise<SearchParameter | undefined>>();
  return (type: 'LOCATION' | 'INDUSTRY', name: string): Promise<SearchParameter | undefined> => {
    const key = `${type}:${name}`;
    if (!cache.has(key)) {
      cache.set(
        key,
        unipile.searchParameters(type, name).then((res) => {
          if (!res.ok) {
            console.error(`  ✗ ${type} "${name}": ${res.error}`);
            return undefined;
          }
          const hit = res.items[0];
          if (!hit) {
            console.error(`  ✗ ${type} "${name}": kein Treffer bei LinkedIn`);
            return undefined;
          }
          const note = hit.title.toLowerCase() === name.toLowerCase() ? '' : '   ⚠ nächster Treffer, prüfen';
          console.log(`  ${type === 'LOCATION' ? 'Region ' : 'Branche'}  "${name}" → ${hit.title}${note}`);
          return hit;
        }),
      );
    }
    return cache.get(key) as Promise<SearchParameter | undefined>;
  };
}

async function main(): Promise<void> {
  const apply = process.argv.includes('--apply');

  const unipile = createUnipileFromEnv();
  if (!unipile) {
    console.error('✗ Unipile nicht konfiguriert (UNIPILE_API_KEY / UNIPILE_DSN / UNIPILE_LINKEDIN_ACCOUNT_ID).');
    process.exit(1);
  }
  const resolve = resolver(unipile);
  const repo = apply ? createSupabaseRepoFromEnv() : undefined;

  let failed = 0;
  for (const spec of CAMPAIGNS) {
    console.log(`\n${spec.name}  (Priorität ${spec.priority}, Stichwort "${spec.keywords}")`);
    const location = await resolve('LOCATION', spec.location);
    const industries = await Promise.all(spec.industry.map((i) => resolve('INDUSTRY', i)));
    if (!location || industries.some((i) => !i)) {
      failed += 1;
      console.error('  → übersprungen, ein Filter ließ sich nicht auflösen');
      continue;
    }

    const filters = {
      keywords: spec.keywords,
      location: [location.id],
      industry: industries.map((i) => (i as SearchParameter).id),
      networkDistance: [2],
    };
    if (repo) {
      await repo.upsertCampaign({ name: spec.name, filters, priority: spec.priority });
      console.log('  ✓ gespeichert');
    }
  }

  console.log(
    `\n${CAMPAIGNS.length - failed} von ${CAMPAIGNS.length} Kampagnen ${apply ? 'gespeichert' : 'aufgelöst'}` +
      (failed ? `, ${failed} übersprungen` : '') +
      '.',
  );
  if (!apply) console.log('Trockenlauf. Wenn die Treffer passen: npm run seed:campaigns -- --apply\n');
}

await main();
