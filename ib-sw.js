/* InternalBeyond Mobile — ib-sw.js（自动注销与缓存清理补丁）
   全面清理历史 Service Worker 缓存，杜绝离线降级与版本回退现象 */
self.addEventListener('install', function(e) {
  self.skipWaiting();
});

self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(ks) {
      return Promise.all(ks.map(function(k) { return caches.delete(k); }));
    }).then(function() {
      return self.registration.unregister();
    }).then(function() {
      return self.clients.claim();
    })
  );
});

// 绝不拦截或缓存任何请求，全部直通网络
self.addEventListener('fetch', function(e) {
  return;
});

