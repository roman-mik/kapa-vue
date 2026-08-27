// Deliberately no offline caching yet — the offline *banner*
// (OfflineBanner.vue) is this app's offline story for now. This service
// worker exists only to satisfy the browsers' installability checks, which
// require a registered worker with a fetch handler; a no-op handler is a
// plain network passthrough, not a cache.
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', () => {});
