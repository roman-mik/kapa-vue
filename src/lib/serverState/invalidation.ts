import { shallowReactive } from 'vue';
import { queryCache } from './queryCache';

const versions = shallowReactive(new Map<string, number>());
export function mutationVersion(userId: string, spaceId: string): number {
  return versions.get(JSON.stringify([userId, spaceId])) ?? 0;
}

/** Reads affected by a successful write, including derived projections. */
const dependents: Record<string, readonly string[]> = {
  paymentTracking: ['accounts', 'pocketExpenses', 'projection', 'paymentHistory'],
  accounts: ['projection', 'paymentTracking'],
  cap: ['projection', 'paymentTracking'],
  categoryCapRules: ['projection', 'paymentTracking'],
  pocketExpenses: ['projection', 'paymentTracking'],
  incomeStreams: ['projection', 'paymentTracking'],
  obligations: ['projection', 'paymentTracking'],
  oneOffEvents: ['projection', 'paymentTracking'],
  plannedSpend: ['projection', 'paymentTracking'],
  horizonSettings: ['projection', 'paymentTracking'],
  workCalendar: ['incomeStreams', 'obligations', 'projection', 'paymentTracking'],
  holidays: ['workCalendar', 'incomeStreams', 'obligations', 'projection', 'paymentTracking'],
};

export async function invalidateResources(
  userId: string,
  spaceId: string,
  resource: string
): Promise<void> {
  const resources = new Set([resource, ...(dependents[resource] ?? [])]);
  await Promise.all([...resources].map((name) => queryCache.invalidate([userId, spaceId, name])));
  const key = JSON.stringify([userId, spaceId]);
  versions.set(key, (versions.get(key) ?? 0) + 1);
}
