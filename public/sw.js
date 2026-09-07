/* Cache the shell and static assets. Puzzle solutions stay in the active page's memory. */
const VERSION='chesscape-shell-v2';
const SHELL=['/','/favicon.svg','/icon-192.png','/icon-512.png','/manifest.webmanifest',...['w','b'].flatMap(c=>['K','Q','R','B','N','P'].map(p=>`/pieces/${c}${p}.svg`))];
self.addEventListener('install',event=>{event.waitUntil(caches.open(VERSION).then(cache=>cache.addAll(SHELL)));});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('chesscape-')&&key!==VERSION).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',event=>{
 const request=event.request,url=new URL(request.url);
 if(request.method!=='GET'||url.origin!==self.location.origin||url.pathname.startsWith('/api/')||url.pathname.startsWith('/__')||url.search)return;
 if(request.mode==='navigate'){
  event.respondWith(fetch(request).then(response=>{if(response.ok){const copy=response.clone();event.waitUntil(caches.open(VERSION).then(cache=>cache.put('/',copy)));}return response;}).catch(async()=>await caches.match('/')||new Response('Reconnect to open your daily escape.',{status:503,headers:{'Content-Type':'text/plain'}})));
  return;
 }
 const staticAsset=/\.(?:js|css|svg|png|webp|woff2?)$/.test(url.pathname);
 if(!staticAsset)return;
 event.respondWith(caches.match(request).then(cached=>cached||fetch(request).then(response=>{if(response.ok){const copy=response.clone();event.waitUntil(caches.open(VERSION).then(cache=>cache.put(request,copy)));}return response;})));
});
