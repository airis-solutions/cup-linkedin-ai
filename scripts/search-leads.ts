/**
 * Build a cold list straight from LinkedIn — no Sales Navigator, no third-party exporter.
 *
 *   npm run search:leads -- --location "Switzerland" --industry "Software Development" \
 *                           --keywords "director" --count 60
 *
 * Writes a CSV that `npm run import:leads` reads as-is. Nothing is sent and no lead is created
 * here: the point is that a human looks at the list before it goes anywhere.
 *
 * Deliberately a separate step from the import. Building a list is cheap and repeatable;
 * inviting people is neither.
 */
import 'dotenv/config';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { createSupabaseRepoFromEnv } from '../src/store/supabase.js';
import { createUnipileFromEnv } from '../src/channel/index.js';
import { searchLeads, DEFAULT_HEADLINE_EXCLUSIONS, type SearchCandidate } from '../src/handlers/search-leads.js';
import type { SearchParameter, UnipileClient } from '../src/channel/unipile.js';

interface Args {
  location: string[];
  industry: string[];
  keywords?: string;
  count: number;
  distance: number[];
  out?: string;
  pages?: number;
  keepAll: boolean;
}

/** `--flag value` and `--flag=value`, repeatable, plus comma-separated lists. */
function parseArgs(argv: string[]): Args {
  const get = (name: string): string[] => {
    const out: string[] = [];
    for (let i = 0; i < argv.length; i += 1) {
      const a = argv[i];
      if (a === `--${name}` && argv[i + 1] && !argv[i + 1].startsWith('--')) out.push(argv[i + 1]);
      else if (a.startsWith(`--${name}=`)) out.push(a.slice(name.length + 3));
    }
    return out.flatMap((v) => v.split(',').map((s) => s.trim())).filter(Boolean);
  };
  const num = (name: string, fallback?: number): number | undefined => {
    const v = get(name)[0];
    const n = v === undefined ? NaN : Number(v);
    return Number.isFinite(n) ? n : fallback;
  };

  return {
    location: get('location'),
    industry: get('industry'),
    keywords: get('keywords').join(' ') || undefined,
    count: num('count', 60) as number,
    distance: get('distance').map(Number).filter(Number.isFinite),
    out: get('out')[0],
    pages: num('pages'),
    keepAll: argv.includes('--keep-all'),
  };
}

/** Resolve one filter name to a LinkedIn id, reporting what it actually matched. */
async function resolveFilter(
  unipile: UnipileClient,
  type: 'LOCATION' | 'INDUSTRY',
  name: string,
): Promise<SearchParameter | undefined> {
  const res = await unipile.searchParameters(type, name);
  if (!res.ok) {
    console.error(`✗ ${type} "${name}": ${res.error}`);
    return undefined;
  }
  const hit = res.items[0];
  if (!hit) {
    console.error(`✗ ${type} "${name}": kein Treffer bei LinkedIn`);
    return undefined;
  }
  const note = hit.title.toLowerCase() === name.toLowerCase() ? '' : '  (nächster Treffer)';
  console.log(`  ${type === 'LOCATION' ? 'Region ' : 'Branche'}  "${name}" → ${hit.title}${note}`);
  return hit;
}

const CSV_HEADER = ['linkedinUrl', 'firstName', 'fullName', 'headline', 'location', 'networkDistance', 'providerId'];

