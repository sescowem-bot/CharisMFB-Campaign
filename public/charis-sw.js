/* Only generic public assets are cached; private bank content is never cached. */
const CACHE_NAME='charis-static-offline-v1';
const PRECACHE=['/charis-offline.html','/charis-pwa-192.png'];
self.addEventListener('install',event=>{
 event.waitUntil(caches.open(CACHE_NAME).then(c=>c.addAll(PRECACHE)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
 event.waitUntil(Promise.all([
  caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('charis-static-offline-')&&k!==CACHE_NAME).map(k=>caches.delete(k)))),
  self.clients.claim()
 ]));
});
self.addEventListener('fetch',event=>{
 if(event.request.method!=='GET'||event.request.mode!=='navigate')return;
 if(new URL(event.request.url).origin!==self.location.origin)return;
 event.respondWith(fetch(event.request).catch(async()=>{
  return await caches.match('/charis-offline.html')||Response.error();
 }));
});
