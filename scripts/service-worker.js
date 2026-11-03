/* The build inserts only public assets. Never cache API or personal data. */
const SHELL = 'pocket-next-__BUILD_ID__'
const PRECACHE = /* PRECACHE_URLS */ []
self.addEventListener('install', event => {
  event.waitUntil(caches.open(SHELL).then(cache => cache.addAll(PRECACHE)).then(() => self.skipWaiting()))
})
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== SHELL).map(key => caches.delete(key)))).then(() => self.clients.claim()))
})
self.addEventListener('fetch', event => {
  const { request } = event
  const url = new URL(request.url)
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/') || request.headers.has('RSC')) return
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match('/')))
    return
  }
  if (!url.pathname.startsWith('/_next/static/') && !url.pathname.startsWith('/icons/') && url.pathname !== '/favicon.svg') return
  event.respondWith(caches.open(SHELL).then(async cache => {
    const cached = await cache.match(request)
    if (cached) return cached
    const response = await fetch(request)
    if (response.ok) await cache.put(request, response.clone())
    return response
  }))
})
