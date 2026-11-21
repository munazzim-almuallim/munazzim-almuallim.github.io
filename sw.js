/* منظّم المعلم — تخزين واجهة المنصة لفتحها بسرعة وتثبيتها كتطبيق.
   البيانات نفسها لا تُخزَّن هنا؛ تأتي دائمًا من الخادم. */
const CACHE = 'teacher-hub-v10';
const SHELL = ['./', 'index.html', 'styles.css', 'config.js', 'core.js', 'views-a.js', 'views-b.js', 'views-c.js', 'fill.js', 'views-d.js', 'boot.js', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;   // API, storage and CDN go straight to the network
  // network first so updates appear at once; fall back to the cached copy when offline
  e.respondWith(fetch(e.request.url, {cache: 'no-cache', credentials: 'same-origin'}).then(r => { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return r; }).catch(() => caches.match(e.request).then(r => r || caches.match('index.html'))));
});
