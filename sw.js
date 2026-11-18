const CACHE = 'cursed-grove-1795019262';
const FILES = ['./', 'index.html', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE && k !== 'cg-remind').map(k => caches.delete(k)))).then(() => self.clients.claim())); });
// Pages come from the network first (so updates always arrive), falling back to the saved copy when offline.
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== self.location.origin) return;
  const isPage = e.request.mode === 'navigate' || /\/(index\.html)?$/.test(new URL(e.request.url).pathname);
  if (isPage) {
    e.respondWith(fetch(e.request, { cache: 'no-store' }).then(res => { const copy = res.clone(); caches.open(CACHE).then(c => c.put('index.html', copy)); return res; }).catch(() => caches.match('index.html')));
    return;
  }
  e.respondWith(caches.match(e.request).then(hit => hit || fetch(e.request).then(res => { const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return res; })));
});

// ---- reminders: read the schedule the page saved and show anything that is due
const RK = 'cg-remind';
async function rdState() { try { const c = await caches.open(RK); const r = await c.match('state'); return r ? await r.json() : null; } catch (e) { return null; } }
async function wrState(s) { const c = await caches.open(RK); await c.put('state', new Response(JSON.stringify(s))); }
async function remindRun(force) {
  const s = await rdState();
  if (!s || !s.on) return;
  const now = Date.now();
  const cl = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  if (!force && cl.some(c => c.visibilityState === 'visible')) return;
  const sent = s.sent || {}, due = [];
  for (const e of s.events || []) {
    if (sent[e.k] || e.at > now) continue;
    sent[e.k] = now;
    if (e.soft && now - e.at > 36 * 3600000) continue;
    due.push(e);
  }
  s.sent = sent;
  await wrState(s);
  for (const e of due) await self.registration.showNotification('Cursed Grove', { body: e.body, icon: 'icon-192.png', badge: 'icon-192.png', tag: 'cg-' + e.k });
}
self.addEventListener('periodicsync', e => { if (e.tag === 'cg-remind') e.waitUntil(remindRun(false)); });
self.addEventListener('message', e => { if (e.data && e.data.type === 'cg-remind-run') e.waitUntil(remindRun(!!e.data.force)); });
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cl => (cl.length ? cl[0].focus() : self.clients.openWindow('./'))));
});
