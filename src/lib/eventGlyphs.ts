import type { EventKind } from '@roman-mik/kapa-core/horizon';

// Shared between BalanceLineChart and WaterfallChart so both charts speak the
// same shape vocabulary — markers/bars are distinguished by shape, not just
// color, per the "no meaning by color alone" requirement.
export type GlyphShape = 'circle' | 'diamond' | 'square' | 'triangle-down' | 'triangle-up' | 'ring';

export const EVENT_GLYPHS: Record<EventKind, { shape: GlyphShape; label: string }> = {
  income: { shape: 'circle', label: 'Income' },
  oneOffIn: { shape: 'diamond', label: 'One-off in' },
  obligation: { shape: 'square', label: 'Obligation' },
  plannedSpend: { shape: 'triangle-down', label: 'Planned spend' },
  oneOffOut: { shape: 'triangle-up', label: 'One-off out' },
  pocketSpend: { shape: 'ring', label: 'Pocket spend' },
};
