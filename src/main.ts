import { createPinia } from 'pinia';
import { createApp } from 'vue';
import App from './App.vue';
import router from './router';
import { useSessionStore } from './stores/session';
import { useThemeStore } from './stores/theme';
import './styles/main.css';
// Side-effect import: registers the beforeinstallprompt/appinstalled
// listeners at startup, so the one-shot beforeinstallprompt event is captured
// even though the only component that reads it (Settings) is a lazy chunk.
import './composables/useInstallPrompt';

const app = createApp(App);
app.use(createPinia());

useThemeStore().init();

// Awaited before the router starts navigating, so its first guard sees the
// restored session (or its absence) instead of an in-flight unknown. The
// space store is initialized lazily by the router guard itself (it needs
// an authenticated caller, and must also re-run after a login navigation,
// not just on startup).
await useSessionStore().init();

app.use(router);
app.mount('#app');

// Registered after mount, not blocking startup — a failed registration
// (unsupported browser, non-secure context in some dev setups) shouldn't
// affect the app; it only forfeits the install prompt.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}
