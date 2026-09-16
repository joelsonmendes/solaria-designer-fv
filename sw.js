const CACHE = 'solaria-fv-v1';
const CORE = ['/', '/index.html', '/styles.css', '/app.js', '/manifest.webmanifest'];
self.addEventListener('install', e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE))));
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', e => {
  if (e.request.url.includes('/api/')) return;
  e.respondWith(caches.match(e.request).then(cached => cached || fetch(e.request).then(r => {
    const clone = r.clone(); caches.open(CACHE).then(c => c.put(e.request, clone)); return r;
  }).catch(() => cached)));
});