function csvCell(v: string | undefined): string {
  const s = v ?? '';
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(rows: SearchCandidate[]): string {
  const lines = [CSV_HEADER.join(',')];
  for (const r of rows) {
    lines.push(
      [r.linkedinUrl, r.firstName, r.fullName, r.headline, r.location, r.networkDistance, r.providerId]
        .map(csvCell)
        .join(','),
    );
  }
  return `${lines.join('\n')}\n`;
}

function slug(args: Args): string {
  const parts = [...args.location, ...args.industry, args.keywords].filter(Boolean).join('-');
  return (parts || 'leads').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  if (!args.location.length && !args.industry.length && !args.keywords) {
    console.error(
      'Usage: npm run search:leads -- --location "Switzerland" [--industry "Software Development"]\n' +
        '                             [--keywords "director"] [--count 60] [--distance 2]\n' +
        '                             [--out lists/meine-liste.csv] [--keep-all]\n\n' +
        'Mindestens einer von --location / --industry / --keywords muss gesetzt sein.',
    );
    process.exit(1);
  }

  const unipile = createUnipileFromEnv();
  if (!unipile) {
    console.error('✗ Unipile nicht konfiguriert (UNIPILE_API_KEY / UNIPILE_DSN / UNIPILE_LINKEDIN_ACCOUNT_ID).');
    process.exit(1);
  }

  console.log('\nFilter werden bei LinkedIn nachgeschlagen:');
  const locations = (await Promise.all(args.location.map((n) => resolveFilter(unipile, 'LOCATION', n)))).filter(
    (x): x is SearchParameter => Boolean(x),
  );
  const industries = (await Promise.all(args.industry.map((n) => resolveFilter(unipile, 'INDUSTRY', n)))).filter(
    (x): x is SearchParameter => Boolean(x),
  );
  if (locations.length !== args.location.length || industries.length !== args.industry.length) {
    console.error('\n✗ Mindestens ein Filter konnte nicht aufgelöst werden. Abbruch — sonst suchst du etwas anderes als gemeint.');
    process.exit(1);
  }
  if (args.keywords) console.log(`  Stichwort "${args.keywords}"`);
  const distance = args.distance.length ? args.distance : [2];
  console.log(`  Netzwerk  ${distance.map((d) => `${d}. Grad`).join(', ')}`);
  if (args.keepAll) console.log('  ⚠ ICP-Ausschlüsse AUS (--keep-all): Krypto-/Finanzprofis bleiben in der Liste');

  const repo = createSupabaseRepoFromEnv();
  console.log(`\nSuche läuft, Ziel ${args.count} Profile …`);

  const res = await searchLeads(
    { repo, unipile },
    {
      filters: {
        keywords: args.keywords,
        location: locations.map((l) => l.id),
        industry: industries.map((i) => i.id),
        networkDistance: distance,
      },
      target: args.count,
      maxPages: args.pages,
      excludeHeadline: args.keepAll ? [] : DEFAULT_HEADLINE_EXCLUSIONS,
      delayMs: () => 800 + Math.floor(Math.random() * 1200),
    },
  );

  console.log(
    `\nAngesehen ${res.scanned} · übernommen ${res.candidates.length} · ` +
      `aussortiert ${res.excluded} (ICP) · schon bekannt ${res.known} · unbrauchbar ${res.unusable} · Seiten ${res.pages}`,
  );
  if (res.error) console.error(`⚠ Suche brach ab: ${res.error}`);
  if (res.short && !res.error) {
    console.log('⚠ Weniger Treffer als gewünscht — die Filter sind eng. Weitere Branche oder Region dazunehmen.');
  }
  if (!res.candidates.length) {
    console.log('\nNichts zu schreiben.');
    return;
  }

  for (const c of res.candidates.slice(0, 10)) {
    console.log(`  · ${c.fullName ?? '—'} | ${(c.headline ?? '').slice(0, 58)} | ${c.location ?? '—'}`);
  }
  if (res.candidates.length > 10) console.log(`  … und ${res.candidates.length - 10} weitere`);

  const outPath = resolve(args.out ?? `lists/${slug(args)}.csv`);
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, toCsv(res.candidates), 'utf8');

  console.log(`\n✓ ${res.candidates.length} Profile geschrieben: ${outPath}`);
  console.log('\nSo geht es weiter:');
  console.log('  1. CSV öffnen, Zeilen rauswerfen die nicht passen');
  console.log(`  2. npm run import:leads -- ${args.out ?? `lists/${slug(args)}.csv`} --dry-run`);
  console.log(`  3. npm run import:leads -- ${args.out ?? `lists/${slug(args)}.csv`}`);
  console.log('     (legt die Liste nur in die Warteschlange — die Anfragen tröpfeln über die Tagesläufe raus)\n');
}

await main();
