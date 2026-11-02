/**
 * Keeps the invite queue topped up, so the daily cycle never runs dry and nobody has to run a
 * search by hand.
 *
 * Refill, not flood: it only searches when the queue is below `target`, and only for the gap.
 * The daily cycle sends ~8 invites a day; pulling in 60 a day would just pile up stale leads.
 *
 * Campaigns take turns: the one that ran longest ago goes first and continues from its saved
 * cursor, so every saved search is read through once instead of re-reading page 1. A campaign
 * with no further results is retired. Searches are limited on a free account, so one run has a
 * fixed page budget across all campaigns.
 */
import type { Repository } from '../store/repository.js';
import type { UnipileClient } from '../channel/unipile.js';
import { notify, type Alert } from '../lib/notify.js';
import { logger } from '../lib/logger.js';
import { searchLeads } from './search-leads.js';
import { importColdLeads } from './import-cold-leads.js';

export interface RefillDeps {
  repo: Repository;
  unipile: Pick<UnipileClient, 'searchPeople'>;
  alert?: (alert: Alert) => Promise<unknown>;
}

export interface RefillOptions {
  now: () => Date;
  /** Queue size to fill up to. */
  target: number;
  /** Search pages one run may use, across all campaigns. */
  maxPages: number;
  delayMs?: () => number;
  sleep?: (ms: number) => Promise<void>;
}

export interface RefillResult {
  /** False when the queue was full enough and nothing was searched. */
  ran: boolean;
  queuedBefore: number;
  queued: number;
  pages: number;
  /** Campaigns that ran out of results in this run. */
  exhausted: string[];
  error?: string;
}

/**
 * Search results already carry the provider id, so the import never resolves a profile, and
 * with `queueOnly` it never invites. Wired anyway, so a change there fails loudly here.
 */
const searchOnly = {
  resolveProfile: async () => ({ ok: false as const, error: 'refill: profile lookup not expected' }),
  sendInvitation: async () => ({ ok: false as const, error: 'refill: invites go through the daily cycle' }),
};

export async function refillQueue(deps: RefillDeps, opts: RefillOptions): Promise<RefillResult> {
  const alert = deps.alert ?? notify;
  const queuedBefore = await deps.repo.countQueuedForInvite();
  const result: RefillResult = { ran: false, queuedBefore, queued: 0, pages: 0, exhausted: [] };
  if (queuedBefore >= opts.target) return result;
  result.ran = true;

  const campaigns = await deps.repo.listRunnableCampaigns();
  let runnable = campaigns.length;

  for (const campaign of campaigns) {
    const missing = opts.target - queuedBefore - result.queued;
    const pagesLeft = opts.maxPages - result.pages;
    if (missing <= 0 || pagesLeft <= 0) break;

    const found = await searchLeads(
      { repo: deps.repo, unipile: deps.unipile },
      {
        filters: campaign.filters,
        target: missing,
        maxPages: pagesLeft,
        startCursor: campaign.cursor,
        finishPage: true,
        delayMs: opts.delayMs,
        sleep: opts.sleep,
      },
    );
    result.pages += found.pages;

    if (found.error) {
      // Leave the cursor alone: the failed page is retried on the next run.
      result.error = `${campaign.name}: ${found.error}`;
      await alert({
        kind: 'system',
        title: 'Lead-Suche fehlgeschlagen',
        detail: `Kampagne „${campaign.name}": ${found.error}. Die Warteschlange wird beim nächsten Lauf weiter aufgefüllt.`,
        context: { campaignId: campaign.id },
      });
      break;
    }

    const imported = await importColdLeads(
      { repo: deps.repo, unipile: searchOnly },
      found.candidates,
      { cap: found.candidates.length, queueOnly: true, campaignId: campaign.id },
    );
    result.queued += imported.queued;

    await deps.repo.saveCampaign({
      ...campaign,
      cursor: found.nextCursor,
      exhausted: found.exhausted,
      lastRunAt: opts.now().toISOString(),
    });
    if (found.exhausted) {
      result.exhausted.push(campaign.name);
      runnable -= 1;
    }
    logger.info(
      { campaign: campaign.name, queued: imported.queued, pages: found.pages, exhausted: found.exhausted },
      'refill.campaign',
    );
  }

  if (runnable === 0 && !result.error) {
    await alert({
      kind: 'system',
      title: 'Keine aktive Kampagne mehr',
      detail:
        `Alle Suchkampagnen sind leergelaufen. In der Warteschlange: ${queuedBefore + result.queued}. ` +
        'Neue Kampagnen anlegen (npm run seed:campaigns), sonst gehen bald keine Anfragen mehr raus.',
    });
  }

  return result;
}
