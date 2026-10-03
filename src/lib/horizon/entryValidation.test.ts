import { describe, expect, it } from 'vite-plus/test';
import { entryDateSchema } from './entryValidation';

describe('entryDateSchema', () => {
  it.each(['2026-02-30', '2026-02-29', '2026-13-01', '', '2026-1-01'])(
    'rejects invalid date %s',
    (value) => {
      expect(entryDateSchema.safeParse(value).success).toBe(false);
    }
  );
  it.each(['2024-02-29', '2026-10-03', '2026-12-31'])(
    'accepts actual calendar date %s',
    (value) => {
      expect(entryDateSchema.safeParse(value).success).toBe(true);
    }
  );
});
