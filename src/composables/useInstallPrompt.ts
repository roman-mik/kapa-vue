import { computed, ref } from 'vue';

// Chrome/Android-only: fires once, and only if the manifest + service
// worker already satisfy the browser's own installability checks. Safari
// never fires this — iOS users add-to-home-screen manually via the Share
// sheet, which needs only the manifest/apple-touch-icon already in
// index.html, nothing this composable can trigger or detect.
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

// Module-level: the event is captured once per page load, so every consumer
// shares it. The listeners are registered at module load (not on first
// consumer mount) because `beforeinstallprompt` fires exactly once, usually
// early in the session — if the only consumer lived in a lazy route chunk,
// mounting it after the event fired would lose the install prompt forever.
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

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
  window.addEventListener('appinstalled', onAppInstalled);
}

export function useInstallPrompt() {
  async function promptInstall(): Promise<void> {
    const event = deferredPrompt.value;
    // Clear synchronously so a rapid second call can't invoke prompt() on the
    // same captured event (the browser rejects the second prompt()).
    deferredPrompt.value = null;
    if (!event) return;
    await event.prompt();
    await event.userChoice;
  }

  return {
    canInstall: computed(() => deferredPrompt.value !== null),
    installed,
    promptInstall,
  };
}
