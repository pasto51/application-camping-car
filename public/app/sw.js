// Service worker of the customer app. __APP_VERSION__ is replaced by the server on every deploy,
// so a new deploy installs a new worker and the app offers the update.
const VERSION = '__APP_VERSION__';
const SHELL_CACHE = `shell-${VERSION}`;
const PHOTO_CACHE = 'photos-v1';
const SHELL = ['/app/', '/app/app.js', '/app/styles.css', '/app/manifest.webmanifest', '/app/icon.svg', '/shared/common.js'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('shell-') && k !== SHELL_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
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
