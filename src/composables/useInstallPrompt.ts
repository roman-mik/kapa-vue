import { computed, onScopeDispose, ref } from 'vue';

// Chrome/Android-only: fires once, and only if the manifest + service
// worker already satisfy the browser's own installability checks. Safari
// never fires this — iOS users add-to-home-screen manually via the Share
// sheet, which needs only the manifest/apple-touch-icon already in
// index.html, nothing this composable can trigger or detect.
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

// Module-level: the event can only be captured once per page load,
// whichever component mounts first — every consumer shares it.
const deferredPrompt = ref<BeforeInstallPromptEvent | null>(null);
const installed = ref(false);

function onBeforeInstallPrompt(event: Event): void {
  event.preventDefault();
  deferredPrompt.value = event as BeforeInstallPromptEvent;
}

function onAppInstalled(): void {
  deferredPrompt.value = null;
  installed.value = true;
}

let listenerCount = 0;

export function useInstallPrompt() {
  if (listenerCount === 0) {
    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onAppInstalled);
  }
  listenerCount++;

  onScopeDispose(() => {
    listenerCount--;
    if (listenerCount === 0) {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onAppInstalled);
    }
  });

  async function promptInstall(): Promise<void> {
    const event = deferredPrompt.value;
    if (!event) return;
    await event.prompt();
    await event.userChoice;
    deferredPrompt.value = null;
  }

  return {
    canInstall: computed(() => deferredPrompt.value !== null),
    installed,
    promptInstall,
  };
}
