import { describe, expect, it } from 'vite-plus/test';
import { formatDay, formatFullDate, formatFullMonth, formatSlippedDate } from './date';

describe('formatFullDate', () => {
  it('renders weekday, short month and day (Sun 14 Sep form)', () => {
    expect(formatFullDate('2026-09-01')).toBe('Tue, Sep 1');
  });

  it('handles month boundaries without drifting across the month seam', () => {
    expect(formatFullDate('2026-09-30')).toBe('Wed, Sep 30');
    expect(formatFullDate('2026-10-01')).toBe('Thu, Oct 1');
  });

  it('is anchored in UTC so the displayed day cannot shift with the local zone', () => {
    // A plain `new Date('2026-09-01')` is parsed as UTC midnight anyway, but the
    // formatter must never let a zone shift a value like 2026-01-01 back a day.
    expect(formatFullDate('2026-01-01')).toBe('Thu, Jan 1');
  });

  it('handles year boundaries and non-leap February', () => {
    expect(formatFullDate('2026-12-31')).toBe('Thu, Dec 31');
    expect(formatFullDate('2027-01-01')).toBe('Fri, Jan 1');
    expect(formatFullDate('2025-02-28')).toBe('Fri, Feb 28');
  });
});

describe('formatSlippedDate', () => {
  it('returns both halves formatted, original as the struck-through candidate', () => {
    const parts = formatSlippedDate('2026-09-02', '2026-09-01');
    expect(parts.slip).toBe('Wed, Sep 2');
    expect(parts.original).toBe('Tue, Sep 1');
  });
});

describe('formatDay', () => {
  it('renders weekday and day only, in the Tue 2 form', () => {
    expect(formatDay('2026-09-02')).toBe('Wed 2');
  });

  it('is anchored in UTC so the day cannot shift with the local zone', () => {
    expect(formatDay('2026-09-01')).toBe('Tue 1');
    expect(formatDay('2026-10-01')).toBe('Thu 1');
  });

  it('handles year boundaries', () => {
    expect(formatDay('2026-12-31')).toBe('Thu 31');
    expect(formatDay('2027-01-01')).toBe('Fri 1');
  });
});

describe('formatFullMonth', () => {
  it('renders the full month word for a YYYY-MM key', () => {
    expect(formatFullMonth('2026-09')).toBe('September');
  });

  it('handles cross-year and early months', () => {
    expect(formatFullMonth('2026-12')).toBe('December');
    expect(formatFullMonth('2027-01')).toBe('January');
  });
});
