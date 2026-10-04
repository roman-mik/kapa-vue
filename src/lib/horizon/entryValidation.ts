import { z } from 'zod';

export const entryDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Pick a valid date.')
  .refine((value) => {
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(`${value}T12:00:00Z`);
    return (
      Number.isFinite(date.getTime()) &&
      date.getUTCFullYear() === year &&
      date.getUTCMonth() + 1 === month &&
      date.getUTCDate() === day
    );
  }, 'Pick a valid date.');
