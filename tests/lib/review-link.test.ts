import { reviewUrl, signReviewToken, verifyReviewToken } from '../../src/lib/review-link.js';

const NOW = new Date('2026-11-03T10:00:00Z');
const LATER = new Date('2026-11-05T10:00:00Z');

describe('review links', () => {
  it('round-trips the message id', () => {
    const t = signReviewToken('msg-1', LATER, 's3cret');
    expect(verifyReviewToken(t, 's3cret', NOW)).toBe('msg-1');
  });

  it('rejects a token signed with another secret', () => {
    const t = signReviewToken('msg-1', LATER, 'other');
    expect(verifyReviewToken(t, 's3cret', NOW)).toBeNull();
  });

  it('rejects a token pointed at another message', () => {
    const [, exp, sig] = signReviewToken('msg-1', LATER, 's3cret').split('.');
    expect(verifyReviewToken(`msg-2.${exp}.${sig}`, 's3cret', NOW)).toBeNull();
  });

  it('rejects an expired token', () => {
    const t = signReviewToken('msg-1', NOW, 's3cret');
    expect(verifyReviewToken(t, 's3cret', LATER)).toBeNull();
  });

  it('rejects garbage', () => {
    expect(verifyReviewToken('nope', 's3cret', NOW)).toBeNull();
    expect(verifyReviewToken('a.b.c', 's3cret', NOW)).toBeNull();
  });

  it('builds a link on the review endpoint', () => {
    const url = reviewUrl('https://x.vercel.app/', 'msg-1', 's3cret', NOW);
    expect(url).toMatch(/^https:\/\/x\.vercel\.app\/api\/review\?t=msg-1\.\d+\.[\w-]+$/);
    const token = new URL(url).searchParams.get('t') as string;
    expect(verifyReviewToken(token, 's3cret', NOW)).toBe('msg-1');
  });
});
