import { getMakeupCreditWindow } from './makeup-credit';

describe('getMakeupCreditWindow', () => {
  it('uses the full UTC calendar month for date-only attendance records', () => {
    const now = new Date('2026-08-06T12:30:00.000Z');
    expect(getMakeupCreditWindow(now)).toEqual({
      startsAt: new Date('2026-08-01T00:00:00.000Z'),
      endsAt: new Date('2026-08-31T23:59:59.999Z'),
    });
  });

  it('handles January without crossing into the previous year', () => {
    expect(getMakeupCreditWindow(new Date('2027-01-01T00:00:01.000Z')).startsAt)
      .toEqual(new Date('2027-01-01T00:00:00.000Z'));
  });
});
