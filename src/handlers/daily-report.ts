/**
 * The evening summary in Telegram: what went out today, who let us in, what waits for a
 * human, and which campaigns are worth keeping. Written to be read in ten seconds on a phone.
 *
 * The acceptance rate per campaign is the number that steers everything else: it decides which
 * searches keep running and when the limits may go up. Below a handful of invites it says
 * nothing, so the report says "zu früh" instead of a misleading percentage.
 */
import type { CampaignStats, RawStats, Repository } from '../store/repository.js';
import { notify, type Alert } from '../lib/notify.js';
import { localParts } from './daily-cycle.js';

const DAY_MS = 86_400_000;
/** Invites a campaign needs before its acceptance rate means anything. */
const MIN_INVITES_FOR_RATE = 10;
/** Below this the queue covers about two days of invites. */
const LOW_QUEUE = 16;

export interface ReportInput {
  now: Date;
  timezone: string;
  /** Stats for the last 24 hours (the `since` window) plus all-time totals. */
  today: RawStats;
  weekInvites: number;
  weeklyInviteCap: number;
  campaigns: CampaignStats[];
}

const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;

function percent(part: number, whole: number): number {
  return Math.round((part / whole) * 100);
}

function campaignLines(campaigns: CampaignStats[]): string[] {
  const started = campaigns.filter((c) => c.invited > 0);
  if (!started.length) return [];
  const ready = started
    .filter((c) => c.invited >= MIN_INVITES_FOR_RATE)
    .sort((a, b) => b.accepted / b.invited - a.accepted / a.invited);
  const early = started.filter((c) => c.invited < MIN_INVITES_FOR_RATE).sort((a, b) => b.invited - a.invited);
  return [
    '',
    'Annahmequote pro Kampagne:',
    ...ready.map((c) => `· ${c.name}: ${c.accepted}/${c.invited} (${percent(c.accepted, c.invited)} %)`),
    ...early.map((c) => `· ${c.name}: ${c.accepted}/${c.invited} (zu früh)`),
  ];
}

export function buildDailyReport(input: ReportInput): Pick<Alert, 'title' | 'detail'> {
  const { today: s } = input;
  const ev = (k: string): number => s.eventsSince[k] ?? 0;
  const label = new Intl.DateTimeFormat('de-DE', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    timeZone: input.timezone,
  }).format(input.now);

  const lines: string[] = [];
  if (s.pendingApprovals > 0) {
    lines.push(
      `✍️ ${s.pendingApprovals === 1 ? '1 Entwurf wartet' : `${s.pendingApprovals} Entwürfe warten`} auf Freigabe (Links weiter oben im Chat)`,
    );
  }

  const day = [
    plural(ev('invite_sent'), 'Anfrage raus', 'Anfragen raus'),
    `${ev('opener_sent')} angenommen`,
    plural(s.repliesSince, 'Antwort', 'Antworten'),
    plural(s.messagesSentSince, 'Nachricht gesendet', 'Nachrichten gesendet'),
  ];
  if (ev('booking_confirmed')) day.push(plural(ev('booking_confirmed'), 'Termin', 'Termine'));
  lines.push(`Heute: ${day.join(' · ')}`);
  if (ev('invite_failed')) lines.push(`⚠️ ${plural(ev('invite_failed'), 'Anfrage', 'Anfragen')} gescheitert`);
  if (ev('invite_withdrawn')) lines.push(`${plural(ev('invite_withdrawn'), 'alte Anfrage', 'alte Anfragen')} zurückgezogen`);

  lines.push(
    `Warteschlange: ${s.queueWaitingForInvite} Leads · Woche: ${input.weekInvites}/${input.weeklyInviteCap} Anfragen`,
  );
  const rate = s.invitesTotal >= MIN_INVITES_FOR_RATE ? ` (${percent(s.invitesAccepted, s.invitesTotal)} %)` : '';
  lines.push(
    `Gesamt: ${s.invitesTotal} Anfragen · ${s.invitesAccepted} angenommen${rate} · ${plural(s.bookedTotal, 'Termin', 'Termine')}`,
  );

  lines.push(...campaignLines(input.campaigns));
  const waiting = input.campaigns.filter((c) => c.active && !c.exhausted && c.invited === 0).length;
  if (waiting) lines.push(`+ ${plural(waiting, 'Kampagne', 'Kampagnen')} noch ohne Anfragen`);

  const warnings: string[] = [];
  if (s.queueWaitingForInvite < LOW_QUEUE) warnings.push('⚠️ Warteschlange fast leer');
  const dry = input.campaigns.filter((c) => c.exhausted).length;
  if (dry) warnings.push(`⚠️ ${plural(dry, 'Kampagne', 'Kampagnen')} leergelaufen, bald neue anlegen`);
  if (warnings.length) lines.push('', ...warnings);

  return { title: `Tagesreport ${label}`, detail: lines.join('\n') };
}

export interface ReportDeps {
  repo: Repository;
  alert?: (alert: Alert) => Promise<unknown>;
}

export interface ReportOptions {
  now: Date;
  timezone: string;
  weeklyInviteCap: number;
}

export async function sendDailyReport(deps: ReportDeps, opts: ReportOptions): Promise<Pick<Alert, 'title' | 'detail'>> {
  const since = new Date(opts.now.getTime() - DAY_MS).toISOString();
  const { day } = localParts(opts.now, opts.timezone);
  const [today, campaigns, weekInvites] = await Promise.all([
    deps.repo.dashboardStats(since, day),
    deps.repo.campaignStats(),
    deps.repo.countEventsSince('invite_sent', new Date(opts.now.getTime() - 7 * DAY_MS).toISOString()),
  ]);
  const report = buildDailyReport({ ...opts, today, campaigns, weekInvites });
  await (deps.alert ?? notify)({ kind: 'report', ...report });
  return report;
}
