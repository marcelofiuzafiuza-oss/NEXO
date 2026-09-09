const CACHE = 'nexo-pwa-1.8.2';
const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-512.png',
  '/icons/apple-touch-icon.png'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(APP_SHELL)));
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE && k.startsWith('nexo-pwa-')).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Nunca interferir na rota de autenticação Firebase/Google.
  if (url.pathname.startsWith('/__/auth/')) return;

  // Não cachear chamadas externas, Firebase, Hotmart ou WhatsApp.
  if (url.origin !== self.location.origin) return;

  // Navegação: rede primeiro, cache só como fallback offline.
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        if (fresh && fresh.ok) {
          const cache = await caches.open(CACHE);
          cache.put('/index.html', fresh.clone());
        }
        return fresh;
      } catch (_) {
        return (await caches.match('/index.html')) || (await caches.match('/'));
      }
    })());
    return;
  }

  // Arquivos PWA locais: cache primeiro com atualização em segundo plano.
  if (url.pathname === '/manifest.webmanifest' || url.pathname.startsWith('/icons/')) {
    event.respondWith((async () => {
      const cached = await caches.match(req);
      const network = fetch(req).then(async res => {
        if (res && res.ok) (await caches.open(CACHE)).put(req, res.clone());
        return res;
      }).catch(() => null);
      return cached || (await network) || Response.error();
    })());
  }
});
