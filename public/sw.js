// Offline story: an app-shell runtime cache so the SPA can start while
// offline once the shell has been seen. This replaces the old no-op
// passthrough, which only ever satisfied browser installability checks.
//
// Strategy, chosen for a hashed-asset Vite SPA whose chunk filenames aren't
// known at build time (public/sw.js isn't processed by Vite), so a hand-
// written precache list could never name the hashed entry chunks:
//   - navigation requests: network-first, falling back to the cached shell
//     (index.html) when offline;
//   - hashed /assets/* chunks: cache-first with a background refresh — the
//     content-hash makes them immutable, so serving the cached copy is safe;
//   - static shell files (manifest, icons): cache-first;
//   - everything else (API traffic): never cached.
//
// Tradeoffs, consciously: a true *first* launch while offline (before the
// shell has ever been cached) still fails — that needs a build-time precache
// manifest a plain public/ worker can't produce — but after the app has
// loaded once, cold starts work. Cache invalidation is handled by a versioned
// cache name (bump it to invalidate) plus deleting stale keys on activate.
const CACHE = 'kapa-shell-v1';
const PRECACHE = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/favicon.svg',
  '/apple-touch-icon.png',
];

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const fresh = await fetch(request);
    if (fresh.ok) await cache.put(request, fresh.clone());
    return fresh;
  } catch {
    const cached = await cache.match(request, { ignoreSearch: true });
    if (cached) return cached;
    const shell = await cache.match('/index.html');
    if (shell) return shell;
    // Absolute last resort: a bare offline page, so navigation never hard-fails.
    return new Response(
      '<main style="font-family:system-ui;padding:2rem"><h1>You&#39;re offline</h1><p>Reconnect to keep using kapa.</p></main>',
      {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      }
    );
  }
}

async function cacheFirstWithRefresh(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  if (cached) {
    fetch(request)
      .then(async (fresh) => {
        if (fresh.ok) await cache.put(request, fresh);
      })
      .catch(() => {});
    return cached;
  }
  const fresh = await fetch(request);
  if (fresh.ok) await cache.put(request, fresh.clone());
  return fresh;
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  // Ignore cross-origin traffic (Supabase/Auth) — that's live server data.
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request));
    return;
  }

  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(cacheFirstWithRefresh(request));
    return;
  }

  if (PRECACHE.includes(url.pathname)) {
    event.respondWith(cacheFirstWithRefresh(request));
  }
});
