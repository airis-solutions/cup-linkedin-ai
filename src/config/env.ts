import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'staging', 'production', 'test']).default('development'),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),

  ANTHROPIC_API_KEY: z.string().min(1, 'ANTHROPIC_API_KEY required'),
  CLAUDE_BRAIN_MODEL: z.string().default('claude-opus-4-7'),
  CLAUDE_ROUTER_MODEL: z.string().default('claude-haiku-4-5-20251001'),

  SUPABASE_URL: z.string().url('SUPABASE_URL must be a valid URL'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, 'SUPABASE_SERVICE_ROLE_KEY required'),
  SUPABASE_ANON_KEY: z.string().min(1, 'SUPABASE_ANON_KEY required'),

  UNIPILE_API_KEY: z.string().optional(),
  UNIPILE_DSN: z.string().optional(),
  UNIPILE_LINKEDIN_ACCOUNT_ID: z.string().optional(),

  GHL_PRIVATE_INTEGRATION_TOKEN: z.string().optional(),
  GHL_LOCATION_ID: z.string().optional(),
  GHL_SMART_LIST_EXISTING_CUSTOMERS_ID: z.string().optional(),

  TYPEFORM_PERSONAL_TOKEN: z.string().optional(),
  TYPEFORM_FORM_ID_LEAD_MAGNET: z.string().optional(),
  TYPEFORM_FORM_ID_APPLICATION: z.string().optional(),

  WEBHOOK_BASE_URL: z.string().url().optional(),
  WEBHOOK_SHARED_SECRET: z.string().optional(),

  LINKEDIN_DMS_PER_DAY_LIMIT: z.coerce.number().int().positive().default(30),
  LINKEDIN_RANDOMIZATION_MIN_MS: z.coerce.number().int().nonnegative().default(45000),
  LINKEDIN_RANDOMIZATION_MAX_MS: z.coerce.number().int().nonnegative().default(180000),
  /** Trigger A: max cold connection requests per import run. Start low, ramp slowly
   * (LinkedIn caps invites ~100-200/week). Defaults to LINKEDIN_DMS_PER_DAY_LIMIT. */
  COLD_INVITE_DAILY_CAP: z.coerce.number().int().positive().optional(),

  // ── Daily cycle (the autonomous clock) ──────────────────────────
  /** Hard ceiling on ALL outbound LinkedIn actions per day (invites + messages). */
  DAILY_ACTION_CAP: z.coerce.number().int().positive().default(20),
  /** Invites per cycle run, so one run never dumps the whole day at once. */
  INVITES_PER_RUN: z.coerce.number().int().positive().default(5),
  /** Sending window in SEND_TIMEZONE — nothing leaves outside it. */
  SEND_WINDOW_START_HOUR: z.coerce.number().int().min(0).max(23).default(9),
  SEND_WINDOW_END_HOUR: z.coerce.number().int().min(1).max(24).default(18),
  SEND_TIMEZONE: z.string().default('Europe/Berlin'),
  SEND_ON_WEEKENDS: z
    .string()
    .default('false')
    .transform((v) => v.toLowerCase() === 'true'),
  /** Hours of silence before the follow-up engine touches a lead. */
  FOLLOWUP_HOURS: z.coerce.number().int().positive().default(24),
  /** Shared secret for the cron endpoint (Vercel sends it as a bearer token). */
  CRON_SECRET: z.string().optional(),
  /** Emergency stop: when true the daily cycle does nothing at all. */
  PAUSE_OUTBOUND: z
    .string()
    .default('false')
    .transform((v) => v.toLowerCase() === 'true'),

  HITL_REQUIRED_BEFORE_SEND: z
    .string()
    .default('true')
    .transform((v) => v.toLowerCase() === 'true'),
});

export type Env = z.infer<typeof envSchema>;

let cachedEnv: Env | null = null;

export function loadEnv(): Env {
  if (cachedEnv) return cachedEnv;

  // Treat empty-string env vars (e.g. `WEBHOOK_BASE_URL=` in .env) as unset, so optional
  // fields don't fail validation.
  const cleaned = Object.fromEntries(Object.entries(process.env).filter(([, v]) => v !== ''));
  const parsed = envSchema.safeParse(cleaned);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }

  cachedEnv = parsed.data;
  return cachedEnv;
}
