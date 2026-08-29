import { z } from 'zod';

export const categoryNameSchema = z
  .string()
  .trim()
  .min(1, 'Enter a name.')
  .max(60, 'Category names are limited to 60 characters.');

export const displayNameSchema = z
  .string()
  .trim()
  .max(60, 'Display names are limited to 60 characters.')
  .transform((val) => (val === '' ? null : val))
  .nullable();

export const positiveAmountSchema = z.coerce
  .number({ error: 'Enter a valid amount.' })
  .positive('Enter a valid amount.');

export const nonNegativeAmountSchema = z.coerce
  .number({ error: 'Enter a valid amount.' })
  .min(0, 'Enter a valid amount.');

export const nudgePctSchema = z.coerce
  .number({ error: 'Enter a value between 1 and 100.' })
  .int('Enter a whole number between 1 and 100.')
  .min(1, 'Enter a value between 1 and 100.')
  .max(100, 'Enter a value between 1 and 100.');

/** The first schema-authored message for a failed parse, for a form's single error line. */
export function firstIssueMessage(result: z.ZodSafeParseResult<unknown>): string | undefined {
  return result.success ? undefined : result.error.issues[0]?.message;
}
