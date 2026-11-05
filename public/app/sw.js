// Cache only the public hub shell. Never cache APIs, accounts, or gallery media.
const CACHE = 'rcap-hub-v2';
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    const response = await fetch('/app/', {cache:'reload'});
    if (!response.ok) throw new Error('Hub unavailable');
    const html = await response.clone().text();
    // Vite lists the entry, shared chunks, and CSS in the initial HTML.
    const assets = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map(match => match[1]);
    await cache.addAll([...new Set([...assets, '/brand/we-are-rcap.svg', '/brand/rcap.svg', '/app-assets/community-wide.jpg', '/app-assets/icon-180.png', '/app-assets/icon-192.png'])]);
    await cache.put('/app/', response);
  })());
});
self.addEventListener('activate', event => { event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('rcap-hub-') && k !== CACHE).map(k => caches.delete(k))))); });
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;
  const shell = event.request.mode === 'navigate' && /^\/app\/?$/.test(url.pathname);
  const asset = url.pathname.startsWith('/assets/') && ['script','style'].includes(event.request.destination)
    || url.pathname.startsWith('/app-assets/') || url.pathname.startsWith('/brand/');
  if (!shell && !asset) return;
  event.respondWith(fetch(event.request).then(response => {
    if (response.ok) { const copy = response.clone(); event.waitUntil(caches.open(CACHE).then(c => c.put(event.request, copy))); }
    return response;
  }).catch(async () => (await caches.match(event.request, {ignoreVary: asset})) || (shell ? caches.match('/app/') : Response.error())));
});
