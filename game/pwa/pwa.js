/* Copyright 2015 Google Inc. All Rights Reserved.
   Licensed under the Apache License, Version 2.0 (the "License"); http://www.apache.org/licenses/LICENSE-2.0 */function a(e){let f=new Request(e,{cache:'reload'});if('cache'in f)return f;let g=new URL(e,self.location.href);return g.search+=(g.search?'&':'')+'cachebust='+Date.now(),new Request(g)}let c={offline:'elem4-v'+1};const d='/offline.html';self.addEventListener('install',e=>{e.waitUntil(fetch(a(d)).then(function(f){return caches.open(c.offline).then(function(g){return g.put(d,f)})}))}),self.addEventListener('activate',e=>{let f=Object.keys(c).map(function(g){return c[g]});e.waitUntil(caches.keys().then(g=>{return Promise.all(g.map(h=>{if(-1===f.indexOf(h))return caches.delete(h)}))}))}),self.addEventListener('fetch',e=>{'/ping'===e.request.url&&e.respondWith(fetch(e.request)),('navigate'===e.request.mode||'GET'===e.request.method&&e.request.headers.get('accept').includes('text/html'))&&(e.respondWith(fetch(e.request).catch(f=>{return console.debug('Fetch failed; returning offline page instead.',f),caches.match(d)})))})