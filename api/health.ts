import type { VercelRequest, VercelResponse } from '@vercel/node';

// Self-contained liveness + env diagnostic. Does NOT call loadEnv() so it can report
// *which* required vars are missing instead of crashing. Reports presence only — never values.
const REQUIRED = [
  'ANTHROPIC_API_KEY',
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
] as const;

const OPTIONAL = ['UNIPILE_API_KEY', 'UNIPILE_DSN', 'UNIPILE_LINKEDIN_ACCOUNT_ID'] as const;

const present = (k: string): boolean => Boolean(process.env[k] && process.env[k] !== '');

export default (_req: VercelRequest, res: VercelResponse): void => {
  const env: Record<string, boolean | string> = { NODE_ENV: process.env.NODE_ENV ?? '(unset)' };
  for (const k of [...REQUIRED, ...OPTIONAL]) env[k] = present(k);
  const missing = REQUIRED.filter((k) => !present(k));
  res.status(missing.length === 0 ? 200 : 500).json({ ok: missing.length === 0, missing, env });
};
