/* 항상 새 버전 먼저(네트워크 우선). 인터넷이 없을 때만 저장본을 보여 줘요. 잠금 없음. */
var CACHE = 'hj-v36';
self.addEventListener('install', function (e) {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(function (c) {
    return c.addAll(['./', './index.html', './css/app.css?v=24', './js/app.js?v=22']).catch(function () {});
  }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url;
  try { url = new URL(req.url); } catch (err) { return; }
  if (url.origin !== self.location.origin) return;
  if (url.pathname.indexOf('/api/') >= 0) return; /* 잠긴 API(사람 정보)는 저장본을 만들지 않음 */
  e.respondWith(fetch(req, { cache: 'no-store' }).then(function (res) {
    if (res && res.ok && res.type === 'basic') {
      var copy = res.clone();
      caches.open(CACHE).then(function (c) { c.put(req, copy); });
    }
    return res;
  }).catch(function () {
    return caches.match(req).then(function (hit) {
      if (hit) return hit;
      if (req.mode === 'navigate') return caches.match('./index.html');
      return new Response('', { status: 504 });
    });
  }));
});
