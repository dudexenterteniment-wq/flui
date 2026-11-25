// Flui — service worker: guarda os arquivos do app para abrir rápido e funcionar sem internet
const VERSAO = 'flui-v57';
const ARQUIVOS = ['./', './index.html', './css/app.css?v=57', './js/app.js?v=57', './js/calc.js?v=57', './js/store.js?v=57', './js/ui.js?v=57', './js/config.js?v=57', './js/icones.js?v=57', './js/importar.js?v=57', './manifest.webmanifest', './icons/icon.svg', './icons/icon-192.png'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(VERSAO).then((c) => c.addAll(ARQUIVOS)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSAO).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  const estatico = u.origin === location.origin || u.hostname === 'www.gstatic.com' || u.hostname.endsWith('fonts.googleapis.com') || u.hostname.endsWith('fonts.gstatic.com');
  if (!estatico) return; // Firebase (dados) não passa pelo cache
  // rede primeiro (pega atualizações), cache se estiver sem internet
  e.respondWith(fetch(e.request).then((r) => { if (r.ok) { const cp = r.clone(); caches.open(VERSAO).then((c) => c.put(e.request, cp)); } return r; }).catch(() => caches.match(e.request).then((r) => r || caches.match('./index.html'))));
});
