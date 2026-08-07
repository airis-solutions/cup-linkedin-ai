/**
 * Dashboard data. Gated behind DASHBOARD_TOKEN — this returns a client's pipeline, so it
 * fails closed: no token configured means no access, never open access.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createSupabaseRepoFromEnv } from '../src/store/supabase.js';
import { loadDashboard } from '../src/handlers/dashboard.js';
import { loadEnv } from '../src/config/env.js';

export default async (req: VercelRequest, res: VercelResponse): Promise<void> => {
  try {
    const env = loadEnv();
    if (!env.DASHBOARD_TOKEN) {
      res.status(503).json({ error: 'dashboard not configured (set DASHBOARD_TOKEN)' });
      return;
    }
    const supplied = (req.headers['x-dashboard-token'] as string) ?? (req.query.token as string) ?? '';
    if (supplied !== env.DASHBOARD_TOKEN) {
      res.status(401).json({ error: 'unauthorized' });
      return;
    }

    const days = Math.min(90, Math.max(1, Number(req.query.days) || 7));
    const view = await loadDashboard(createSupabaseRepoFromEnv(), {
      days,
      paused: env.PAUSE_OUTBOUND,
      approvalRequired: env.HITL_REQUIRED_BEFORE_SEND,
      cycle: {
        dailyCap: env.DAILY_ACTION_CAP,
        windowStartHour: env.SEND_WINDOW_START_HOUR,
        windowEndHour: env.SEND_WINDOW_END_HOUR,
        timezone: env.SEND_TIMEZONE,
        includeWeekends: env.SEND_ON_WEEKENDS,
      },
    });

    res.setHeader('cache-control', 'no-store');
    res.status(200).json(view);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
};
