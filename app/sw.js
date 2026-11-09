const CACHE='flami-shell-v17';
self.addEventListener('install',event=>{self.skipWaiting();event.waitUntil(caches.open(CACHE).then(c=>c.addAll(['/','/app.css?v=20261109-watch1b','/app.js?v=20261109-watch1b','/icon-192.png','/icon-512.png'])))});
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{if(new URL(event.request.url).origin!==location.origin||event.request.method!=='GET')return;event.respondWith(fetch(event.request,{cache:'no-cache'}).catch(()=>caches.match(event.request).then(r=>r||caches.match('/'))))});
