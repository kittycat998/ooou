// A basic service worker to make the app installable
self.addEventListener('install', (event) => {
  console.log('Service worker installing...');
});

self.addEventListener('fetch', (event) => {
  // This basic service worker doesn't intercept any requests.
  // It just lets the browser handle them as usual.
  return;
});

// OVO_KEEPALIVE_NOTIFICATION_PATCH
self.addEventListener('message', (event) => {
  const data = event.data || {};
  if (data.type === 'OVO_SHOW_NOTIFICATION') {
    const title = data.title || 'OVO';
    const options = data.options || {};
    event.waitUntil(self.registration.showNotification(title, {
      body: options.body || '你有一条新消息',
      icon: options.icon || './manifest.json',
      badge: options.badge || './manifest.json',
      tag: options.tag || 'ovo-message',
      data: options.data || {},
      requireInteraction: !!options.requireInteraction
    }));
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow('./');
    })
  );
});
