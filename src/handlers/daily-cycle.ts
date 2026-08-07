/**
 * The daily cycle — the clock the system was missing.
 *
 * One run does three things, in this order and always inside the day's budget:
 *   1. drip connection requests to queued cold leads (Trigger A, at a human pace)
 *   2. work the follow-up clock (24h value touch / 72h booking reminder / park)
 *   3. dispatch approved-but-unsent messages
 *
 * Everything is bounded by a single shared daily budget reserved atomically in the DB,
 * so two overlapping runs can never blow through LinkedIn's limits. Outside the sending
 * window (working hours, weekdays) the cycle does nothing at all — a real person does not
 * send connection requests at 03:00 on a Sunday.
 *
 * Pure-ish: all I/O comes in through deps, the clock and jitter are injectable, so the
 * whole thing is testable offline.
 */
import type { OrchestratorDeps } from '../orchestrator.js';
import { handleSilence } from '../orchestrator.js';
import { dispatchApprovedForLead } from '../channel/outbound.js';
import type { UnipileClient } from '../channel/unipile.js';
import type { LeadRecord, Repository } from '../store/repository.js';
import { logger } from '../lib/logger.js';

export interface CycleDeps extends OrchestratorDeps {
  unipile: UnipileClient | null;
}

export interface CycleOptions {
  /** Hard ceiling on outbound actions (invites + messages) for the whole day. */
  dailyCap: number;
  /** Most invites to send in a single run, so one run never dumps the whole day at once. */
  invitesPerRun: number;
  /** Local hour (inclusive) the sending window opens. */
  windowStartHour: number;
  /** Local hour (exclusive) the sending window closes. */
  windowEndHour: number;
  /** IANA timezone the window is expressed in. */
  timezone: string;
  /** Send on Saturday/Sunday? Real people mostly don't. */
  includeWeekends: boolean;
  /** Hours of silence before the follow-up engine touches a lead. */
  followUpHours: number;
  now: () => Date;
  /** Pause between two outbound actions, in ms. Randomised in production. */
  jitterMs: () => number;
  sleep: (ms: number) => Promise<void>;
}

export interface CycleResult {
  ran: boolean;
  /** Why the cycle did nothing (outside window, budget spent, not configured). */
  reason?: string;
  invited: number;
  followUps: number;
  dispatched: number;
  budgetRemaining: number;
}

const realSleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

export const defaultCycleOptions = (over: Partial<CycleOptions> = {}): CycleOptions => ({
  dailyCap: 20,
  invitesPerRun: 5,
  windowStartHour: 9,
  windowEndHour: 18,
  timezone: 'Europe/Berlin',
  includeWeekends: false,
  followUpHours: 24,
  now: () => new Date(),
  jitterMs: () => 45_000 + Math.floor(Math.random() * 90_000),
  sleep: realSleep,
  ...over,
});

/** Local wall-clock parts of `date` in `timezone`, without pulling in a date library. */
export function localParts(date: Date, timezone: string): { hour: number; weekday: number; day: string } {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    weekday: 'short',
  });
  const parts = Object.fromEntries(fmt.formatToParts(date).map((p) => [p.type, p.value]));
  const WEEKDAYS: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return {
    // "24" is midnight in some locales' hour12:false output.
    hour: Number(parts.hour) % 24,
    weekday: WEEKDAYS[parts.weekday ?? 'Mon'] ?? 1,
    day: `${parts.year}-${parts.month}-${parts.day}`,
  };
}

/** Is now inside the human sending window? */
export function inSendWindow(opts: CycleOptions): boolean {
  const { hour, weekday } = localParts(opts.now(), opts.timezone);
  if (!opts.includeWeekends && (weekday === 0 || weekday === 6)) return false;
  return hour >= opts.windowStartHour && hour < opts.windowEndHour;
}

