import { queryCache } from './queryCache';

/** Reads affected by a successful write, including derived projections. */
const dependents: Record<string, readonly string[]> = {
  accounts: ['projection'],
  cap: ['projection'],
  categoryCapRules: ['projection'],
  pocketExpenses: ['projection'],
  incomeStreams: ['projection'],
  obligations: ['projection'],
  oneOffEvents: ['projection'],
  plannedSpend: ['projection'],
  horizonSettings: ['projection'],
  workCalendar: ['incomeStreams', 'obligations', 'projection'],
  holidays: ['workCalendar', 'incomeStreams', 'obligations', 'projection'],
};

export async function invalidateResources(
  userId: string,
  spaceId: string,
  resource: string
): Promise<void> {
  const resources = new Set([resource, ...(dependents[resource] ?? [])]);
  await Promise.all([...resources].map((name) => queryCache.invalidate([userId, spaceId, name])));
}
