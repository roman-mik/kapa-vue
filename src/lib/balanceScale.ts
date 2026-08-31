// Shared Y-axis geometry between BalanceLineChart and WaterfallChart: both
// plot balances (a day series and a bucket series, respectively) against the
// same kind of vertical scale, always including zero so the zero line and
// negative-region shading are geometrically consistent between the two views.
export interface BalanceDomain {
  min: number;
  max: number;
}

export function balanceDomain(balances: number[]): BalanceDomain {
  return {
    min: Math.min(0, ...balances),
    max: Math.max(0, ...balances, 1),
  };
}

export function balanceScaleY(
  balance: number,
  domain: BalanceDomain,
  top: number,
  height: number
): number {
  const range = domain.max - domain.min || 1;
  return top + height - ((balance - domain.min) / range) * height;
}
