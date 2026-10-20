var CACHE = 'shell-v15';
var FILES = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/app.css',
  './public/guide.json',
  './js/crypto.js',
  './js/online.js',
  './js/grade.js',
  './js/search.js',
  './js/news.js',
  './js/computers.js',
  './js/dorm.js',
  './js/schedule.js',
  './js/vendor/opentype.min.js',
  './js/banner-widths.js',
  './js/banner-core.js',
  './js/banner-name.js',
  './js/banner-outline.js',
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
  './js/modules/schedule.js',
  './js/modules/banner.js',
  './img/banner-plane.png',
  './img/logo-clean.png',
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
  var path = '';
  try { path = new URL(req.url).pathname; } catch (err) { path = ''; }
  if (path.endsWith('/pack.enc') || path.endsWith('pack.enc') || path.endsWith('/public-pack.json') || path.endsWith('public-pack.json') || /\/banner(\/|$)/.test(path)) {
    e.respondWith(fetch(req, { cache: 'no-store' }));
    return;
  }
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
