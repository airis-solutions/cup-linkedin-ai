// Shared deps + adapter for the Vercel serverless functions.
// (Files prefixed with "_" are not treated as routes by Vercel.)
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { route, type AppDeps } from '../src/server.js';
import { classifyInbound } from '../src/brain/classify.js';
import { createSupabaseRepoFromEnv } from '../src/store/supabase.js';
import { createUnipileFromEnv } from '../src/channel/index.js';
import { loadEnv } from '../src/config/env.js';
import type { LeadRecord } from '../src/store/repository.js';

const BOOKING_LINK = 'https://www.crypto-gameplan.com/booking';
const WALKTHROUGH_LINK = 'https://crypto-gameplan.com';

let cached: AppDeps | undefined;

function deps(): AppDeps {
  if (cached) return cached;
  const env = loadEnv();
  cached = {
    repo: createSupabaseRepoFromEnv(),
    classify: classifyInbound,
    hitlRequired: env.HITL_REQUIRED_BEFORE_SEND,
    vars: (lead: LeadRecord) => ({
      firstName: lead.firstName ?? 'there',
      bookingLink: BOOKING_LINK,
      walkthroughLink: WALKTHROUGH_LINK,
    }),
    unipile: createUnipileFromEnv(),
    webhookSecret: env.WEBHOOK_SHARED_SECRET,
  };
  return cached;
}

/** Adapt a Vercel (req,res) to the shared pure router for the given canonical path. */
export async function handle(req: VercelRequest, res: VercelResponse, path: string): Promise<void> {
  const body = req.body && typeof req.body === 'object' ? (req.body as Record<string, unknown>) : {};
  const result = await route(deps(), {
    method: req.method ?? 'GET',
    path,
    body,
    headers: req.headers as Record<string, string | undefined>,
  });
  res.status(result.status).json(result.json);
}
