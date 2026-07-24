/**
 * Trigger A CLI: import a Sales Navigator CSV -> throttled LinkedIn connection requests.
 *
 *   npm run import:leads -- path/to/list.csv            # send invites (up to the daily cap)
 *   npm run import:leads -- path/to/list.csv --dry-run  # resolve + preview, send nothing
 *   npm run import:leads -- path/to/list.csv --cap=15   # override the per-run cap
 *
 * The CSV is a third-party Sales Nav export (Evaboot / PhantomBuster / …). We only need a
 * regular profile URL per row; first/full name are used to personalise the opener later.
 */
import { readFileSync } from 'node:fs';
import { parse } from 'csv-parse/sync';
import { loadEnv } from '../src/config/env.js';
import { createSupabaseRepoFromEnv } from '../src/store/supabase.js';
import { createUnipileFromEnv } from '../src/channel/index.js';
import { importColdLeads, type ColdLeadRow } from '../src/handlers/import-cold-leads.js';
import { logger } from '../src/lib/logger.js';

/** First matching column value (headers normalised to lowercase). */
function pick(row: Record<string, string>, candidates: string[]): string | undefined {
  for (const c of candidates) {
    const v = row[c];
    if (v && v.trim()) return v.trim();
  }
  return undefined;
}

function toRows(csv: string): ColdLeadRow[] {
  const records = parse(csv, { columns: (h: string[]) => h.map((c) => c.trim().toLowerCase()), skip_empty_lines: true, trim: true }) as Record<string, string>[];
  const rows: ColdLeadRow[] = [];
  for (const r of records) {
    const linkedinUrl = pick(r, ['profileurl', 'profile url', 'linkedinprofileurl', 'linkedin url', 'linkedinurl', 'url', 'profile', 'linkedin']);
    if (!linkedinUrl) continue;
    rows.push({
      linkedinUrl,
      firstName: pick(r, ['firstname', 'first name', 'first']),
      fullName: pick(r, ['fullname', 'full name', 'name']),
    });
  }
  return rows;
}

function parseArgs(argv: string[]): { file?: string; dryRun: boolean; cap?: number } {
  const positional = argv.filter((a) => !a.startsWith('--'));
  const dryRun = argv.includes('--dry-run');
  let cap: number | undefined;
  const eq = argv.find((a) => a.startsWith('--cap='));
  if (eq) cap = Number(eq.slice('--cap='.length));
  else {
    const i = argv.indexOf('--cap');
    if (i >= 0 && argv[i + 1]) cap = Number(argv[i + 1]);
  }
  return { file: positional[0], dryRun, cap: Number.isFinite(cap) ? cap : undefined };
}

async function main(): Promise<void> {
  const { file, dryRun, cap: capFlag } = parseArgs(process.argv.slice(2));
  if (!file) {
    console.error('Usage: npm run import:leads -- <list.csv> [--dry-run] [--cap=N]');
    process.exit(1);
  }

  const env = loadEnv();
  const unipile = createUnipileFromEnv();
  if (!unipile) {
    console.error('✗ Unipile not configured (UNIPILE_API_KEY / UNIPILE_DSN / UNIPILE_LINKEDIN_ACCOUNT_ID).');
    process.exit(1);
  }

  const rows = toRows(readFileSync(file, 'utf8'));
  const cap = capFlag ?? env.COLD_INVITE_DAILY_CAP ?? env.LINKEDIN_DMS_PER_DAY_LIMIT;
  const { LINKEDIN_RANDOMIZATION_MIN_MS: min, LINKEDIN_RANDOMIZATION_MAX_MS: max } = env;
  const delayMs = (): number => Math.floor(min + Math.random() * Math.max(0, max - min));

  logger.info({ file, rows: rows.length, cap, dryRun }, 'import.start');
  const result = await importColdLeads({ repo: createSupabaseRepoFromEnv(), unipile }, rows, {
    cap,
    dryRun,
    delayMs,
  });

  console.log(
    `${dryRun ? '[dry-run] ' : ''}done — ${result.invited} invited, ${result.skipped} skipped, ${result.failed} failed (of ${result.total}).`,
  );
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
