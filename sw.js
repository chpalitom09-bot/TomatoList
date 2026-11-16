const CACHE_NAME = 'tomatolist-v4';
const APP_SHELL = [
  './',
  './index.html',
  './pays.json',
  './lang.json',
  './algo.js',
  './fiche-visuals.js',
  './color-detect.js',
  './color-ai.js',
  './wiki.js',
  './article.js',
  './ai.js',
  './countries-shapes.json',
  './auth.html',
  './manifest.json',
  './icon.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  // App shell : cache d'abord, puis réseau (fonctionne hors-ligne)
  const url = new URL(req.url);
  // Modèles d'IA et bibliothèque (Hugging Face / jsDelivr) : gros fichiers, déjà mis en cache par transformers.js → on ne s'en mêle pas
  if (/(^|\.)(huggingface\.co|hf\.co|jsdelivr\.net)$/.test(url.hostname) || url.hostname.includes('xethub')) return;
  const isAppShell = url.origin === self.location.origin;

  if (isAppShell) {
    event.respondWith(
      caches.match(req).then((cached) => {
        const fetchPromise = fetch(req).then((res) => {
          if (res && res.status === 200) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          }
          return res;
        }).catch(() => cached);
        return cached || fetchPromise;
      })
    );
  } else {
    // Ressources externes (Firebase, CDN, images) : réseau d'abord, repli sur le cache si hors-ligne
    event.respondWith(
      fetch(req).then((res) => {
        const clone = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(req, clone)).catch(() => {});
        return res;
      }).catch(() => caches.match(req))
    );
  }
});
