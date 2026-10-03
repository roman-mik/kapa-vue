import { describe, expect, it } from 'vite-plus/test';
import { countNonConfirmed, isNonConfirmed } from './confidence';

describe('isNonConfirmed', () => {
  it('treats confirmed as confirmed', () => {
    expect(isNonConfirmed('confirmed')).toBe(false);
  });

  it('treats expected and uncertain as estimates', () => {
    expect(isNonConfirmed('expected')).toBe(true);
    expect(isNonConfirmed('uncertain')).toBe(true);
  });

  it('treats missing or unknown confidence as an estimate', () => {
    expect(isNonConfirmed(undefined)).toBe(true);
    expect(isNonConfirmed(null)).toBe(true);
    expect(isNonConfirmed('')).toBe(true);
    expect(isNonConfirmed('something-else')).toBe(true);
  });
});

describe('countNonConfirmed', () => {
  it('counts only non-confirmed rows', () => {
    const rows = [
      { confidence: 'confirmed' },
      { confidence: 'expected' },
      { confidence: 'uncertain' },
      { confidence: undefined },
    ];
    expect(countNonConfirmed(rows)).toBe(3);
  });

  it('returns zero when everything is confirmed', () => {
    const rows = [{ confidence: 'confirmed' }, { confidence: 'confirmed' }];
    expect(countNonConfirmed(rows)).toBe(0);
  });

  it('handles an empty list', () => {
    expect(countNonConfirmed([])).toBe(0);
  });
});
