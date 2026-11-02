/**
 * Signed one-message links for reviewing a draft from Telegram.
 *
 * The link itself is the credential: whoever holds it can approve, edit or discard exactly that
 * one draft until it expires, and nothing else. Telegram is where the link lives, so a leaked
 * link costs one message, not the account. Signed with DASHBOARD_TOKEN, which never leaves the
 * server; changing that token invalidates every open link.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';

const DAY_MS = 86_400_000;

function mac(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

export function signReviewToken(messageId: string, expiresAt: Date, secret: string): string {
  const payload = `${messageId}.${Math.floor(expiresAt.getTime() / 1000)}`;
  return `${payload}.${mac(payload, secret)}`;
}

/** The message id the token is for, or null when it is forged, malformed or expired. */
export function verifyReviewToken(token: string, secret: string, now: Date): string | null {
  const [messageId, exp, sig, ...rest] = token.split('.');
  if (!messageId || !exp || !sig || rest.length) return null;
  const expected = Buffer.from(mac(`${messageId}.${exp}`, secret));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  if (!/^\d+$/.test(exp) || Number(exp) * 1000 < now.getTime()) return null;
  return messageId;
}

export function reviewUrl(
  baseUrl: string,
  messageId: string,
  secret: string,
  now: Date,
  ttlDays = 7,
): string {
  const token = signReviewToken(messageId, new Date(now.getTime() + ttlDays * DAY_MS), secret);
  return `${baseUrl.replace(/\/$/, '')}/api/review?t=${token}`;
}
