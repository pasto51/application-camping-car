// Service worker of the customer app. __APP_VERSION__ is replaced by the server on every deploy,
// so a new deploy installs a new worker, which takes over right away (open pages reload themselves).
const VERSION = '__APP_VERSION__';
const SHELL_CACHE = `shell-${VERSION}`;
const PHOTO_CACHE = 'photos-v1';
const SHELL = ['/app/', '/app/compagnon.js', '/app/cloud.js', '/app/cloud.css', '/app/manifest.webmanifest', '/app/icon.svg', '/app/plan-van.svg'];

self.addEventListener('install', (event) => {
  // No waiting: an outdated app must never stay on screen (it may not understand the new server).
  event.waitUntil(caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== SHELL_CACHE && k !== PHOTO_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // API data is cached by the app itself; always go to the network.
  if (url.pathname.startsWith('/api/')) return;

  // Uploaded photos have unique names: cache them for offline use.
  if (url.pathname.startsWith('/uploads/')) {
    event.respondWith(
      caches.open(PHOTO_CACHE).then(async (cache) => {
        const hit = await cache.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) cache.put(req, res.clone());
        return res;
      })
    );
    return;
  }

  // App shell: cache first, network as fallback.
  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then((hit) => hit || fetch(req).catch(() => caches.match('/app/')))
  );
});

// Push notification from the dealership (answer to a request).
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data && event.data.text() };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || 'Compagnon de bord', {
      body: data.body || 'Vous avez un nouveau message.',
      icon: '/app/icon.svg',
      badge: '/app/icon.svg',
      tag: data.tag,
      data: { url: data.url || '/app/' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL(event.notification.data && event.notification.data.url || '/app/', self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) if (c.url.startsWith(self.location.origin + '/app/')) return c.focus().then((w) => w && w.navigate ? w.navigate(url) : w);
      return self.clients.openWindow(url);
    })
  );
});
