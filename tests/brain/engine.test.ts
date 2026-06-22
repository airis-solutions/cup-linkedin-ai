import { advance, opener } from '../../src/brain/engine.js';
import { defaultBrainState } from '../../src/brain/types.js';
import type { BrainState, FlowVars, InboundUnderstanding, ReplyIntent } from '../../src/brain/types.js';

const vars: FlowVars = {
  firstName: 'Max',
  bookingLink: 'https://crypto-gameplan.com/booking',
  walkthroughLink: 'https://crypto-gameplan.com',
};

function stateAt(node: BrainState['node'], over: Partial<BrainState> = {}): BrainState {
  return { ...defaultBrainState(), node, ...over };
}

function u(intent: ReplyIntent, over: Partial<InboundUnderstanding> = {}): InboundUnderstanding {
  return { intent, ...over };
}

describe('opener', () => {
  it('greets with the welcome copy and fills the first name', () => {
    const d = opener(vars);
    expect(d.nextNode).toBe('welcome');
    expect(d.reply).toContain('Hi Max');
  });
});

describe('happy path through the screen', () => {
  it('welcome -> agree -> Q1', () => {
    const d = advance(stateAt('welcome'), u('agree'), vars);
    expect(d.nextNode).toBe('q1');
    expect(d.reply).toBe('First one, how long have you been investing in crypto?');
  });

  it('Q1 answer -> Q2 with read-back, stores experience', () => {
    const d = advance(
      stateAt('q1'),
      u('answer', { readback: 'Alright got it, 5 years in.', extracted: { experienceLevel: '5+ years' } }),
      vars,
    );
    expect(d.nextNode).toBe('q2');
    expect(d.reply).toContain("What's the main thing you're trying to improve");
    expect(d.reply?.startsWith('Alright got it, 5 years in.')).toBe(true);
    expect(d.qualificationPatch.experienceLevel).toBe('5+ years');
  });

  it('Q2 -> Q3 stores biggest challenge', () => {
    const d = advance(stateAt('q2'), u('answer', { extracted: { biggestChallenge: 'no system' } }), vars);
    expect(d.nextNode).toBe('q3');
    expect(d.reply).toBe('Makes sense. Why that specifically?');
    expect(d.qualificationPatch.biggestChallenge).toBe('no system');
  });

  it('Q3 -> Q4 stores desired outcome', () => {
    const d = advance(stateAt('q3'), u('answer', { extracted: { desiredOutcome: 'consistency' } }), vars);
    expect(d.nextNode).toBe('q4');
    expect(d.reply).toContain('how much do you have deployed');
    expect(d.qualificationPatch.desiredOutcome).toBe('consistency');
  });

  it('Q4 high capital -> pitch + Qualified', () => {
    const d = advance(stateAt('q4'), u('answer', { extracted: { portfolioValue: '$100,000 - $250,000' } }), vars);
    expect(d.nextNode).toBe('pitch_call');
    expect(d.qualificationPatch.status).toBe('Qualified');
    expect(d.reply).toContain('Should we book that call?');
  });

  it('pitch agree -> asks for the email first', () => {
    const d = advance(stateAt('pitch_call'), u('agree'), vars);
    expect(d.nextNode).toBe('ask_email');
    expect(d.reply).toContain('email');
  });

  it('email captured -> sends booking link with name pre-filled', () => {
    const d = advance(stateAt('ask_email'), u('answer', { contact: { email: 'max@x.com' } }), vars);
    expect(d.nextNode).toBe('send_link');
    expect(d.reply).toContain('crypto-gameplan.com/booking?name=Max');
    expect(d.contactPatch?.email).toBe('max@x.com');
    expect(d.events).toContain('booking_link_sent');
  });

  it('no email given -> still sends the link, never blocks the booking', () => {
    const d = advance(stateAt('ask_email'), u('answer'), vars);
    expect(d.nextNode).toBe('send_link');
    expect(d.reply).toContain('crypto-gameplan.com/booking?name=Max');
  });
});

describe('capital routing', () => {
  it('low capital -> soft close, Not Qualified, never pitched', () => {
    const d = advance(stateAt('q4'), u('answer', { extracted: { portfolioValue: 'Under $25,000' } }), vars);
    expect(d.nextNode).toBe('soft_close_low_capital');
    expect(d.qualificationPatch.status).toBe('Not Qualified');
    expect(d.reply).toContain('https://crypto-gameplan.com');
    expect(d.reply).not.toContain('book that call');
  });

  it('mid capital -> pitch but flag a human', () => {
    const d = advance(stateAt('q4'), u('answer', { extracted: { portfolioValue: '$50,000 - $100,000' } }), vars);
    expect(d.nextNode).toBe('pitch_call');
    expect(d.flagForHuman).toBe(true);
    expect(d.qualificationPatch.status).toBe('Needs Manual Review');
  });
});

describe('special cases', () => {
  it('Q4 vocab pushback -> swap to "invested", stay on Q4', () => {
    const d = advance(stateAt('q4'), u('questions_vocab'), vars);
    expect(d.nextNode).toBe('q4');
    expect(d.reply).toContain('invested');
    expect(d.reply).not.toContain('deployed');
    expect(d.qualificationPatch.deployedSwappedToInvested).toBe(true);
  });

  it('not interested -> parked from any node', () => {
    const d = advance(stateAt('q2'), u('not_interested'), vars);
    expect(d.nextNode).toBe('parked');
    expect(d.events).toContain('lead_parked');
  });

  it('wants price at welcome -> objection_price', () => {
    const d = advance(stateAt('welcome'), u('wants_price'), vars);
    expect(d.nextNode).toBe('objection_price');
  });

  it('never sends the booking link before Q4 is done', () => {
    for (const node of ['welcome', 'q1', 'q2', 'q3'] as const) {
      const d = advance(stateAt(node), u('agree'), vars);
      expect(d.reply ?? '').not.toContain('crypto-gameplan.com/booking');
    }
  });
});
