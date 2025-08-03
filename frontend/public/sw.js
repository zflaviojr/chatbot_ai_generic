/**
 * Service Worker for PWA capabilities
 * Provides offline support, caching, and background sync
 */

const CACHE_NAME = 'chatbot-web-v1.0.0';
const STATIC_CACHE = `${CACHE_NAME}-static`;
const DYNAMIC_CACHE = `${CACHE_NAME}-dynamic`;
const API_CACHE = `${CACHE_NAME}-api`;

// Files to cache immediately
const STATIC_FILES = [
  '/',
  '/index.html',
  '/src/index.js',
  '/src/styles/main.css',
  '/src/components/ChatWidget.js',
  '/src/components/ChatInterface.js',
  '/src/components/MessageHandler.js',
  '/manifest.json'
];

// API endpoints to cache
const API_ENDPOINTS = [
  '/api/health',
  '/api/config'
];

// Maximum cache size (in items)
const MAX_CACHE_SIZE = 50;

/**
 * Install event - cache static files
 */
self.addEventListener('install', (event) => {
  console.log('Service Worker installing...');
  
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => {
        console.log('Caching static files...');
        return cache.addAll(STATIC_FILES);
      })
      .then(() => {
        console.log('Static files cached successfully');
        return self.skipWaiting();
      })
      .catch(error => {
        console.error('Error caching static files:', error);
      })
  );
});

/**
 * Activate event - clean up old caches
 */
self.addEventListener('activate', (event) => {
  console.log('Service Worker activating...');
  
  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            if (cacheName !== STATIC_CACHE && 
                cacheName !== DYNAMIC_CACHE && 
                cacheName !== API_CACHE) {
              console.log('Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('Service Worker activated');
        return self.clients.claim();
      })
  );
});

/**
 * Fetch event - handle network requests
 */
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip WebSocket requests
  if (url.protocol === 'ws:' || url.protocol === 'wss:') {
    return;
  }

  // Handle different types of requests
  if (isStaticFile(request)) {
    event.respondWith(handleStaticFile(request));
  } else if (isAPIRequest(request)) {
    event.respondWith(handleAPIRequest(request));
  } else {
    event.respondWith(handleDynamicRequest(request));
  }
});

/**
 * Check if request is for a static file
 */
function isStaticFile(request) {
  const url = new URL(request.url);
  return STATIC_FILES.some(file => url.pathname === file) ||
         url.pathname.endsWith('.js') ||
         url.pathname.endsWith('.css') ||
         url.pathname.endsWith('.html');
}

/**
 * Check if request is for API
 */
function isAPIRequest(request) {
  const url = new URL(request.url);
  return url.pathname.startsWith('/api/');
}

/**
 * Handle static file requests - cache first strategy
 */
async function handleStaticFile(request) {
  try {
    const cache = await caches.open(STATIC_CACHE);
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
      console.log('Serving from static cache:', request.url);
      return cachedResponse;
    }

    console.log('Fetching static file:', request.url);
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.error('Error handling static file:', error);
    
    // Return offline fallback for HTML requests
    if (request.destination === 'document') {
      return caches.match('/offline.html') || new Response('Offline', { status: 503 });
    }
    
    return new Response('Network Error', { status: 503 });
  }
}

/**
 * Handle API requests - network first with cache fallback
 */
async function handleAPIRequest(request) {
  try {
    console.log('Fetching API:', request.url);
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      const cache = await caches.open(API_CACHE);
      cache.put(request, networkResponse.clone());
      await limitCacheSize(API_CACHE, MAX_CACHE_SIZE);
    }
    
    return networkResponse;
  } catch (error) {
    console.log('Network failed, trying cache for API:', request.url);
    
    const cache = await caches.open(API_CACHE);
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
      console.log('Serving API from cache:', request.url);
      return cachedResponse;
    }
    
    // Return offline response for API requests
    return new Response(JSON.stringify({
      error: true,
      message: 'Offline - cached data not available',
      offline: true
    }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Handle dynamic requests - network first with cache fallback
 */
async function handleDynamicRequest(request) {
  try {
    console.log('Fetching dynamic:', request.url);
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, networkResponse.clone());
      await limitCacheSize(DYNAMIC_CACHE, MAX_CACHE_SIZE);
    }
    
    return networkResponse;
  } catch (error) {
    console.log('Network failed, trying cache for dynamic:', request.url);
    
    const cache = await caches.open(DYNAMIC_CACHE);
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
      console.log('Serving dynamic from cache:', request.url);
      return cachedResponse;
    }
    
    return new Response('Offline', { status: 503 });
  }
}

