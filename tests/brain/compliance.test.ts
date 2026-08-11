import { hasComplianceViolation, scanMessage } from '../../src/brain/guard.js';

/** Did this text trip a compliance rule (rather than a style rule)? */
const trips = (text: string): boolean => hasComplianceViolation(scanMessage(text));

describe('compliance guard — what must never leave the system', () => {
  it('catches guarantees, in both languages', () => {
    expect(trips('This is basically risk-free once you follow the system.')).toBe(true);
    expect(trips('Wir garantieren dir konstante Ergebnisse.')).toBe(true);
    expect(trips('Damit kannst du nichts verlieren.')).toBe(true);
    expect(trips('Das ist eine sichere Rendite.')).toBe(true);
  });

  it('catches promised multiples and beating the market', () => {
    expect(trips('We can double your portfolio this cycle.')).toBe(true);
    expect(trips('Damit verdoppelst du dein Portfolio.')).toBe(true);
    expect(trips('Our members beat the market consistently.')).toBe(true);
  });

  it('catches quoted performance figures', () => {
    expect(trips('Members averaged 30% return last quarter.')).toBe(true);
    expect(trips('Das sind 20 % Gewinn pro Monat.')).toBe(true);
    expect(trips('We did 5x in 6 months.')).toBe(true);
  });

  it('catches price talk, which belongs on the call', () => {
    expect(trips('It costs 500 a month.')).toBe(true);
    expect(trips('Das kostet 297 im Monat.')).toBe(true);
    expect(trips('Die Mindestlaufzeit sind 6 Monate.')).toBe(true);
  });

  it('catches market predictions', () => {
    expect(trips('BTC will hit 200k this cycle.')).toBe(true);
    expect(trips('Bitcoin wird steigen, das ist klar.')).toBe(true);
    expect(trips('Der Bull Run kommt im Herbst.')).toBe(true);
  });

  it('catches personal investment advice', () => {
    expect(trips('You should buy ETH now.')).toBe(true);
    expect(trips('Verkauf deine Altcoins und geh in BTC.')).toBe(true);
  });

  it('forces review rather than silently passing', () => {
    // A compliance hit is error-level, so scanMessage reports the message as not ok —
    // which is what routes it to a human even with HITL switched off.
    expect(scanMessage('This is risk-free.').ok).toBe(false);
  });

  describe('does not fire on normal, correct CGP messages', () => {
    const legit = [
      'Wie lange bist du schon in Krypto unterwegs?',
      'Was würdest du an deinem Portfolio als erstes verbessern wollen?',
      'Preis und Programmstruktur gehen wir im Call durch, das hängt davon ab wo du gerade stehst.',
      'Das System schaut sich jeden Tag an, wohin das Kapital fließt.',
      'Verstehe. Wie viel hast du aktuell im Markt?',
      'Here you go: https://www.crypto-gameplan.com/booking?name=Max&source=linkedin',
      'Was ist gerade deine größte Herausforderung dabei?',
      'Bei uns bekommst du das tägliche Platinum-Update und zwei Live-Calls die Woche.',
      'Ich kann dir im Call einen echten Read dazu geben, nicht im DM.',
      'Mein Portfolio liegt bei 100k, was schlägst du vor?', // lead's own words quoted back
    ];
    for (const text of legit) {
      it(`passes: "${text.slice(0, 55)}…"`, () => {
        expect(trips(text)).toBe(false);
      });
    }
  });
});
