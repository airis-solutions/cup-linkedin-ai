import { syncLeadToGhl } from '../../src/channel/ghl-sync.js';
import type { GhlClient } from '../../src/channel/ghl.js';
import { GHL } from '../../src/config/ghl.js';
import { defaultBrainState } from '../../src/brain/types.js';
import type { FunnelStage } from '../../src/brain/types.js';
import type { LeadRecord } from '../../src/store/repository.js';

function makeLead(over: Partial<LeadRecord> = {}): LeadRecord {
  return {
    id: 'lead1',
    source: 'manual',
    stage: 'qualified',
    brain: defaultBrainState(),
    qualification: { status: 'Qualified', experienceLevel: '5+ years', portfolioValue: '$100,000 - $250,000' },
    doNotContact: false,
    firstName: 'Max',
    email: 'max@example.com',
    createdAt: '',
    updatedAt: '',
    ...over,
  };
}

interface Calls {
  upsert: number;
  update: number;
  createOpp: { name: string; pipelineStageId: string; contactId: string }[];
  stageUpdates: { id: string; stage: string }[];
  findOpp: number;
}

function fakeGhl(over: Partial<GhlClient> = {}): { ghl: GhlClient; calls: Calls } {
  const calls: Calls = { upsert: 0, update: 0, createOpp: [], stageUpdates: [], findOpp: 0 };
  const ghl = {
    upsertContact: async () => {
      calls.upsert++;
      return { ok: true as const, data: { id: 'C1', isNew: true } };
    },
    updateContact: async (id: string) => {
      calls.update++;
      return { ok: true as const, data: { id } };
    },
    createOpportunity: async (input: { name: string; pipelineStageId: string; contactId: string }) => {
      calls.createOpp.push(input);
      return { ok: true as const, data: { id: 'O1' } };
    },
    updateOpportunityStage: async (id: string, stage: string) => {
      calls.stageUpdates.push({ id, stage });
      return { ok: true as const };
    },
    // Default: no opportunity exists yet for the contact (so the create path runs).
    findOpportunityByContact: async () => {
      calls.findOpp++;
      return { ok: true as const, data: null };
    },
    ...over,
  } as unknown as GhlClient;
  return { ghl, calls };
}

describe('syncLeadToGhl', () => {
  it('creates contact + opportunity for a fresh qualified lead', async () => {
    const { ghl, calls } = fakeGhl();
    const lead = makeLead();
    const { changed } = await syncLeadToGhl(ghl, lead);

    expect(changed).toBe(true);
    expect(calls.upsert).toBe(1);
    expect(lead.ghlContactId).toBe('C1');
    expect(calls.createOpp).toHaveLength(1);
    expect(calls.createOpp[0].pipelineStageId).toBe(GHL.stages.qualified);
    expect(lead.ghlOpportunityId).toBe('O1');
  });

  it('updates by id (no new contact/opportunity) when ids already exist', async () => {
    const { ghl, calls } = fakeGhl({
      findOpportunityByContact: async () => ({
        ok: true as const,
        data: { id: 'O1', pipelineStageId: GHL.stages.qualified },
      }),
    });
    const lead = makeLead({ stage: 'booked', ghlContactId: 'C1', ghlOpportunityId: 'O1' });
    const { changed } = await syncLeadToGhl(ghl, lead);

    expect(changed).toBe(false);
    expect(calls.upsert).toBe(0);
    expect(calls.update).toBe(1);
    expect(calls.createOpp).toHaveLength(0);
    expect(calls.stageUpdates).toEqual([{ id: 'O1', stage: GHL.stages.salesCallBooked }]);
  });

  it('adopts an existing opportunity instead of creating a duplicate', async () => {
    // e.g. CGP's booking page already opened an opportunity in "Sales Call Booked".
    const { ghl, calls } = fakeGhl({
      findOpportunityByContact: async () => ({
        ok: true as const,
        data: { id: 'EXISTING', pipelineStageId: GHL.stages.salesCallBooked },
      }),
    });
    const lead = makeLead({ stage: 'booked', ghlContactId: 'C1' });
    const { changed } = await syncLeadToGhl(ghl, lead);

    expect(changed).toBe(true);
    expect(calls.createOpp).toHaveLength(0);
    expect(lead.ghlOpportunityId).toBe('EXISTING');
    // Already in the target stage — nothing to move.
    expect(calls.stageUpdates).toEqual([]);
  });

  it('never moves an opportunity backwards', async () => {
    // The prospect booked via CGP's page (opportunity already in "Sales Call Booked")
    // but our booking webhook hasn't fired yet, so our lead is still "booking_offered".
    const { ghl, calls } = fakeGhl({
      findOpportunityByContact: async () => ({
        ok: true as const,
        data: { id: 'EXISTING', pipelineStageId: GHL.stages.salesCallBooked },
      }),
    });
    const lead = makeLead({ stage: 'booking_offered', ghlContactId: 'C1' });
    await syncLeadToGhl(ghl, lead);

    expect(lead.ghlOpportunityId).toBe('EXISTING');
    expect(calls.stageUpdates).toEqual([]);
  });

  it('skips the stage update when the live opportunity cannot be read', async () => {
    const { ghl, calls } = fakeGhl({
      findOpportunityByContact: async () => ({ ok: false as const, error: 'boom' }),
    });
    const lead = makeLead({ stage: 'booked', ghlContactId: 'C1', ghlOpportunityId: 'O1' });
    await syncLeadToGhl(ghl, lead);

    expect(calls.stageUpdates).toEqual([]);
    expect(calls.createOpp).toHaveLength(0);
  });

  it('syncs an unqualified lead as a contact only (no opportunity)', async () => {
    const { ghl, calls } = fakeGhl();
    const lead = makeLead({ stage: 'disqualified', qualification: { status: 'Not Qualified' } });
    await syncLeadToGhl(ghl, lead);

    expect(calls.upsert).toBe(1);
    expect(lead.ghlContactId).toBe('C1');
    expect(calls.createOpp).toHaveLength(0);
    expect(lead.ghlOpportunityId).toBeUndefined();
  });

  it('does not sync non-prospects or not-yet-engaged leads', async () => {
    for (const stage of ['do_not_contact', 'new', 'opener_sent'] as FunnelStage[]) {
      const { ghl, calls } = fakeGhl();
      const { changed } = await syncLeadToGhl(ghl, makeLead({ stage }));
      expect(changed).toBe(false);
      expect(calls.upsert + calls.update + calls.createOpp.length).toBe(0);
    }
  });
});
