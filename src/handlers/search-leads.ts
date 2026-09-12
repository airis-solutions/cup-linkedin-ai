/**
 * Trigger A, step zero: build the cold list from a LinkedIn search instead of a CSV export.
 *
 * Pages through a people search, drops the profiles we already know and the ones the ICP rules
 * out, and hands back candidates in the shape the CSV import already understands. Nothing is
 * written and nothing leaves the building here — this only reads.
 *
 * Pure and injected (repo + unipile + sleep) so it runs in tests without network.
 */
import type { Repository } from '../store/repository.js';
import type { PeopleSearchFilters, SearchProfile, UnipileClient } from '../channel/unipile.js';
import { logger } from '../lib/logger.js';

/**
 * Signals that disqualify a profile outright, per docs/business/general-info/icp.md: people who
 * do crypto or finance *for a living* are the wrong buyer — they already have a framework and a
 * strong opinion.
 *
 * Matched against name AND headline. The name matters: a first run turned up "Manthan Crypto",
 * whose headline said only "Co Founder at Coinccino".
 *
 * Deliberately narrow on one point: a bare "investor" is NOT here. A tech founder who
 * angel-invests is a good lead, and the word would cost more real prospects than it saves.
 *
 * These rules cannot catch a crypto company by its name alone — "Founder @ Polygon",
 * "MyEtherWallet", "ZKsync Foundation" all read as ordinary tech. That is what the human pass
 * over the CSV is for; the rules handle the clear-cut cases, not the judgement calls.
 */
export const DEFAULT_EXCLUSIONS: RegExp[] = [
  // Crypto as a profession
  /\b(crypto|bitcoin|blockchain|web ?3|defi|nft|altcoin)\b/i,
  /\b(tokenomics|token|wallet|staking|on-?chain|digital assets?)\b/i,
  // Trading as a profession (plural included — "Firing bad Traders" slipped through once)
  /\b(traders?|trading|day.?trading|scalper)\b/i,
  // Finance as a profession
  /\b(venture capital|private equity|hedge fund|family office)\b/i,
  /\b(asset manage|wealth manage|portfolio manager|fund manager)/i,
  /\b(investment bank|investment manage|investor relations)/i,
  /\b(cfo|cfa)\b/i,
  /\bfinance (director|manager|lead|head)\b/i,
  /\bfintech\b/i,
  /\b(financial (advisor|adviser|planner|consultant))\b/i,
  /\b(finanzberater|verm(ö|oe)gensberater|anlageberater|versicherungsmakler)\b/i,
  /\b(insurance broker|banker)\b/i,
];

/** A profile that survived the filters, ready to be written to the import CSV. */
export interface SearchCandidate {
  linkedinUrl: string;
  providerId: string;
  fullName?: string;
  firstName?: string;
  headline?: string;
  location?: string;
  networkDistance?: string;
}

export interface SearchLeadsDeps {
  repo: Pick<Repository, 'findLeadByLinkedinUrl'>;
  unipile: Pick<UnipileClient, 'searchPeople'>;
}

export interface SearchLeadsOptions {
  filters: PeopleSearchFilters;
  /** How many candidates to collect. Paging stops as soon as this is reached. */
  target: number;
  /** Safety bound so a bad filter can't page forever. Default 20. */
  maxPages?: number;
  /** Results per request. Default 50. */
  pageSize?: number;
  /** Rules that disqualify a profile, matched on name + headline. Pass [] to keep everything. */
  exclude?: RegExp[];
  /** Pause (ms) between pages, to stay gentle on the session. */
  delayMs?: () => number;
  sleep?: (ms: number) => Promise<void>;
}

export interface SearchLeadsResult {
  candidates: SearchCandidate[];
  /** Profiles looked at across all pages. */
  scanned: number;
  /** Dropped by the headline rules. */
  excluded: number;
  /** Dropped because they are already a lead in our database. */
  known: number;
  /** Dropped for having no usable profile URL, or seen twice in one run. */
  unusable: number;
  pages: number;
  /** True when we stopped on the page bound or ran out of results before hitting `target`. */
  short: boolean;
  error?: string;
}

const realSleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/** LinkedIn sometimes omits the URL but always gives the handle; rebuild it from that. */
function profileUrlOf(p: SearchProfile): string | undefined {
  if (p.profileUrl) return p.profileUrl;
  return p.publicIdentifier ? `https://www.linkedin.com/in/${p.publicIdentifier}` : undefined;
}

function firstNameOf(name: string | undefined): string | undefined {
  return name?.trim().split(/\s+/)[0] || undefined;
}

export async function searchLeads(
  deps: SearchLeadsDeps,
  opts: SearchLeadsOptions,
): Promise<SearchLeadsResult> {
  const sleep = opts.sleep ?? realSleep;
  const exclusions = opts.exclude ?? DEFAULT_EXCLUSIONS;
  const maxPages = opts.maxPages ?? 20;
  const pageSize = opts.pageSize ?? 50;

  const result: SearchLeadsResult = {
    candidates: [],
    scanned: 0,
    excluded: 0,
    known: 0,
    unusable: 0,
    pages: 0,
    short: false,
  };

  const seen = new Set<string>();
  let cursor: string | undefined;

  while (result.candidates.length < opts.target && result.pages < maxPages) {
    const page = await deps.unipile.searchPeople(opts.filters, { cursor, limit: pageSize });
    result.pages += 1;

    if (!page.ok) {
      result.error = page.error;
      logger.warn({ error: page.error, page: result.pages }, 'search.page_failed');
      break;
    }

    for (const p of page.items) {
      if (result.candidates.length >= opts.target) break;
      result.scanned += 1;

      const linkedinUrl = profileUrlOf(p);
      if (!linkedinUrl || seen.has(p.providerId)) {
        result.unusable += 1;
        continue;
      }
      seen.add(p.providerId);

      const scanned = `${p.name ?? ''} ${p.headline ?? ''}`.trim();
      if (scanned && exclusions.some((re) => re.test(scanned))) {
        result.excluded += 1;
        continue;
      }

      if (await deps.repo.findLeadByLinkedinUrl(linkedinUrl)) {
        result.known += 1;
        continue;
      }

      result.candidates.push({
        linkedinUrl,
        providerId: p.providerId,
        fullName: p.name,
        firstName: firstNameOf(p.name),
        headline: p.headline,
        location: p.location,
        networkDistance: p.networkDistance,
      });
    }

    if (!page.cursor || page.items.length === 0) break; // results exhausted
    cursor = page.cursor;

    if (result.candidates.length < opts.target) {
      const pause = opts.delayMs?.() ?? 0;
      if (pause > 0) await sleep(pause);
    }
  }

  result.short = result.candidates.length < opts.target;
  return result;
}
