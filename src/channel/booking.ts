/**
 * Booking confirmation (GHL) → the AI.
 *
 * The booking link we DM goes to CGP's own GoHighLevel booking page, so when the prospect
 * picks a slot the appointment is created inside GHL (not in our chat). GHL fires a webhook
 * here; we map it back to our lead by email, mark them `booked`, and stop any follow-up.
 *
 * We also re-sync to GHL at the `booked` stage: that enriches the (possibly bare) booking
 * contact with the qualification data captured in-chat and adopts the existing opportunity
 * GHL already opened, instead of creating a duplicate.
 */
import { syncLeadToGhl } from './ghl-sync.js';
import { GHL } from '../config/ghl.js';
import type { GhlClient } from './ghl.js';
import type { LeadRecord, Repository } from '../store/repository.js';
import { logger } from '../lib/logger.js';

export interface BookingWebhookDeps {
  repo: Repository;
  ghl?: GhlClient | null;
}

/** GHL appointment webhook — shapes vary by trigger, so we read fields defensively. */
export type GhlAppointmentWebhook = Record<string, unknown>;

export interface BookingResult {
  leadId: string;
  status: 'booked' | 'already_booked' | 'no_lead' | 'ignored';
}

/** Appointment statuses that mean "cancelled / not actually booked" — we don't mark booked. */
const CANCELLED = new Set(['cancelled', 'canceled', 'noshow', 'no-show', 'no_show', 'deleted', 'invalid']);

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim() ? v.trim() : undefined;
}

function get(obj: unknown, key: string): unknown {
  return obj && typeof obj === 'object' ? (obj as Record<string, unknown>)[key] : undefined;
}

/** Pull the fields we need out of the (variable) GHL appointment payload. */
export function parseAppointment(p: GhlAppointmentWebhook): {
  email?: string;
  contactId?: string;
  calendarId?: string;
  status?: string;
  appointmentId?: string;
} {
  const appt = get(p, 'appointment') ?? get(p, 'calendar') ?? {};
  const contact = get(p, 'contact') ?? {};
  return {
    email: (str(get(p, 'email')) ?? str(get(contact, 'email')) ?? str(get(appt, 'email')))?.toLowerCase(),
    contactId: str(get(p, 'contactId')) ?? str(get(p, 'contact_id')) ?? str(get(appt, 'contactId')) ?? str(get(contact, 'id')),
    calendarId: str(get(p, 'calendarId')) ?? str(get(appt, 'calendarId')) ?? str(get(appt, 'id')),
    status: (str(get(p, 'appointmentStatus')) ?? str(get(p, 'status')) ?? str(get(appt, 'appointmentStatus')) ?? str(get(appt, 'status')))?.toLowerCase(),
    appointmentId: str(get(p, 'appointmentId')) ?? str(get(p, 'id')) ?? str(get(appt, 'id')),
  };
}

/**
 * Process a GHL booking webhook. Idempotent: a repeated delivery for an already-booked lead
 * is a no-op. Returns null only when the payload carries nothing we can act on.
 */
export async function handleGhlAppointmentWebhook(
  deps: BookingWebhookDeps,
  payload: GhlAppointmentWebhook,
): Promise<BookingResult | null> {
  const appt = parseAppointment(payload);

  // A cancellation/no-show is not a booking — leave the lead where it is.
  if (appt.status && CANCELLED.has(appt.status)) return null;

  // Only act on our booking calendar when the payload tells us which one it is.
  if (appt.calendarId && appt.calendarId !== GHL.bookingCalendarId) return null;

  // Resolve the lead's email — directly from the payload, or via the contact id if needed.
  let email = appt.email;
  if (!email && appt.contactId && deps.ghl) {
    const c = await deps.ghl.getContact(appt.contactId);
    if (c.ok) email = c.data?.email?.toLowerCase();
  }
  if (!email) {
    logger.warn({ appointmentId: appt.appointmentId }, 'ghl.booking_no_email');
    return null;
  }

  const lead = await deps.repo.findLeadByEmail(email);
  if (!lead) return { leadId: '', status: 'no_lead' };

  // Idempotent: already booked -> nothing to do.
  if (lead.stage === 'booked' && lead.brain.node === 'booked') {
    return { leadId: lead.id, status: 'already_booked' };
  }

  await markBooked(deps, lead, appt.appointmentId);
  return { leadId: lead.id, status: 'booked' };
}

async function markBooked(deps: BookingWebhookDeps, lead: LeadRecord, appointmentId?: string): Promise<void> {
  lead.brain = { ...lead.brain, node: 'booked' };
  lead.stage = 'booked';
  await deps.repo.saveLead(lead);
  await deps.repo.appendEvent({ leadId: lead.id, kind: 'booking_confirmed', payload: { appointmentId: appointmentId ?? null } });

  // Best-effort: enrich the booking contact with in-chat qualification + move the opportunity
  // to "Sales Call Booked". A GHL hiccup must never break booking confirmation on our side.
  if (deps.ghl) {
    try {
      const { changed } = await syncLeadToGhl(deps.ghl, lead);
      if (changed) await deps.repo.saveLead(lead);
    } catch (err) {
      logger.warn({ leadId: lead.id, err }, 'ghl.sync_failed_on_booking');
    }
  }
}
