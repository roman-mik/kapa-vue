// A category's proportional share of the overall monthly cap — the same
// derivation PocketHomeView's "By category" widget and CategoriesView's
// per-category bar both need, extracted once rather than duplicated a third
// time. Cap total isn't a dedicated PocketSummary field (see usePocketHome);
// callers pass whatever they've already recovered it as.
export function categorySharePct(spentMinor: number, capMinor: number): number {
  return capMinor > 0 ? Math.min((spentMinor / capMinor) * 100, 100) : 0;
}
