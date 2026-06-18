const cacheName = 'metronome-v1';
const assets = ['./index.html', './app.js', './manifest.json', './1.mp3', './2.mp3', './3.mp3', './4.mp3'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(cacheName).then(cache => cache.addAll(assets)));
});

self.addEventListener('fetch', e => {
  e.respondWith(caches.match(e.request).then(response => response || fetch(e.request)));
});