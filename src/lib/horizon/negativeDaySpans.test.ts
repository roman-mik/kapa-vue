import type { LedgerEvent, NegativeDayWarning } from '@roman-mik/kapa-core/horizon';
import { describe, expect, it } from 'vite-plus/test';
import { groupNegativeDayWarnings } from './negativeDaySpans';

function fakeEvent(overrides: Partial<LedgerEvent> = {}): LedgerEvent {
  return {
    date: '2026-09-02',
    originalDate: '2026-09-02',
    shifted: false,
    kind: 'obligation',
    label: 'Rent',
    sourceId: 'ob1',
    amountMinor: -50000,
    nativeCurrency: 'RSD',
    nativeAmountMinor: -50000,
    unconvertible: false,
    accountId: 'a1',
    coveredPeriod: null,
    recurring: true,
    balanceBeforeMinor: 0,
    balanceAfterMinor: -1000,
    ...overrides,
  };
}

function shiftWarning(
  date: string,
  shortfallMinor = 1000,
  eventLabel = 'Rent'
): NegativeDayWarning {
  return {
    date,
    shortfallMinor,
    currency: 'RSD',
    fix: { kind: 'shiftPayment', event: fakeEvent({ date, label: eventLabel }) },
  };
}

function holdBackWarning(date: string, shortfallMinor = 500): NegativeDayWarning {
  return {
    date,
    shortfallMinor,
    currency: 'RSD',
    fix: { kind: 'holdBack', amountMinor: shortfallMinor },
  };
}

describe('groupNegativeDayWarnings', () => {
  it('returns an empty array for no warnings', () => {
    expect(groupNegativeDayWarnings([])).toEqual([]);
  });

  it('returns a single span for one warning', () => {
    const result = groupNegativeDayWarnings([shiftWarning('2026-09-02')]);
    expect(result).toHaveLength(1);
    expect(result[0].startDate).toBe('2026-09-02');
    expect(result[0].warnings).toHaveLength(1);
  });

  it('groups consecutive same-shortfall days into one span', () => {
    const warnings = [
      shiftWarning('2026-09-02', 1000),
      shiftWarning('2026-09-03', 1000),
      shiftWarning('2026-09-04', 1000),
    ];
    const result = groupNegativeDayWarnings(warnings);
    expect(result).toHaveLength(1);
    expect(result[0].startDate).toBe('2026-09-02');
    expect(result[0].warnings).toHaveLength(3);
  });

  it('starts a new span when the shortfall changes', () => {
    const warnings = [shiftWarning('2026-09-02', 1000), shiftWarning('2026-09-03', 2000)];
    const result = groupNegativeDayWarnings(warnings);
    expect(result).toHaveLength(2);
    expect(result[0].startDate).toBe('2026-09-02');
    expect(result[0].warnings).toHaveLength(1);
    expect(result[1].startDate).toBe('2026-09-03');
    expect(result[1].warnings).toHaveLength(1);
  });

  it('starts a new span on a non-consecutive date', () => {
    const warnings = [shiftWarning('2026-09-02', 1000), shiftWarning('2026-09-05', 1000)];
    const result = groupNegativeDayWarnings(warnings);
    expect(result).toHaveLength(2);
    expect(result[0].startDate).toBe('2026-09-02');
    expect(result[1].startDate).toBe('2026-09-05');
  });

  it('handles a mix of shift-payment and hold-back fixes across spans', () => {
    const warnings = [shiftWarning('2026-09-02', 1000), holdBackWarning('2026-09-03', 1000)];
    const result = groupNegativeDayWarnings(warnings);
    // Same shortfall → same span even though fix type differs
    expect(result).toHaveLength(1);
    expect(result[0].warnings).toHaveLength(2);
  });

  it('preserves input order within each span', () => {
    const warnings = [
      shiftWarning('2026-09-02', 1000),
      shiftWarning('2026-09-03', 1000),
      shiftWarning('2026-09-04', 1000),
    ];
    const result = groupNegativeDayWarnings(warnings);
    expect(result).toHaveLength(1);
    expect(result[0].warnings.map((w) => w.date)).toEqual([
      '2026-09-02',
      '2026-09-03',
      '2026-09-04',
    ]);
  });

  it('handles a long dip with a shortfall change in the middle', () => {
    const warnings = [
      shiftWarning('2026-09-01', 500),
      shiftWarning('2026-09-02', 500),
      shiftWarning('2026-09-03', 1200),
      shiftWarning('2026-09-04', 1200),
      shiftWarning('2026-09-05', 1200),
    ];
    const result = groupNegativeDayWarnings(warnings);
    expect(result).toHaveLength(2);
    expect(result[0].startDate).toBe('2026-09-01');
    expect(result[0].warnings).toHaveLength(2);
    expect(result[1].startDate).toBe('2026-09-03');
    expect(result[1].warnings).toHaveLength(3);
  });
});
