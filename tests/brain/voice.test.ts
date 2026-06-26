import { generateReply, type ClaudeCaller, type GenerateParams } from '../../src/brain/voice.js';

const BASE: GenerateParams = {
  node: 'q1',
  canonical: 'First one, how long have you been investing in crypto?',
  language: 'en',
  firstName: 'Max',
  history: [],
};

/** A fake model caller that returns queued text replies, one per attempt. */
function caller(...texts: string[]): ClaudeCaller {
  let i = 0;
  return async () => {
    const text = texts[Math.min(i, texts.length - 1)];
    i++;
    return { content: [{ type: 'text', text }] } as unknown as Awaited<ReturnType<ClaudeCaller>>;
  };
}

describe('voice.generateReply', () => {
  it('returns a clean generated message, trimmed and unquoted', async () => {
    const out = await generateReply(BASE, caller('"How long have you been in crypto so far?"'));
    expect(out).toBe('How long have you been in crypto so far?');
  });

  it('falls back to the approved copy when the model keeps tripping the guard', async () => {
    // "leverage" is a banned AI-tell word -> both attempts fail -> fall back to canonical.
    const out = await generateReply(BASE, caller('We leverage a system here.', 'Still leverage talk.'));
    expect(out).toBe(BASE.canonical);
  });

  it('retries once and accepts the clean second attempt', async () => {
    const out = await generateReply(BASE, caller('We leverage the market.', 'How long have you been investing?'));
    expect(out).toBe('How long have you been investing?');
  });

  it('writes in German context without altering the guard contract', async () => {
    const out = await generateReply(
      { ...BASE, language: 'de' },
      caller('Wie lange bist du schon in Krypto unterwegs?'),
    );
    expect(out).toBe('Wie lange bist du schon in Krypto unterwegs?');
  });
});
