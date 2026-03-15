// CampMate Australia — Service Worker
// Handles offline caching, background sync, and push notifications

const CACHE_VERSION = 'campmate-v5-20260315-final';
const STATIC_CACHE  = `${CACHE_VERSION}-static`;
const DATA_CACHE    = `${CACHE_VERSION}-data`;
const IMAGE_CACHE   = `${CACHE_VERSION}-images`;

// Core files — always cache on install
const STATIC_ASSETS = [
  '/',
  '/categories',
  '/popular',
  '/guides',
  '/about',
  '/contact',
  '/privacy',
  '/disclosure',
  '/tents',
  '/chairs',
  '/coolers',
  '/stoves',
  '/lanterns',
  '/sleeping-bags',
  '/assets/style.css',
  '/assets/common.js',
  '/assets/data.js',
  '/assets/icons/icon-192x192.png',
  '/assets/icons/icon-512x512.png',
  '/manifest.json',
];

// Data files — cache with network-first strategy
const DATA_ASSETS = [
  '/data/products.json',
  '/data/categories.json',
];

// ─── Install ─────────────────────────────────────────────
self.addEventListener('install', event => {
  console.log('[SW] Installing CampMate Service Worker');
  event.waitUntil(
    Promise.all([
      caches.open(STATIC_CACHE).then(cache => {
        return cache.addAll(STATIC_ASSETS).catch(err => {
          console.warn('[SW] Some static assets failed to cache:', err);
        });
      }),
      caches.open(DATA_CACHE).then(cache => {
        return cache.addAll(DATA_ASSETS).catch(err => {
          console.warn('[SW] Data assets failed to cache:', err);
        });
      }),
    ])
  );
  self.skipWaiting();
});

// ─── Activate ────────────────────────────────────────────
self.addEventListener('activate', event => {
  console.log('[SW] Activating CampMate Service Worker');
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key.startsWith('campmate-') && key !== STATIC_CACHE && key !== DATA_CACHE && key !== IMAGE_CACHE)
          .map(key => {
            console.log('[SW] Deleting old cache:', key);
            return caches.delete(key);
          })
      )
    )
  );
  self.clients.claim();
});

// ─── Fetch ───────────────────────────────────────────────
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET and external requests (eBay API etc)
  if (request.method !== 'GET') return;
  if (!url.origin.includes(self.location.origin) && !url.pathname.startsWith('/')) return;

  // API calls — network only (don't cache eBay/Google search results)
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  // Keep technical crawler files network-only.
  if ((url.pathname === '/sitemap.xml' || (url.pathname.startsWith('/sitemap-') && url.pathname.endsWith('.xml'))) || url.pathname === '/robots.txt' || url.pathname.startsWith('/google')) {
    return;
  }

  // Product images — cache first, fallback to network
  if (url.pathname.startsWith('/assets/images/')) {
    event.respondWith(cacheFirst(request, IMAGE_CACHE));
    return;
  }

  // Data JSON — network first, fallback to cache
  if (url.pathname.startsWith('/data/')) {
    event.respondWith(networkFirst(request, DATA_CACHE));
    return;
  }

  // Static assets (CSS, JS, icons) — cache first
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // HTML pages — network first with cache fallback
  event.respondWith(networkFirst(request, STATIC_CACHE));
});

// ─── Strategies ──────────────────────────────────────────

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response('Offline — resource not cached', { status: 503 });
  }
}

async function networkFirst(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    // Offline fallback for HTML pages
    if (request.headers.get('accept')?.includes('text/html')) {
      const fallback = await caches.match('/');
      if (fallback) return fallback;
    }
    return new Response(offlinePage(), {
      status: 503,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }
}

function offlinePage() {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Offline — CampMate Australia</title>
<style>
  body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;
    background:#061325;color:#ebf4ff;font-family:Arial,sans-serif;text-align:center;padding:24px}
  .wrap{max-width:360px}
  .icon{font-size:64px;margin-bottom:16px}
  h1{font-size:1.4rem;margin:0 0 12px;color:#63e2ff}
  p{color:#a7bbdb;line-height:1.6;margin:0 0 24px}
  a{display:inline-block;padding:12px 28px;background:#63e2ff;color:#061325;
    border-radius:12px;text-decoration:none;font-weight:700}
</style>
</head>
<body>
<div class="wrap">
  <div class="icon">⛺</div>
  <h1>You're offline</h1>
  <p>CampMate needs a connection to compare live prices.<br>
  Check previously browsed pages — they're saved for offline viewing.</p>
  <a href="/">Go home</a>
</div>
</body>
</html>`;
}

// ─── Push Notifications ───────────────────────────────────
self.addEventListener('push', event => {
  if (!event.data) return;
  let data;
  try { data = event.data.json(); } catch { data = { title: 'CampMate', body: event.data.text() }; }

  event.waitUntil(
    self.registration.showNotification(data.title || 'CampMate Australia', {
      body: data.body || 'New deals available!',
      icon: '/assets/icons/icon-192x192.png',
      badge: '/assets/icons/icon-96x96.png',
      tag: data.tag || 'campmate-promo',
      data: { url: data.url || '/' },
      actions: [
        { action: 'view', title: 'View deals' },
        { action: 'dismiss', title: 'Dismiss' },
      ],
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  if (event.action === 'dismiss') return;
  const targetUrl = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
      const existing = windowClients.find(c => c.url.includes(self.location.origin));
      if (existing) return existing.focus().then(c => c.navigate(targetUrl));
      return clients.openWindow(targetUrl);
    })
  );
});
