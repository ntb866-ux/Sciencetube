/* Sciencetube service worker.
   - The site itself (page, video list, icons): network first, so every update shows up at once; the cached copy is used offline.
   - Fonts: cached after first use.
   - Thumbnails: cached after first use, capped so the cache stays small.
   - YouTube players are never cached (they need the network anyway). */
const VER = 'st-v2';
const CORE = ['./', './index.html', './videos.json', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './icons/icon.svg'];
const IMG_MAX = 400;

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VER + '-core').then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(ks => Promise.all(ks.filter(k => !k.startsWith(VER)).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

async function networkFirst(req) {
  const c = await caches.open(VER + '-core');
  try {
    const r = await fetch(req, { cache: 'no-cache' });
    if (r.ok) c.put(req, r.clone());
    return r;
  } catch (err) {
    const hit = await c.match(req, { ignoreSearch: true }) || (req.mode === 'navigate' && await c.match('./index.html'));
    if (hit) return hit;
    throw err;
  }
}
async function cacheFirst(req, name, max) {
  const c = await caches.open(name);
  const hit = await c.match(req);
  if (hit) return hit;
  const r = await fetch(req);
  if (r.ok || r.type === 'opaque') {
    c.put(req, r.clone());
    if (max) c.keys().then(ks => { if (ks.length > max) ks.slice(0, ks.length - max).forEach(k => c.delete(k)) });
  }
  return r;
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const u = new URL(req.url);
  if (u.origin === location.origin) return e.respondWith(networkFirst(req));
  if (u.hostname === 'fonts.googleapis.com' || u.hostname === 'fonts.gstatic.com') return e.respondWith(cacheFirst(req, VER + '-fonts'));
  if (u.hostname === 'i.ytimg.com') return e.respondWith(cacheFirst(req, VER + '-img', IMG_MAX));
});
