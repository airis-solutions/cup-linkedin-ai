/**
 * Alerts that actually reach a human.
 *
 * Until now, "escalate to a human" wrote a row into the events table and stopped there.
 * Nobody is watching that table. If the AI meets a prospect mentioning a divorce, an
 * inheritance, financial hardship, or says they are a journalist, someone has to know
 * within minutes, not whenever the dashboard gets opened.
 *
 * Deliberately a plain webhook rather than a specific messenger: point ALERT_WEBHOOK_URL at
 * n8n, Slack, Discord or Make and route it onward from there. That keeps the client project
 * free of another vendor and lets the destination change without a deploy.
 *
 * Best-effort by construction: a broken alert channel must never break a conversation.
 */
import { loadEnv } from '../config/env.js';
import { logger } from './logger.js';

export type AlertKind =
  /** The AI hit something only the real Robin should answer. */
  | 'escalation'
  /** A draft tripped a compliance rule (return promise, price, prediction, advice). */
  | 'compliance'
  /** Something in the machinery failed and stayed failed. */
  | 'system';

export interface Alert {
  kind: AlertKind;
  /** One line, written for a phone screen. */
  title: string;
  /** What happened, in enough detail to act on. */
  detail?: string;
  leadId?: string;
  /** Free-form extras for the receiving automation. */
  context?: Record<string, unknown>;
}

const ICON: Record<AlertKind, string> = {
  escalation: '🚨',
  compliance: '⚠️',
  system: '🔧',
};

/** Fire an alert. Never throws, never blocks the caller on a slow endpoint. */
export async function notify(alert: Alert, fetchImpl: typeof fetch = fetch): Promise<boolean> {
  // Always log, so the alert exists even when no channel is configured.
  logger.warn({ ...alert }, `alert.${alert.kind}`);

  let url: string | undefined;
  try {
    url = loadEnv().ALERT_WEBHOOK_URL;
  } catch {
    return false; // env not loadable (e.g. in a test) — the log above is the fallback
  }
  if (!url) return false;

  const dashboard = 'https://cup-linkedin-ai.vercel.app';
  const body = {
    kind: alert.kind,
    title: alert.title,
    detail: alert.detail ?? '',
    leadId: alert.leadId ?? null,
    context: alert.context ?? {},
    // A ready-made line, so a generic webhook needs no formatting logic downstream.
    text: `${ICON[alert.kind]} ${alert.title}${alert.detail ? `\n${alert.detail}` : ''}${
      alert.leadId ? `\nLead: ${alert.leadId}` : ''
    }\n${dashboard}`,
  };

  try {
    const res = await fetchImpl(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      logger.warn({ status: res.status }, 'alert.delivery_failed');
      return false;
    }
    return true;
  } catch (err) {
    logger.warn({ err: String(err) }, 'alert.delivery_error');
    return false;
  }
}
