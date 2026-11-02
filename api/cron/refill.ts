/**
 * Weekday-morning refill, before the first daily-cycle run: tops the invite queue up from the
 * search campaigns. Only reads LinkedIn and writes leads; nothing is sent from here.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { appDeps } from '../_app.js';
import { refillQueue } from '../../src/handlers/refill-queue.js';
import { loadEnv } from '../../src/config/env.js';

export default async (req: VercelRequest, res: VercelResponse): Promise<void> => {
  try {
    const env = loadEnv();

    // Vercel Cron authenticates with `Authorization: Bearer $CRON_SECRET`.
    if (env.CRON_SECRET) {
      const auth = req.headers.authorization ?? '';
      if (auth !== `Bearer ${env.CRON_SECRET}`) {
        res.status(401).json({ error: 'unauthorized' });
        return;
      }
    }

    // Searching is still activity on Robin's account, so the emergency stop covers it too.
    if (env.PAUSE_OUTBOUND) {
      res.status(200).json({ ran: false, reason: 'paused' });
      return;
    }

    const deps = appDeps();
    if (!deps.unipile) {
      res.status(200).json({ ran: false, reason: 'unipile not configured' });
      return;
    }

    const result = await refillQueue(
      { repo: deps.repo, unipile: deps.unipile },
      {
        now: () => new Date(),
        target: env.QUEUE_TARGET,
        maxPages: env.REFILL_MAX_PAGES,
        delayMs: () => 800 + Math.floor(Math.random() * 1200),
      },
    );
    res.status(200).json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
};
