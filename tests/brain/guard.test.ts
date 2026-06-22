import { scanMessage } from '../../src/brain/guard.js';
import { FIXED_COPY } from '../../src/brain/flow.js';

describe('guard — approved copy passes', () => {
  it('welcome and pitch copy are clean', () => {
    expect(scanMessage(FIXED_COPY.welcome ?? '').ok).toBe(true);
    expect(scanMessage(FIXED_COPY.pitch_call ?? '').ok).toBe(true);
    expect(scanMessage(FIXED_COPY.q1 ?? '').ok).toBe(true);
  });
});

describe('guard — catches AI / sales tells', () => {
  it('flags em dashes', () => {
    expect(scanMessage('Best step is a call — let me know.').ok).toBe(false);
  });

  it('flags "I\'d love to"', () => {
    const r = scanMessage("I'd love to hop on a call.");
    expect(r.ok).toBe(false);
    expect(r.violations.some((v) => v.rule === 'banned-phrase')).toBe(true);
  });

  it('flags chasing language', () => {
    expect(scanMessage('Just following up on my last message.').ok).toBe(false);
  });

  it('flags banned AI words', () => {
    expect(scanMessage("Let's leverage this approach.").ok).toBe(false);
  });

  it('flags emoji', () => {
    expect(scanMessage('Sounds good 🚀').ok).toBe(false);
  });

  it('flags evaluation words with exclamation', () => {
    const r = scanMessage('Awesome! Got it.');
    expect(r.ok).toBe(false);
    expect(r.violations.some((v) => v.rule === 'evaluation-word')).toBe(true);
  });

  it('warns on exclamation but does not block', () => {
    const r = scanMessage('Book any slot that works!');
    expect(r.violations.some((v) => v.rule === 'exclamation')).toBe(true);
    expect(r.ok).toBe(true);
  });
});
