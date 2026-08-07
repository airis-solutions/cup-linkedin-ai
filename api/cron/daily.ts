/**
 * The scheduled heartbeat. Vercel Cron calls this; it is the only thing that makes the
 * system act on its own. Safe to call more often than needed: the sending window, the
 * atomic daily budget and the pause switch all gate it.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { appDeps } from '../_app.js';
import { runDailyCycle } from '../../src/handlers/daily-cycle.js';
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

    if (env.PAUSE_OUTBOUND) {
      res.status(200).json({ ran: false, reason: 'paused' });
      return;
    }

    const result = await runDailyCycle(appDeps(), {
      dailyCap: env.DAILY_ACTION_CAP,
      invitesPerRun: env.INVITES_PER_RUN,
      windowStartHour: env.SEND_WINDOW_START_HOUR,
      windowEndHour: env.SEND_WINDOW_END_HOUR,
      timezone: env.SEND_TIMEZONE,
      includeWeekends: env.SEND_ON_WEEKENDS,
      followUpHours: env.FOLLOWUP_HOURS,
    });

    res.status(200).json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
};
