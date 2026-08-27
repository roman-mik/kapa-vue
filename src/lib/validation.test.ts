import { describe, expect, it } from 'vite-plus/test';
import {
  categoryNameSchema,
  firstIssueMessage,
  nonNegativeAmountSchema,
  nudgePctSchema,
  positiveAmountSchema,
} from './validation';

describe('categoryNameSchema', () => {
  it('trims and accepts a normal name', () => {
    expect(categoryNameSchema.parse('  Groceries  ')).toBe('Groceries');
  });

  it('rejects an empty name', () => {
    expect(firstIssueMessage(categoryNameSchema.safeParse(''))).toBe('Enter a name.');
  });

  it('rejects a name over 60 characters', () => {
    const tooLong = 'a'.repeat(61);
    expect(firstIssueMessage(categoryNameSchema.safeParse(tooLong))).toBe(
      'Category names are limited to 60 characters.'
    );
  });

  it('accepts exactly 60 characters', () => {
    const sixty = 'a'.repeat(60);
    expect(categoryNameSchema.parse(sixty)).toBe(sixty);
  });
});

describe('positiveAmountSchema', () => {
  it('coerces a numeric string', () => {
    expect(positiveAmountSchema.parse('12.5')).toBe(12.5);
  });

  it('rejects zero, negative, and non-numeric input', () => {
    expect(positiveAmountSchema.safeParse('0').success).toBe(false);
    expect(positiveAmountSchema.safeParse('-1').success).toBe(false);
    expect(positiveAmountSchema.safeParse('abc').success).toBe(false);
  });
});

describe('nonNegativeAmountSchema', () => {
  it('accepts zero', () => {
    expect(nonNegativeAmountSchema.parse('0')).toBe(0);
  });

  it('rejects negative input', () => {
    expect(nonNegativeAmountSchema.safeParse('-1').success).toBe(false);
  });
});

describe('nudgePctSchema', () => {
  it('accepts integers from 1 to 100', () => {
    expect(nudgePctSchema.parse(1)).toBe(1);
    expect(nudgePctSchema.parse(100)).toBe(100);
  });

  it('rejects 0, 101, and non-integers', () => {
    expect(nudgePctSchema.safeParse(0).success).toBe(false);
    expect(nudgePctSchema.safeParse(101).success).toBe(false);
    expect(nudgePctSchema.safeParse(50.5).success).toBe(false);
  });
});
