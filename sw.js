// Flui — service worker: guarda os arquivos do app para abrir rápido e funcionar sem internet
const VERSAO = 'flui-v132';
const ARQUIVOS = ['./', './index.html', './css/app.css?v=132', './js/app.js?v=132', './js/calc.js?v=132', './js/store.js?v=132', './js/ui.js?v=132', './js/config.js?v=132', './js/icones.js?v=132', './js/importar.js?v=132', './manifest.webmanifest', './icons/icon.svg', './icons/icon-192.png'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(VERSAO).then((c) => c.addAll(ARQUIVOS.map((u) => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSAO).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  const estatico = u.origin === location.origin || u.hostname === 'www.gstatic.com' || u.hostname.endsWith('fonts.googleapis.com') || u.hostname.endsWith('fonts.gstatic.com');
  if (!estatico) return; // Firebase (dados) não passa pelo cache
  // rede primeiro (pega atualizações), cache se estiver sem internet
  e.respondWith((u.origin === location.origin ? fetch(e.request.url, { cache: 'no-cache', credentials: 'same-origin' }) : fetch(e.request)).then((r) => { if (r.ok) { const cp = r.clone(); caches.open(VERSAO).then((c) => c.put(e.request, cp)); } return r; }).catch(() => caches.match(e.request).then((r) => r || caches.match('./index.html'))));
});

// notificações (enviadas uma vez por dia pelo Flui)
self.addEventListener('push', (e) => {
  let p = {}; try { p = e.data ? e.data.json() : {}; } catch { p = { data: { title: 'Flui', body: e.data && e.data.text() } }; }
  const d = { ...(p.notification || {}), ...(p.data || {}) };
  e.waitUntil(self.registration.showNotification(d.title || 'Flui', { body: d.body || '', icon: './icons/icon-192.png', badge: './icons/icon-192.png', data: { link: d.link || './' } }));
});
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const alvo = new URL(e.notification.data?.link || './', self.registration.scope).href;
  e.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then((cs) => { const c = cs.find((x) => x.url.startsWith(self.registration.scope)); if (c) { c.navigate(alvo); return c.focus(); } return clients.openWindow(alvo); }));
});