/**
 * Limit cache size by removing oldest entries
 */
async function limitCacheSize(cacheName, maxSize) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  
  if (keys.length > maxSize) {
    const keysToDelete = keys.slice(0, keys.length - maxSize);
    await Promise.all(keysToDelete.map(key => cache.delete(key)));
    console.log(`Cleaned ${keysToDelete.length} items from ${cacheName}`);
  }
}

/**
 * Background sync for offline messages
 */
self.addEventListener('sync', (event) => {
  console.log('Background sync triggered:', event.tag);
  
  if (event.tag === 'chat-messages') {
    event.waitUntil(syncChatMessages());
  }
});

/**
 * Sync offline chat messages
 */
async function syncChatMessages() {
  try {
    // Get offline messages from IndexedDB
    const offlineMessages = await getOfflineMessages();
    
    if (offlineMessages.length === 0) {
      console.log('No offline messages to sync');
      return;
    }

    console.log(`Syncing ${offlineMessages.length} offline messages`);
    
    // Send messages to server
    for (const message of offlineMessages) {
      try {
        const response = await fetch('/api/chat/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(message)
        });
        
        if (response.ok) {
          await removeOfflineMessage(message.id);
          console.log('Synced message:', message.id);
        }
      } catch (error) {
        console.error('Failed to sync message:', message.id, error);
      }
    }
  } catch (error) {
    console.error('Error syncing chat messages:', error);
  }
}

/**
 * Get offline messages from IndexedDB (placeholder)
 */
async function getOfflineMessages() {
  // This would integrate with IndexedDB to get stored offline messages
  return [];
}

/**
 * Remove synced message from IndexedDB (placeholder)
 */
async function removeOfflineMessage(messageId) {
  // This would remove the message from IndexedDB after successful sync
  console.log('Removing synced message:', messageId);
}

/**
 * Push notification handler
 */
self.addEventListener('push', (event) => {
  console.log('Push notification received');
  
  const options = {
    body: 'Nova mensagem no chat',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge-72x72.png',
    vibrate: [200, 100, 200],
    data: {
      url: '/'
    },
    actions: [
      {
        action: 'open',
        title: 'Abrir Chat',
        icon: '/icons/open-icon.png'
      },
      {
        action: 'close',
        title: 'Fechar',
        icon: '/icons/close-icon.png'
      }
    ]
  };

  if (event.data) {
    try {
      const data = event.data.json();
      options.body = data.message || options.body;
      options.data = { ...options.data, ...data };
    } catch (error) {
      console.error('Error parsing push data:', error);
    }
  }

  event.waitUntil(
    self.registration.showNotification('Chatbot Web', options)
  );
});

/**
 * Notification click handler
 */
self.addEventListener('notificationclick', (event) => {
  console.log('Notification clicked:', event.action);
  
  event.notification.close();
  
  if (event.action === 'open' || !event.action) {
    event.waitUntil(
      clients.matchAll({ type: 'window' })
        .then(clientList => {
          // Focus existing window if available
          for (const client of clientList) {
            if (client.url === '/' && 'focus' in client) {
              return client.focus();
            }
          }
          
          // Open new window
          if (clients.openWindow) {
            return clients.openWindow('/');
          }
        })
    );
  }
});

/**
 * Message handler for communication with main thread
 */
self.addEventListener('message', (event) => {
  console.log('Service Worker received message:', event.data);
  
  const { type, data } = event.data;
  
  switch (type) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;
      
    case 'CACHE_URLS':
      event.waitUntil(cacheUrls(data.urls));
      break;
      
    case 'CLEAR_CACHE':
      event.waitUntil(clearCache(data.cacheName));
      break;
      
    case 'GET_CACHE_SIZE':
      event.waitUntil(getCacheSize().then(size => {
        event.ports[0].postMessage({ type: 'CACHE_SIZE', size });
      }));
      break;
  }
});

/**
 * Cache specific URLs
 */
async function cacheUrls(urls) {
  const cache = await caches.open(DYNAMIC_CACHE);
  await cache.addAll(urls);
  console.log('Cached URLs:', urls);
}

/**
 * Clear specific cache
 */
async function clearCache(cacheName) {
  const deleted = await caches.delete(cacheName);
  console.log('Cache cleared:', cacheName, deleted);
}

/**
 * Get total cache size
 */
async function getCacheSize() {
  const cacheNames = await caches.keys();
  let totalSize = 0;
  
  for (const cacheName of cacheNames) {
    const cache = await caches.open(cacheName);
    const keys = await cache.keys();
    totalSize += keys.length;
  }
  
  return totalSize;
}

console.log('Service Worker loaded successfully');