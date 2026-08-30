import { BREAKPOINT } from '@roman-mik/kapa-core/theme';
import { onScopeDispose, ref } from 'vue';

function desktopQuery(): string {
  return `(min-width: ${BREAKPOINT.lg}px)`;
}

/**
 * Reactive viewport gate used to pick Horizon's phone-vs-desktop shell.
 * Returns `isDesktop`, true when the viewport is at or above the kapa-core
 * `BREAKPOINT.lg` token. Each call sets up its own matchMedia listener and
 * tears it down on scope dispose, so it's safe to use anywhere a component
 * needs to react to the breakpoint (and unused listeners don't linger).
 *
 * SSR-safe: when there is no `window`, defaults to non-desktop (false).
 */
export function useViewport() {
  const isDesktop = ref(false);

  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return { isDesktop };
  }

  const mql = window.matchMedia(desktopQuery());
  isDesktop.value = mql.matches;

  function onViewportChange(event: MediaQueryListEvent): void {
    isDesktop.value = event.matches;
  }

  mql.addEventListener('change', onViewportChange);
  onScopeDispose(() => mql.removeEventListener('change', onViewportChange));

  return { isDesktop };
}
