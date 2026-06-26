import { loadEnv } from './config/env.js';
import { logger } from './lib/logger.js';
import { classifyInbound } from './brain/classify.js';
import { generateReply } from './brain/voice.js';
import { createSupabaseRepoFromEnv } from './store/supabase.js';
import { createUnipileFromEnv } from './channel/index.js';
import { startServer, type AppDeps } from './server.js';
import type { LeadRecord } from './store/repository.js';

// Canonical destinations (see docs/business/links.md).
const BOOKING_LINK = 'https://www.crypto-gameplan.com/booking';
const WALKTHROUGH_LINK = 'https://crypto-gameplan.com';

async function main(): Promise<void> {
  const env = loadEnv();
  const unipile = createUnipileFromEnv();

  logger.info(
    {
      node_env: env.NODE_ENV,
      brain_model: env.CLAUDE_BRAIN_MODEL,
      hitl_enabled: env.HITL_REQUIRED_BEFORE_SEND,
      linkedin: unipile ? 'connected' : 'not configured (set UNIPILE_* in .env)',
    },
    'cgp-linkedin-ai starting',
  );

  const deps: AppDeps = {
    repo: createSupabaseRepoFromEnv(),
    classify: classifyInbound,
    generate: generateReply,
    hitlRequired: env.HITL_REQUIRED_BEFORE_SEND,
    vars: (lead: LeadRecord) => ({
      firstName: lead.firstName ?? 'there',
      bookingLink: BOOKING_LINK,
      walkthroughLink: WALKTHROUGH_LINK,
    }),
    unipile,
    webhookSecret: env.WEBHOOK_SHARED_SECRET,
  };

  const port = Number(process.env.PORT ?? 3000);
  startServer(deps, port);
}

main().catch((err) => {
  logger.fatal({ err }, 'fatal error during startup');
  process.exit(1);
});
