import {
  GHL,
  bookingLinkWithName,
  ghlCustomFields,
  ghlStageId,
  shouldCreateOpportunity,
} from '../../src/config/ghl.js';
import type { Qualification } from '../../src/brain/types.js';

describe('GHL field mapping', () => {
  it('maps a qualified record to the right custom-field IDs and values', () => {
    const q: Qualification = {
      experienceLevel: '5+ years',
      holdsAssets: true,
      portfolioValue: '$100,000 - $250,000',
      biggestChallenge: 'no system',
      desiredOutcome: 'consistency',
      status: 'Qualified',
    };
    const fields = ghlCustomFields(q);
    const byId = Object.fromEntries(fields.map((f) => [f.id, f.value]));
    expect(byId[GHL.fields.experienceLevel]).toBe('5+ years');
    expect(byId[GHL.fields.holdsAssets]).toBe('Yes');
    expect(byId[GHL.fields.portfolioValue]).toBe('$100,000 - $250,000');
    expect(byId[GHL.fields.qualificationStatus]).toBe('Qualified');
    expect(byId[GHL.fields.customerType]).toBe('Lead');
  });

  it('omits fields that are not set', () => {
    const fields = ghlCustomFields({ status: 'Not Reviewed' });
    // Only customer type + qualification status are always present.
    expect(fields.find((f) => f.id === GHL.fields.experienceLevel)).toBeUndefined();
    expect(fields.find((f) => f.id === GHL.fields.qualificationStatus)?.value).toBe('Not Reviewed');
  });
});

describe('GHL stage mapping', () => {
  it('qualified leads get the Qualified stage; booked gets Sales Call Booked', () => {
    expect(ghlStageId('qualified')).toBe(GHL.stages.qualified);
    expect(ghlStageId('booked')).toBe(GHL.stages.salesCallBooked);
    expect(ghlStageId('qualifying')).toBe(GHL.stages.contacted);
  });

  it('unqualified / parked leads get no opportunity', () => {
    expect(ghlStageId('disqualified')).toBeNull();
    expect(ghlStageId('parked')).toBeNull();
    expect(shouldCreateOpportunity('parked')).toBe(false);
    expect(shouldCreateOpportunity('qualifying')).toBe(false);
    expect(shouldCreateOpportunity('qualified')).toBe(true);
  });
});

describe('booking link prefill', () => {
  it('appends the name as a query param', () => {
    expect(bookingLinkWithName('https://www.crypto-gameplan.com/booking', 'Max Müller')).toBe(
      'https://www.crypto-gameplan.com/booking?name=Max%20M%C3%BCller',
    );
  });
});
