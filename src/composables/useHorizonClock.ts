import { computed, getCurrentScope, onScopeDispose, ref } from 'vue';
import { zonedDateKey } from '@roman-mik/kapa-core/pocket';
import { useSpaceStore } from '@/stores/space';
import { useSessionStore } from '@/stores/session';
import { invalidateResources } from '@/lib/serverState/invalidation';
const now = ref(Date.now());
const returned = ref(0);
let subscribers = 0;
let timer: ReturnType<typeof setInterval> | undefined;
let hiddenAt = 0;
function tick() {
  now.value = Date.now();
}
function visibility() {
  if (document.visibilityState !== 'visible') {
    hiddenAt = Date.now();
    return;
  }
  tick();
  if (!hiddenAt || Date.now() - hiddenAt < 30_000) return;
  hiddenAt = 0;
  returned.value++;
  const user = useSessionStore().user?.id;
  const space = useSpaceStore().currentSpaceId;
  if (user && space) void invalidateResources(user, space, 'paymentTracking');
}
/** One shared timer/listener, released when the final consuming scope closes. */
export function useHorizonClock() {
  const space = useSpaceStore();
  tick();
  if (getCurrentScope()) {
    if (subscribers++ === 0) {
      timer = setInterval(tick, 30_000);
      document.addEventListener('visibilitychange', visibility);
    }
    onScopeDispose(() => {
      if (--subscribers === 0) {
        clearInterval(timer);
        timer = undefined;
        hiddenAt = 0;
        document.removeEventListener('visibilitychange', visibility);
      }
    });
  }
  return {
    today: computed(() => zonedDateKey(new Date(now.value), space.currentSpace?.timezone ?? 'UTC')),
    returned,
  };
}
