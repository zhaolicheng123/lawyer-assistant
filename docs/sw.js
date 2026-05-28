// 律师工作助手 — Service Worker
const CACHE_NAME = 'lawyer-assistant-v1';
const STATIC_FILES = ['/', '/index.html', '/manifest.json', '/icon.svg'];

// ===== Install =====
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_FILES).catch((err) => {
        console.warn('SW: cache preload partial failure', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// ===== Activate =====
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      );
    }).then(() => self.clients.claim())
  );
});

// ===== Fetch (handle share target) =====
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Intercept share target POST
  if (url.pathname.endsWith('/share-target') && event.request.method === 'POST') {
    event.respondWith(handleShareTarget(event.request));
    return;
  }

  // Cache-first for static files, network fallback
  event.respondWith(
    caches.match(event.request).then((cached) => {
      return cached || fetch(event.request);
    })
  );
});

async function handleShareTarget(request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');

    if (!file || !(file instanceof Blob)) {
      return Response.redirect('/?shared=0', 302);
    }

    // Store file in Cache API so the main page can retrieve it
    const cache = await caches.open('shared-files');
    const response = new Response(file, {
      headers: {
        'Content-Type': file.type || 'application/octet-stream',
        'X-Shared-Filename': encodeURIComponent(file.name || 'unknown.pdf'),
        'X-Shared-Time': Date.now().toString()
      }
    });
    await cache.put('/pending-shared-file', response);

    // Redirect to main page
    return Response.redirect('/?shared=1', 302);
  } catch (err) {
    console.error('SW: share target error', err);
    return Response.redirect('/?shared=0', 302);
  }
}
