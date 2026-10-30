/* service worker: makes the site installable and usable offline.
   pages + index.json: network first (always get the newest version, fall back to cache when offline)
   stroke data, icons, fonts: cache first
   audio .bin files use range requests and are left to the browser (not cached here) */
const VER = 'hsk-v1';
const CORE = ['./', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'donate.png'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(VER).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VER).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
async function networkFirst(req, key) {
  const c = await caches.open(VER);
  try {
    const r = await fetch(req);
    if (r.ok) c.put(key || req, r.clone());
    return r;
  } catch (err) {
    const hit = await c.match(key || req);
    if (hit) return hit;
    throw err;
  }
}
async function cacheFirst(req) {
  const c = await caches.open(VER);
  const hit = await c.match(req);
  if (hit) return hit;
  const r = await fetch(req);
  if (r.ok || r.type === 'opaque') c.put(req, r.clone());
  return r;
}
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || req.headers.has('range')) return;
  const u = new URL(req.url);
  if (u.origin === location.origin) {
    if (req.mode === 'navigate') { e.respondWith(networkFirst(req, './')); return; }
    if (u.pathname.endsWith('/audio/index.json')) { e.respondWith(networkFirst(req)); return; }
    if (u.pathname.includes('/audio/')) return;
    if (/\.(png|json|webmanifest)$/.test(u.pathname)) { e.respondWith(cacheFirst(req)); return; }
    return;
  }
  if (u.hostname === 'fonts.googleapis.com' || u.hostname === 'fonts.gstatic.com') e.respondWith(cacheFirst(req));
});
