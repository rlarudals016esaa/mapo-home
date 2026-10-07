// Never cache signed-in pages, API responses, or personal listing preferences.
const CACHE = "mapohome-shell-v1";
self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(["/offline.html", "/icons/icon-192.png", "/icons/icon-512.png"])).then(() => self.skipWaiting()));
});
self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith("mapohome-shell-") && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", event => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || event.request.method !== "GET" || event.request.mode !== "navigate") return;
  if (["/signin-with-chatgpt", "/signout-with-chatgpt", "/callback"].includes(url.pathname)) return;
  event.respondWith(fetch(event.request).catch(async () => (await caches.match("/offline.html")) || Response.error()));
});
// The payload is encrypted for this subscription by the authenticated server.
self.addEventListener("push", event => {
  let data; try { data = event.data?.json(); } catch { return; }
  if (!data || typeof data.title !== "string" || typeof data.body !== "string") return;
  let path = "/";
  try { const url = new URL(data.url || "/", self.location.origin); if (url.origin === self.location.origin && url.pathname === "/") path = url.pathname + url.search; } catch {}
  event.waitUntil(self.registration.showNotification(data.title, {body: data.body, icon: "/icons/icon-192.png", tag: data.id, data: {path}}));
});
self.addEventListener("notificationclick", event => {
  event.notification.close();
  let target = new URL("/", self.location.origin);
  try { const url = new URL(event.notification.data?.path || "/", self.location.origin); if (url.origin === self.location.origin && url.pathname === "/") target = url; } catch {}
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({type: "window", includeUncontrolled: true});
    for (const client of windows) if (new URL(client.url).origin === self.location.origin) { await client.navigate(target.href); return client.focus(); }
    return self.clients.openWindow(target.href);
  })());
});
