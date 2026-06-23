import { loadEnv } from '../config/env.js';
import { UnipileClient } from './unipile.js';

export * from './unipile.js';
export * from './inbound.js';
export * from './outbound.js';

/** Build the Unipile client from env, or null if LinkedIn isn't configured yet. */
export function createUnipileFromEnv(): UnipileClient | null {
  const env = loadEnv();
  if (!env.UNIPILE_API_KEY || !env.UNIPILE_DSN || !env.UNIPILE_LINKEDIN_ACCOUNT_ID) {
    return null;
  }
  return new UnipileClient({
    dsn: env.UNIPILE_DSN,
    apiKey: env.UNIPILE_API_KEY,
    accountId: env.UNIPILE_LINKEDIN_ACCOUNT_ID,
  });
}
