/**
 * The review view: what the engine did, how far leads got, and what is stuck.
 *
 * Deliberately answers the operator's questions, not the database's: how many new people
 * did we reach, how many let us in, how many are actually talking to us, how many booked,
 * and is anything waiting on a human. Rates are null (not 0) when there is no denominator
 * yet — an empty pipeline must not read as "0% acceptance".
 */
import type { RawStats, Repository } from '../store/repository.js';
import type { FunnelStage } from '../brain/types.js';
import { inSendWindow, localParts, defaultCycleOptions, type CycleOptions } from './daily-cycle.js';

export interface DashboardView {
  generatedAt: string;
  /** Green/amber summary of whether the machine is currently allowed to act. */
  system: {
    sendWindowOpen: boolean;
    paused: boolean;
    approvalRequired: boolean;
    timezone: string;
    windowLabel: string;
  };
  today: { day: string; actionsUsed: number; actionsCap: number; actionsLeft: number };
  /** Cold leads imported and waiting for their connection request. */
  queue: { waitingForInvite: number };
  /** The funnel, in the order a lead walks it. */
  funnel: { stage: FunnelStage; label: string; count: number }[];
  totals: {
    invitesSent: number;
    invitesAccepted: number;
    acceptanceRate: number | null;
    inConversation: number;
    qualified: number;
    booked: number;
    bookingRate: number | null;
  };
  period: {
    days: number;
    newLeads: number;
    invitesSent: number;
    messagesSent: number;
    repliesReceived: number;
    replyRate: number | null;
    bookings: number;
  };
  /** Anything a human has to act on. */
  attention: { pendingApprovals: number; flaggedNonProspects: number; escalations: number };
}

const STAGE_ORDER: { stage: FunnelStage; label: string }[] = [
  { stage: 'new', label: 'In der Warteschlange' },
  { stage: 'invited', label: 'Anfrage raus' },
  { stage: 'opener_sent', label: 'Angenommen, angeschrieben' },
  { stage: 'qualifying', label: 'Im Gespräch' },
  { stage: 'qualified', label: 'Qualifiziert' },
  { stage: 'booking_offered', label: 'Termin angeboten' },
  { stage: 'booked', label: 'Call gebucht' },
  { stage: 'parked', label: 'Geparkt' },
  { stage: 'disqualified', label: 'Nicht passend' },
  { stage: 'do_not_contact', label: 'Kein Interessent' },
];

/** Percentage, or null when there is nothing to divide by. */
function rate(part: number, whole: number): number | null {
  if (whole <= 0) return null;
  return Math.round((part / whole) * 1000) / 10;
}

export interface DashboardOptions {
  /** Look-back window for the "period" block. */
  days: number;
  paused: boolean;
  approvalRequired: boolean;
  cycle: Partial<CycleOptions>;
}

export function buildView(raw: RawStats, opts: DashboardOptions, now: Date): DashboardView {
  const cycle = defaultCycleOptions({ ...opts.cycle, now: () => now });
  const { day } = localParts(now, cycle.timezone);
  const count = (s: FunnelStage): number => raw.funnel[s] ?? 0;

  const inConversation = count('opener_sent') + count('qualifying');
  const qualified = count('qualified') + count('booking_offered') + count('booked');

  return {
    generatedAt: now.toISOString(),
    system: {
      sendWindowOpen: inSendWindow(cycle),
      paused: opts.paused,
      approvalRequired: opts.approvalRequired,
      timezone: cycle.timezone,
      windowLabel: `${cycle.windowStartHour}:00–${cycle.windowEndHour}:00${cycle.includeWeekends ? '' : ', Mo–Fr'}`,
    },
    today: {
      day,
      actionsUsed: raw.actionsUsedToday,
      actionsCap: cycle.dailyCap,
      actionsLeft: Math.max(0, cycle.dailyCap - raw.actionsUsedToday),
    },
    queue: { waitingForInvite: raw.queueWaitingForInvite },
    funnel: STAGE_ORDER.map((s) => ({ ...s, count: count(s.stage) })),
    totals: {
      invitesSent: raw.invitesTotal,
      invitesAccepted: raw.invitesAccepted,
      acceptanceRate: rate(raw.invitesAccepted, raw.invitesTotal),
      inConversation,
      qualified,
      booked: raw.bookedTotal,
      bookingRate: rate(raw.bookedTotal, raw.invitesAccepted),
    },
    period: {
      days: opts.days,
      newLeads: raw.leadsCreatedSince,
      invitesSent: raw.eventsSince.invite_sent ?? 0,
      messagesSent: raw.messagesSentSince,
      repliesReceived: raw.repliesSince,
      replyRate: rate(raw.repliesSince, raw.messagesSentSince),
      bookings: raw.eventsSince.booking_confirmed ?? 0,
    },
    attention: {
      pendingApprovals: raw.pendingApprovals,
      flaggedNonProspects: raw.eventsSince.flagged_non_prospect ?? 0,
      escalations: raw.eventsSince.hitl_requested ?? 0,
    },
  };
}

export async function loadDashboard(
  repo: Repository,
  opts: DashboardOptions,
  now: Date = new Date(),
): Promise<DashboardView> {
  const cycle = defaultCycleOptions({ ...opts.cycle, now: () => now });
  const { day } = localParts(now, cycle.timezone);
  const since = new Date(now.getTime() - opts.days * 86_400_000).toISOString();
  const raw = await repo.dashboardStats(since, day);
  return buildView(raw, opts, now);
}