/** Send one queued cold lead a connection request. Returns true when it went out. */
async function inviteOne(deps: CycleDeps, lead: LeadRecord, nowIso: string): Promise<boolean> {
  if (!deps.unipile) return false;
  const providerId = lead.linkedinProviderId;
  if (!providerId) {
    logger.warn({ leadId: lead.id }, 'cycle.invite_skipped_no_provider_id');
    return false;
  }
  const res = await deps.unipile.sendInvitation(providerId);
  if (!res.ok) {
    logger.warn({ leadId: lead.id, error: res.error }, 'cycle.invite_failed');
    return false;
  }
  lead.stage = 'invited';
  lead.invitedAt = nowIso;
  await deps.repo.saveLead(lead);
  await deps.repo.appendEvent({ leadId: lead.id, kind: 'invite_sent', payload: {} });
  return true;
}

/**
 * Run one cycle. Every outbound action costs exactly one unit of the daily budget and is
 * reserved BEFORE it happens, so a crash mid-run can only ever under-send, never over-send.
 */
export async function runDailyCycle(deps: CycleDeps, options: Partial<CycleOptions> = {}): Promise<CycleResult> {
  const opts = defaultCycleOptions(options);
  const now = opts.now();
  const { day } = localParts(now, opts.timezone);
  const idle: CycleResult = { ran: false, invited: 0, followUps: 0, dispatched: 0, budgetRemaining: 0 };

  if (!deps.unipile) {
    return { ...idle, reason: 'linkedin_not_configured' };
  }
  if (!inSendWindow(opts)) {
    return { ...idle, reason: 'outside_send_window' };
  }

  const used = await deps.repo.sentToday(day);
  if (used >= opts.dailyCap) {
    return { ...idle, reason: 'daily_cap_reached' };
  }

  const result: CycleResult = { ran: true, invited: 0, followUps: 0, dispatched: 0, budgetRemaining: 0 };
  let first = true;
  const pace = async (): Promise<void> => {
    if (!first) await opts.sleep(opts.jitterMs());
    first = false;
  };

  // 1) Drip connection requests to the cold queue.
  const queued = await deps.repo.listQueuedForInvite(opts.invitesPerRun);
  for (const lead of queued) {
    if ((await deps.repo.reserveDailySends(day, opts.dailyCap, 1)) === 0) break;
    await pace();
    if (await inviteOne(deps, lead, now.toISOString())) result.invited += 1;
  }

  // 2) Work the follow-up clock. These produce drafts; whether they go out is HITL's call.
  const due = await deps.repo.listDueForFollowUp(now.toISOString(), opts.dailyCap);
  for (const lead of due) {
    try {
      const turn = await handleSilence(deps, lead.id);
      result.followUps += 1;
      logger.info({ leadId: lead.id, node: turn.node }, 'cycle.follow_up');
    } catch (err) {
      logger.warn({ leadId: lead.id, err: String(err) }, 'cycle.follow_up_failed');
    }
  }

  // 3) Dispatch anything already approved (this is what makes HITL-off actually send).
  const approved = await deps.repo.listApprovedUnsent(opts.dailyCap);
  const leadIds = [...new Set(approved.map((m) => m.leadId))];
  for (const leadId of leadIds) {
    if ((await deps.repo.reserveDailySends(day, opts.dailyCap, 1)) === 0) break;
    await pace();
    const sent = await dispatchApprovedForLead({ repo: deps.repo, unipile: deps.unipile }, leadId);
    result.dispatched += sent.sent;
  }

  result.budgetRemaining = Math.max(0, opts.dailyCap - (await deps.repo.sentToday(day)));
  logger.info({ ...result, day }, 'cycle.done');
  return result;
}

/** Schedule the next follow-up touch for a lead (called after an outbound actually goes out). */
export function scheduleNextTouch(lead: LeadRecord, hours: number, now: Date): void {
  lead.lastOutboundAt = now.toISOString();
  lead.nextActionAt = new Date(now.getTime() + hours * 3_600_000).toISOString();
}

/** Stop the clock for a lead (booked, parked, do-not-contact). */
export function clearNextTouch(lead: LeadRecord): void {
  lead.nextActionAt = undefined;
}

export type { Repository };
