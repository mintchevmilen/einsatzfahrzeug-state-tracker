// Service Worker: App Dateien laden zuerst aus dem Netz (damit Updates ankommen)
// und fallen offline auf den Zwischenspeicher zurück. Supabase Anfragen werden nicht angefasst.
const CACHE = 'fzcheck-v9';
const SHELL = [
  './',
  'index.html',
  'config.js',
  'css/style.css',
  'js/app.js',
  'js/api.js',
  'js/demo.js',
  'js/offline.js',
  'js/xlsx.js',
  'vendor/qrcode.mjs',
  'vendor/jsqr.mjs',
  'vendor/zxing.mjs',
  'vendor/fflate.mjs',
  'vendor/supabase.js',
  'manifest.webmanifest',
  'icons/icon-192.png',
  'icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req).then((m) => m || caches.match('index.html')))
  );
});
