/* Offline service worker for the Encelium Baseline Survey.
   The whole point: a surveyor in a mechanical room or a stairwell has no
   signal, so the app must load from cache with the network unavailable.
   Cache-first for our own files; fonts are best-effort (the page has a real
   system fallback stack, so a font miss is cosmetic, not fatal). */

var CACHE = "vurec-survey-v2";   // bump on every deploy or installed phones keep the old app
var CORE = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icon-192.png",
  "./icon-512.png"
];

self.addEventListener("install", function(e){
  e.waitUntil(
    caches.open(CACHE).then(function(c){
      return c.addAll(CORE);
    }).then(function(){ return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function(e){
  e.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(keys.map(function(k){
        return k === CACHE ? null : caches.delete(k);
      }));
    }).then(function(){ return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function(e){
  var req = e.request;
  if(req.method !== "GET") return;

  e.respondWith(
    caches.match(req).then(function(hit){
      if(hit) return hit;
      return fetch(req).then(function(res){
        // opportunistically cache same-origin and font responses
        var url = req.url;
        var cacheable = res && (res.status === 200 || res.type === "opaque") &&
          (url.indexOf(self.location.origin) === 0 ||
           url.indexOf("fonts.googleapis.com") > -1 ||
           url.indexOf("fonts.gstatic.com") > -1);
        if(cacheable){
          var copy = res.clone();
          caches.open(CACHE).then(function(c){ c.put(req, copy); }).catch(function(){});
        }
        return res;
      }).catch(function(){
        // offline and not cached: for a navigation, serve the app shell
        if(req.mode === "navigate") return caches.match("./index.html");
        return new Response("", {status: 504, statusText: "Offline"});
      });
    })
  );
});
