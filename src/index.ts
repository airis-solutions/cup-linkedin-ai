import { loadEnv } from './config/env.js';
import { logger } from './lib/logger.js';

async function main(): Promise<void> {
  const env = loadEnv();
  logger.info(
    {
      node_env: env.NODE_ENV,
      brain_model: env.CLAUDE_BRAIN_MODEL,
      router_model: env.CLAUDE_ROUTER_MODEL,
      hitl_enabled: env.HITL_REQUIRED_BEFORE_SEND,
      daily_limit: env.LINKEDIN_DMS_PER_DAY_LIMIT,
    },
    'cgp-linkedin-ai starting',
  );

  logger.info('scaffold ready — integrations next');
}

main().catch((err) => {
  logger.fatal({ err }, 'fatal error during startup');
  process.exit(1);
});
