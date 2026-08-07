import { InMemoryRepository } from '../../src/store/memory.js';
import { handleGhlAppointmentWebhook, parseAppointment } from '../../src/channel/booking.js';
import { onSilence } from '../../src/brain/engine.js';
import { GHL } from '../../src/config/ghl.js';
import { defaultBrainState } from '../../src/brain/types.js';
import type { GhlClient } from '../../src/channel/ghl.js';
import type { LeadRecord } from '../../src/store/repository.js';

const VARS = { firstName: 'Chris', bookingLink: 'https://x/booking', walkthroughLink: 'https://x' };

/** Fake GHL client covering only what the booking → sync path touches. */
function fakeGhl(over: Partial<GhlClient> = {}) {
  const calls = { upsert: 0, findOpp: 0, stageUpdates: [] as { id: string; stage: string }[], getContact: 0 };
  const ghl = {
    upsertContact: async () => {
      calls.upsert++;
      return { ok: true as const, data: { id: 'C1', isNew: false } };
    },
    updateContact: async (id: string) => ({ ok: true as const, data: { id } }),
    createOpportunity: async () => ({ ok: true as const, data: { id: 'O_NEW' } }),
    updateOpportunityStage: async (id: string, stage: string) => {
      calls.stageUpdates.push({ id, stage });
      return { ok: true as const };
    },
    findOpportunityByContact: async () => {
      calls.findOpp++;
      return { ok: true as const, data: { id: 'O_EXISTING', pipelineStageId: GHL.stages.salesCallBooked } };
    },
    getContact: async () => {
      calls.getContact++;
      return { ok: true as const, data: { email: 'chris@example.com', name: 'Chris' } };
    },
    ...over,
  } as unknown as GhlClient;
  return { ghl, calls };
}

/** Seed a lead that has been offered the booking (email captured, waiting on the calendar). */
async function seedBookingOffered(repo: InMemoryRepository, over: Partial<LeadRecord> = {}): Promise<LeadRecord> {
  const lead = await repo.createLead({ source: 'manual', firstName: 'Chris', fullName: 'Chris B' });
  lead.email = 'chris@example.com';
  lead.stage = 'booking_offered';
  lead.brain = { ...defaultBrainState(), node: 'send_link', openerSent: true };
  lead.qualification = { status: 'Qualified', portfolioValue: '$100,000 - $250,000', experienceLevel: '1 to 3 years' };
  await repo.saveLead(lead);
  return { ...lead, ...over };
}

describe('parseAppointment', () => {
  it('reads email/status from a nested appointment payload', () => {
    const p = parseAppointment({ appointment: { calendarId: GHL.bookingCalendarId, status: 'confirmed', id: 'A1' }, contact: { email: 'X@Y.com' } });
    expect(p.email).toBe('x@y.com');
    expect(p.calendarId).toBe(GHL.bookingCalendarId);
    expect(p.status).toBe('confirmed');
    expect(p.appointmentId).toBe('A1');
  });
});

describe('handleGhlAppointmentWebhook', () => {
  it('marks the lead booked and enriches GHL', async () => {
    const repo = new InMemoryRepository();
    await seedBookingOffered(repo);
    const { ghl, calls } = fakeGhl();

    const res = await handleGhlAppointmentWebhook({ repo, ghl }, {
      calendarId: GHL.bookingCalendarId,
      email: 'chris@example.com',
      status: 'confirmed',
      appointmentId: 'A1',
    });

    expect(res).toEqual({ leadId: expect.any(String), status: 'booked' });
    const lead = await repo.findLeadByEmail('chris@example.com');
    expect(lead?.stage).toBe('booked');
    expect(lead?.brain.node).toBe('booked');
    expect(repo.allEvents().filter((e) => e.kind === 'booking_confirmed')).toHaveLength(1);
    // Enriched the contact and adopted the existing opportunity (no duplicate).
    expect(calls.upsert).toBe(1);
    expect(lead?.ghlOpportunityId).toBe('O_EXISTING');
    // The booking page already put it in "Sales Call Booked" — no redundant stage write.
    expect(calls.stageUpdates).toEqual([]);
  });

  it('is idempotent on repeated delivery', async () => {
    const repo = new InMemoryRepository();
    await seedBookingOffered(repo);
    const { ghl } = fakeGhl();
    const body = { calendarId: GHL.bookingCalendarId, email: 'chris@example.com', status: 'confirmed' };

    const first = await handleGhlAppointmentWebhook({ repo, ghl }, body);
    const second = await handleGhlAppointmentWebhook({ repo, ghl }, body);

    expect(first?.status).toBe('booked');
    expect(second?.status).toBe('already_booked');
    expect(repo.allEvents().filter((e) => e.kind === 'booking_confirmed')).toHaveLength(1);
  });

  it('returns no_lead when no lead matches the email', async () => {
    const repo = new InMemoryRepository();
    const { ghl } = fakeGhl();
    const res = await handleGhlAppointmentWebhook({ repo, ghl }, { email: 'stranger@example.com', status: 'confirmed' });
    expect(res).toEqual({ leadId: '', status: 'no_lead' });
  });

  it('ignores a cancellation (does not book)', async () => {
    const repo = new InMemoryRepository();
    await seedBookingOffered(repo);
    const { ghl } = fakeGhl();
    const res = await handleGhlAppointmentWebhook({ repo, ghl }, { email: 'chris@example.com', status: 'cancelled' });
    expect(res).toBeNull();
    const lead = await repo.findLeadByEmail('chris@example.com');
    expect(lead?.stage).toBe('booking_offered');
  });

  it('ignores appointments on a different calendar', async () => {
    const repo = new InMemoryRepository();
    await seedBookingOffered(repo);
    const { ghl } = fakeGhl();
    const res = await handleGhlAppointmentWebhook({ repo, ghl }, { calendarId: 'other-cal', email: 'chris@example.com' });
    expect(res).toBeNull();
  });

  it('resolves the email via contactId when the payload omits it', async () => {
    const repo = new InMemoryRepository();
    await seedBookingOffered(repo);
    const { ghl, calls } = fakeGhl();
    const res = await handleGhlAppointmentWebhook({ repo, ghl }, { calendarId: GHL.bookingCalendarId, contactId: 'C1', status: 'confirmed' });
    expect(calls.getContact).toBe(1);
    expect(res?.status).toBe('booked');
  });
});

describe('onSilence after booking', () => {
  it('never re-engages a booked lead (no reminder)', () => {
    const decision = onSilence({ ...defaultBrainState(), node: 'booked' }, VARS);
    expect(decision.nextNode).toBe('booked');
    expect(decision.reply).toBeUndefined();
  });
});
