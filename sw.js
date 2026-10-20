var CACHE = 'shell-v07';
var FILES = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/app.css',
  './public/guide.json',
  './js/crypto.js',
  './js/grade.js',
  './js/search.js',
  './js/news.js',
  './js/computers.js',
  './js/dorm.js',
  './js/registry.js',
  './js/app.js',
  './js/modules/home.js',
  './js/modules/students.js',
  './js/modules/board.js',
  './js/modules/study.js',
  './js/modules/practice.js',
  './js/modules/search.js',
  './js/modules/news.js',
  './js/modules/computers.js',
  './js/modules/dorm.js',
  './js/modules/more.js',
  './icons/favicon-32.png',
  './icons/apple-touch-icon.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png'
];
self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(FILES); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  e.respondWith(caches.match(req).then(function (hit) {
    if (hit) return hit;
    return fetch(req).then(function (res) {
      if (res && res.ok) {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(req, copy); });
      }
      return res;
    }).catch(function () {
      if (req.mode === 'navigate') return caches.match('./index.html');
    });
  }));
});
