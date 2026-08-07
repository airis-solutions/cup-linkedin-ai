/**
 * GoHighLevel mapping for CGP's existing "Leads" pipeline + contact custom fields.
 *
 * IDs supplied by Fabi (2026-06-22). We sync INTO Fabi's existing structures (additive,
 * nothing renamed). Not secrets, but overridable via env if the location ever changes.
 *
 * Process model (Fabi/Robin): every chat -> Contact (answers stored on the contact);
 * qualified leads -> Opportunity in the Leads pipeline; unqualified -> contact only, no
 * opportunity, no booking link.
 */
import type { FunnelStage, Qualification } from '../brain/types.js';

export const GHL = {
  bookingCalendarId: 'jkGyAjmh7LVrOcyS4mLD',
  /** Calendar display name in GHL (used as the appointment title). */
  appointmentTitle: 'Crypto Gameplan - Strategy Session',
  pipelineId: '3BG0f2hSPXf6awJ9I2Wt',
  stages: {
    contacted: '3e269caa-02da-4ffd-81dd-98511a1bbef8',
    qualified: '250fe055-6340-4ec6-aa28-ccd641b2af75',
    salesCallBooked: '78b20f1a-5eac-44e3-8940-196040fd804f',
  },
  fields: {
    experienceLevel: 'qMJ7YXmnzlfAzhbTb7Co',
    holdsAssets: 'QJyT3viRQVqkZ3M68h3p',
    portfolioValue: 'Na2n3SWlxaBRmM14Qde9',
    biggestChallenge: 'P7uxfY2c4xq5IvHxfZco',
    desiredOutcome: 'QpEwZr6lSTigVkl8zl0W',
    qualificationStatus: 'KOPVe1h9qtdLNLHMhEMK',
    customerType: 'GiMHD7htLkcjiBjFD5BE',
  },
  /** Only "Lead" is relevant for the AI-sourced contacts. */
  customerTypeValue: 'Lead',
} as const;

export interface GhlCustomField {
  id: string;
  value: string;
}

/** Build the GHL custom-field payload from a qualification record (omits empty fields). */
export function ghlCustomFields(q: Qualification): GhlCustomField[] {
  const out: GhlCustomField[] = [{ id: GHL.fields.customerType, value: GHL.customerTypeValue }];
  if (q.experienceLevel) out.push({ id: GHL.fields.experienceLevel, value: q.experienceLevel });
  if (typeof q.holdsAssets === 'boolean')
    out.push({ id: GHL.fields.holdsAssets, value: q.holdsAssets ? 'Yes' : 'No' });
  if (q.portfolioValue) out.push({ id: GHL.fields.portfolioValue, value: q.portfolioValue });
  if (q.biggestChallenge) out.push({ id: GHL.fields.biggestChallenge, value: q.biggestChallenge });
  if (q.desiredOutcome) out.push({ id: GHL.fields.desiredOutcome, value: q.desiredOutcome });
  out.push({ id: GHL.fields.qualificationStatus, value: q.status });
  return out;
}

/** Pipeline stage id for a funnel stage, or null if the lead has no opportunity. */
export function ghlStageId(stage: FunnelStage): string | null {
  switch (stage) {
    case 'new':
    case 'invited':
    case 'opener_sent':
    case 'qualifying':
      return GHL.stages.contacted;
    case 'qualified':
    case 'booking_offered':
      return GHL.stages.qualified;
    case 'booked':
      return GHL.stages.salesCallBooked;
    // Unqualified / parked / DNC -> contact only, no opportunity.
    case 'disqualified':
    case 'parked':
    case 'do_not_contact':
      return null;
  }
}

/**
 * Progress order of the Leads-pipeline stages. Used to make opportunity updates
 * forward-only: CGP's own booking page can advance a contact to "Sales Call Booked"
 * before our booking webhook tells us, and syncing our older stage would undo that.
 * Unknown / missing stages rank lowest so we never move an opportunity we can't place.
 */
const STAGE_RANK: Record<string, number> = {
  [GHL.stages.contacted]: 1,
  [GHL.stages.qualified]: 2,
  [GHL.stages.salesCallBooked]: 3,
};

export function stageRank(stageId: string | undefined | null): number {
  return (stageId && STAGE_RANK[stageId]) || 0;
}

/** Only qualified leads become an Opportunity in the Leads pipeline. */
export function shouldCreateOpportunity(stage: FunnelStage): boolean {
  return (
    ghlStageId(stage) !== null &&
    stage !== 'opener_sent' &&
    stage !== 'new' &&
    stage !== 'invited' &&
    stage !== 'qualifying'
  );
}

/**
 * Attribution marker on every booking link we send. Fabi filters the GHL booking
 * webhook on it so only LinkedIn bookings leave CGP's system (2026-08-07).
 */
export const BOOKING_SOURCE_PARAM = 'source=linkedin';

/** Booking link with the lead's name pre-filled (Fabi: prefill name via ?name=; email/phone self-entered). */
export function bookingLinkWithName(baseUrl: string, firstName: string): string {
  const sep = baseUrl.includes('?') ? '&' : '?';
  return `${baseUrl}${sep}name=${encodeURIComponent(firstName)}&${BOOKING_SOURCE_PARAM}`;
}
