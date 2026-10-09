/* Build replaces these values. Only this origin's versioned public shell is cached. */
const VERSION = "__BUILD_VERSION__";
const SHELL = "nabungfi-shell-" + VERSION;
const PRECACHE = __PRECACHE_ASSETS__;
const ASSETS = __PUBLIC_ASSETS__;
self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(SHELL).then((cache) => cache.addAll(PRECACHE)));
  // A new version waits for explicit user consent; never interrupts a wallet request.
});
self.addEventListener("message", (event) => {
  if (event.data?.type === "ACTIVATE_UPDATE") self.skipWaiting();
});
self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith("nabungfi-shell-") && key !== SHELL).map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin || url.pathname.startsWith("/api/") || request.headers.has("authorization")) return;
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match("/index.html")));
    return;
  }
  // Load exact progress snapshots on demand, not the entire 1,000-image catalog.
  const progressPoster = /^\/models\/progress-v1\/(car|laptop|house|custom|console|camera|motorcycle|bicycle|phone|travel)\/([0-9]|[1-9][0-9])\.jpg$/.test(url.pathname);
  if (!ASSETS.includes(url.pathname) && !progressPoster) return;
  event.respondWith(caches.match(request).then((cached) => cached || fetch(request).then((response) => {
    const type = response.headers.get("content-type") || "";
    if (response.ok && ((/\.m?js$/.test(url.pathname) && !/(?:java|ecma)script/i.test(type)) || (/\.css$/.test(url.pathname) && !/text\/css/i.test(type))))
      return new Response("This app module is unavailable. Reopen the app after resolving any wallet request.", {status:503,headers:{"content-type":"text/plain","cache-control":"no-store"}});
    if (response.ok) { const copy = response.clone(); event.waitUntil(caches.open(SHELL).then((cache) => cache.put(request, copy))); }
    return response;
  })));
});
