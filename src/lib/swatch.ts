import { SWATCH_SLOTS, type SwatchSlot } from '@roman-mik/kapa-core/theme';

/**
 * A swatch slot is a theme-agnostic *name* (`swatch1`…`swatch8`); the hex
 * lives in each theme and is generated into `--kapa-swatch-1..8` custom
 * properties by vite.config.ts's theme-css plugin. Same slot ⇒ same
 * semantic colour in every theme.
 */
export function swatchCssVar(slot: SwatchSlot): string {
  const index = SWATCH_SLOTS.indexOf(slot);
  if (index === -1) return 'transparent';
  return `var(--kapa-swatch-${index + 1})`;
}
