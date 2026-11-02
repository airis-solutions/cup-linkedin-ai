/**
 * Evening summary to Telegram. Reads only; runs on weekends too, since accepts and replies
 * keep coming in when nothing is sent.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { appDeps } from '../_app.js';
import { sendDailyReport } from '../../src/handlers/daily-report.js';
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

    const report = await sendDailyReport(
      { repo: appDeps().repo },
      { now: new Date(), timezone: env.SEND_TIMEZONE, weeklyInviteCap: env.WEEKLY_INVITE_CAP },
    );
    res.status(200).json(report);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
};
