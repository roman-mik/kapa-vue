import { onScopeDispose, ref } from 'vue';

// Module-level, not per-component: every consumer should see the exact
// same online/offline state, and there's only ever one pair of browser
// events to listen for regardless of how many components ask.
const isOnline = ref(navigator.onLine);

function setOnline(): void {
  isOnline.value = true;
}
function setOffline(): void {
  isOnline.value = false;
}

let listenerCount = 0;

export function useOnlineStatus() {
  if (listenerCount === 0) {
    window.addEventListener('online', setOnline);
    window.addEventListener('offline', setOffline);
  }
  listenerCount++;

  onScopeDispose(() => {
    listenerCount--;
    if (listenerCount === 0) {
      window.removeEventListener('online', setOnline);
      window.removeEventListener('offline', setOffline);
    }
  });

  return { isOnline };
}
