/**
 * Trigger A, first half: import a Sales Navigator list -> connection requests.
 *
 * For each row we: dedupe (by profile URL), resolve the profile to its provider id, create a
 * cold_outbound lead, and send a blank connection request (throttled). The lead sits at stage
 * 'invited' until they accept — then the USERS `new_relation` webhook fires the opener
 * (see channel/relations.ts).
 *
 * Pure and injected (repo + unipile + sleep) so it runs in tests with an in-memory store and a
 * stubbed Unipile — no network. LinkedIn caps invites hard (~100-200/week), so `cap` bounds the
 * batch and `delayMs` spaces requests out; never blast.
 */
import type { Repository } from '../store/repository.js';
import type { Language } from '../brain/types.js';
import { publicIdentifierFromUrl, type UnipileClient } from '../channel/unipile.js';
import { logger } from '../lib/logger.js';

/** DACH country names (English + native) as they appear in LinkedIn location strings. */
const DACH_COUNTRIES = [
  'germany', 'deutschland', 'austria', 'österreich', 'osterreich',
  'switzerland', 'schweiz', 'suisse', 'svizzera', 'liechtenstein',
];

/**
 * Pick the opener language from a LinkedIn location string: DACH -> German, everything else
 * (and unknown) -> English. Cold leads have no inbound message yet, so location is our only
 * language signal for the opener; after the first reply the classifier takes over.
 */
export function languageFromLocation(location?: string): Language {
  if (!location) return 'en';
  const l = location.toLowerCase();
  return DACH_COUNTRIES.some((c) => l.includes(c)) ? 'de' : 'en';
}

export interface ColdLeadRow {
  /** Regular LinkedIn profile URL (linkedin.com/in/…), not the /sales/lead/ URL. */
  linkedinUrl: string;
  firstName?: string;
  fullName?: string;
}

export interface ImportDeps {
  repo: Repository;
  unipile: Pick<UnipileClient, 'resolveProfile' | 'sendInvitation'>;
}

export interface ImportOptions {
  /** Max connection requests to send this run (the daily cap). */
  cap: number;
  /**
   * Import into the queue without inviting. The daily cycle then drips the invites out
   * inside the day's budget and the sending window. This is the default for big lists —
   * inviting straight from the import is what blows through LinkedIn's limits.
   */
  queueOnly?: boolean;
  /** Resolve + report only; create no leads and send no invites. */
  dryRun?: boolean;
  /** Pause (ms) after each invite, to space requests out. Default: none. */
  delayMs?: () => number;
  /** Injected for tests; defaults to real setTimeout. */
  sleep?: (ms: number) => Promise<void>;
}

export interface ImportResult {
  total: number;
  /** Invites sent (or, in dry-run, that would be sent). */
  invited: number;
  /** Leads added to the queue for the daily cycle to invite later. */
  queued: number;
  /** Skipped as already-known (dedupe) or because the cap was reached. */
  skipped: number;
  /** Rows we couldn't process (no public identifier, resolve failed, invite failed). */
  failed: number;
  dryRun: boolean;
}

const realSleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

export async function importColdLeads(
  deps: ImportDeps,
  rows: ColdLeadRow[],
  opts: ImportOptions,
): Promise<ImportResult> {
  const sleep = opts.sleep ?? realSleep;
  const result: ImportResult = {
    total: rows.length,
    invited: 0,
    queued: 0,
    skipped: 0,
    failed: 0,
    dryRun: Boolean(opts.dryRun),
  };

  for (const row of rows) {
    // Queued imports are not rate-limited: nothing leaves the building until the daily
    // cycle picks them up, and that is where the real cap lives.
    if (!opts.queueOnly && result.invited >= opts.cap) {
      result.skipped += 1; // cap reached — leave the rest for the next run
      continue;
    }

    const identifier = publicIdentifierFromUrl(row.linkedinUrl);
    if (!identifier) {
      result.failed += 1;
      logger.warn({ url: row.linkedinUrl }, 'import.no_public_identifier');
      continue;
    }

    const existing = await deps.repo.findLeadByLinkedinUrl(row.linkedinUrl);
    if (existing) {
      result.skipped += 1;
      continue;
    }

    const resolved = await deps.unipile.resolveProfile(identifier);
    if (!resolved.ok || !resolved.providerId) {
      result.failed += 1;
      logger.warn({ identifier, error: resolved.error }, 'import.resolve_failed');
      continue;
    }

    if (opts.dryRun) {
      if (opts.queueOnly) result.queued += 1;
      else result.invited += 1; // would invite
      continue;
    }

    const lead = await deps.repo.createLead({
      source: 'cold_outbound',
      linkedinUrl: row.linkedinUrl,
      firstName: row.firstName,
      fullName: row.fullName ?? resolved.name,
    });
    lead.linkedinProviderId = resolved.providerId;
    // Set the opener language from their country now (no inbound to detect it from yet).
    lead.brain = { ...lead.brain, language: languageFromLocation(resolved.location) };

    if (opts.queueOnly) {
      await deps.repo.saveLead(lead); // stays at stage 'new' — the daily cycle invites it
      await deps.repo.appendEvent({ leadId: lead.id, kind: 'lead_created', payload: { source: 'cold_outbound' } });
      result.queued += 1;
      continue;
    }

    const invite = await deps.unipile.sendInvitation(resolved.providerId);
    if (!invite.ok) {
      result.failed += 1;
      await deps.repo.saveLead(lead); // keep the lead + provider id; stays at 'new' to retry
      logger.warn({ leadId: lead.id, error: invite.error }, 'import.invite_failed');
      continue;
    }

    lead.stage = 'invited';
    await deps.repo.saveLead(lead);
    await deps.repo.appendEvent({ leadId: lead.id, kind: 'lead_created', payload: { source: 'cold_outbound' } });
    result.invited += 1;

    const pause = opts.delayMs?.() ?? 0;
    if (pause > 0) await sleep(pause);
  }

  return result;
}
