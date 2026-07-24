import { InMemoryRepository } from '../../src/store/memory.js';
import { handleNewRelation } from '../../src/channel/relations.js';
import type { OrchestratorDeps } from '../../src/orchestrator.js';
import type { LeadRecord } from '../../src/store/repository.js';

function makeDeps(repo: InMemoryRepository): OrchestratorDeps {
  return {
    repo,
    hitlRequired: true,
    vars: (lead: LeadRecord) => ({
      firstName: lead.firstName ?? 'there',
      bookingLink: 'https://www.crypto-gameplan.com/booking',
      walkthroughLink: 'https://crypto-gameplan.com',
    }),
    classify: async () => ({ intent: 'other' }),
    generate: async ({ canonical }) => canonical, // identity voice stub
  };
}

/** A cold lead we invited (Trigger A): provider id known, awaiting accept. */
async function invitedLead(repo: InMemoryRepository, providerId: string): Promise<LeadRecord> {
  const lead = await repo.createLead({ source: 'cold_outbound', linkedinUrl: `https://www.linkedin.com/in/${providerId}`, firstName: 'Max' });
  lead.linkedinProviderId = providerId;
  lead.stage = 'invited';
  await repo.saveLead(lead);
  return lead;
}

describe('handleNewRelation', () => {
  it('fires the opener (pending approval) when an invited lead accepts', async () => {
    const repo = new InMemoryRepository();
    const lead = await invitedLead(repo, 'prov_1');

    const turn = await handleNewRelation(makeDeps(repo), { user_provider_id: 'prov_1', user_full_name: 'Max Muster' });

    expect(turn?.leadId).toBe(lead.id);
    const pending = await repo.pendingApprovals();
    expect(pending).toHaveLength(1);
    expect(pending[0].leadId).toBe(lead.id);
    expect((await repo.getLead(lead.id))?.brain.openerSent).toBe(true);
  });

  it('is idempotent — a second event does not produce a second opener', async () => {
    const repo = new InMemoryRepository();
    await invitedLead(repo, 'prov_1');
    const deps = makeDeps(repo);

    await handleNewRelation(deps, { user_provider_id: 'prov_1' });
    const second = await handleNewRelation(deps, { user_provider_id: 'prov_1' });

    expect(second).toBeNull();
    expect(await repo.pendingApprovals()).toHaveLength(1);
  });

  it('ignores an unknown provider id (organic accept outside Trigger A)', async () => {
    const repo = new InMemoryRepository();
    const turn = await handleNewRelation(makeDeps(repo), { user_provider_id: 'stranger' });
    expect(turn).toBeNull();
    expect(await repo.pendingApprovals()).toHaveLength(0);
  });

  it('skips a do-not-contact lead', async () => {
    const repo = new InMemoryRepository();
    const lead = await invitedLead(repo, 'prov_1');
    lead.doNotContact = true;
    await repo.saveLead(lead);

    const turn = await handleNewRelation(makeDeps(repo), { user_provider_id: 'prov_1' });
    expect(turn).toBeNull();
    expect(await repo.pendingApprovals()).toHaveLength(0);
  });

  it('returns null when the webhook has no provider id', async () => {
    const repo = new InMemoryRepository();
    expect(await handleNewRelation(makeDeps(repo), {})).toBeNull();
  });
});
