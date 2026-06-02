import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'staging', 'production']).default('development'),
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
  HITL_REQUIRED_BEFORE_SEND: z
    .string()
    .default('true')
    .transform((v) => v.toLowerCase() === 'true'),
});

export type Env = z.infer<typeof envSchema>;

let cachedEnv: Env | null = null;

export function loadEnv(): Env {
  if (cachedEnv) return cachedEnv;

  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }

  cachedEnv = parsed.data;
  return cachedEnv;
}
