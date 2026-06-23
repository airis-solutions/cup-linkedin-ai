// Applies supabase/migrations/*.sql (tracked, run-once). Needs SUPABASE_DB_URL in .env.
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const env = Object.fromEntries(
  readFileSync(join(root, '.env'), 'utf8')
    .split('\n')
    .filter((l) => l && !l.trimStart().startsWith('#') && l.includes('='))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);

const url = env.SUPABASE_DB_URL;
if (!url) {
  console.error('✗ SUPABASE_DB_URL fehlt in .env (Supabase → Connect → Session pooler → URI).');
  process.exit(1);
}

const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await client.connect();
await client.query('create table if not exists _migrations (name text primary key, run_at timestamptz default now())');

const dir = join(root, 'supabase', 'migrations');
for (const file of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
  const done = await client.query('select 1 from _migrations where name = $1', [file]);
  if (done.rowCount) {
    console.log('· skip', file);
    continue;
  }
  console.log('· run ', file);
  await client.query(readFileSync(join(dir, file), 'utf8'));
  await client.query('insert into _migrations(name) values ($1)', [file]);
}

await client.end();
console.log('✓ migrate done');
