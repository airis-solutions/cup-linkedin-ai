import { InMemoryRepository } from '../src/store/memory.js';
import { handleInbound, handleOpener, type OrchestratorDeps } from '../src/orchestrator.js';
import type { FlowNode, InboundUnderstanding, LeadRecord } from '../src/brain/types.js';

const VARS = (lead: LeadRecord) => ({
  firstName: lead.firstName ?? 'there',
  bookingLink: 'https://www.crypto-gameplan.com/booking',
  walkthroughLink: 'https://crypto-gameplan.com',
});

// Stubbed understanding per node — drives a full qualified conversation, no network.
const SCRIPT: Partial<Record<FlowNode, InboundUnderstanding>> = {
  welcome: { intent: 'agree' },
  q1: { intent: 'answer', readback: 'Got it, 5 years in.', extracted: { experienceLevel: '5+ years' } },
  q2: { intent: 'answer', extracted: { biggestChallenge: 'no real system' } },
  q3: { intent: 'answer', extracted: { desiredOutcome: 'consistency' } },
  q4: { intent: 'answer', extracted: { portfolioValue: '$100,000 - $250,000', holdsAssets: true } },
  pitch_call: { intent: 'agree' },
  ask_email: { intent: 'answer', contact: { email: 'max@example.com' } },
};

function makeDeps(repo: InMemoryRepository, hitlRequired = true): OrchestratorDeps {
  return {
    repo,
    hitlRequired,
    vars: VARS,
    classify: async ({ node }) => SCRIPT[node] ?? { intent: 'other' },
  };
}

describe('orchestrator end-to-end (in-memory)', () => {
  it('runs a full qualified conversation and stores approvals + state', async () => {
    const repo = new InMemoryRepository();
    const deps = makeDeps(repo);
    const lead = await repo.createLead({ source: 'cta_reply_system', firstName: 'Max', linkedinUrl: 'u1' });

    await handleOpener(deps, lead.id);
    expect((await repo.getLead(lead.id))?.stage).toBe('opener_sent');

    // welcome -> q1 -> q2 -> q3 -> q4 -> pitch -> send_link (6 inbound turns)
    let res = await handleInbound(deps, lead.id, 'yeah sure');
    expect(res.node).toBe('q1');
    res = await handleInbound(deps, lead.id, '5 years');
    expect(res.node).toBe('q2');
    expect(res.draft?.body).toContain("What's the main thing");
    res = await handleInbound(deps, lead.id, 'I have no system');
    expect(res.node).toBe('q3');
    res = await handleInbound(deps, lead.id, 'I lose money on emotion');
    expect(res.node).toBe('q4');
    res = await handleInbound(deps, lead.id, 'around 150k');
    expect(res.node).toBe('pitch_call');
    res = await handleInbound(deps, lead.id, 'yes lets book');
    expect(res.node).toBe('ask_email'); // collect email before the link
    res = await handleInbound(deps, lead.id, 'max@example.com');
    expect(res.node).toBe('send_link');
    expect(res.draft?.body).toContain('https://www.crypto-gameplan.com/booking?name=Max');

    const finalLead = await repo.getLead(lead.id);
    expect(finalLead?.qualification.status).toBe('Qualified');
    expect(finalLead?.qualification.experienceLevel).toBe('5+ years');
    expect(finalLead?.qualification.portfolioValue).toBe('$100,000 - $250,000');
    expect(finalLead?.email).toBe('max@example.com');
    expect(finalLead?.stage).toBe('booking_offered');

    // Every outbound waits for human approval (HITL on).
    const pending = await repo.pendingApprovals();
    expect(pending.length).toBe(8); // opener + 7 replies
    expect(pending.every((m) => m.guardFlagged === false)).toBe(true);

    const kinds = repo.allEvents().map((e) => e.kind);
    expect(kinds).toContain('booking_link_sent');
    expect(kinds.filter((k) => k === 'reply_received').length).toBe(7);
  });

  it('with HITL off, clean copy is auto-approved (not sent yet)', async () => {
    const repo = new InMemoryRepository();
    const deps = makeDeps(repo, false);
    const lead = await repo.createLead({ source: 'manual', firstName: 'Sam' });
    await handleOpener(deps, lead.id);
    const msgs = await repo.messagesForLead(lead.id);
    expect(msgs[0]?.status).toBe('approved');
  });
});
