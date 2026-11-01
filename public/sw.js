/* Hearth service worker: app shell + offline fallback.
 * - Static build assets: cache-first (they are content-hashed).
 * - Page navigations: network-first, falling back to the last cached copy,
 *   then to /offline. Pages are cached per device and wiped on sign-out.
 * - API, auth and Supabase calls are never cached.
 */
const VERSION = "v6";
const SHELL_CACHE = `shell-${VERSION}`;
const PAGE_CACHE = `pages-${VERSION}`;
// Files shared into the app (Android share sheet), picked up by /dining/share.
const SHARE_CACHE = "share-inbox";
const SHELL = ["/offline", "/manifest.webmanifest", "/icons/icon-192.png", "/icons/icon.svg"];

// A new version waits until the user taps "Reload" on the update banner (or
// all tabs close), so the page never reloads under someone mid-entry.
self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(SHELL_CACHE).then((c) => c.addAll(SHELL)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => ![SHELL_CACHE, PAGE_CACHE, SHARE_CACHE].includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "clear-user-data") {
    event.waitUntil(Promise.all([caches.delete(PAGE_CACHE), caches.delete(SHARE_CACHE)]));
  }
});

async function receiveShare(request) {
  const form = await request.formData();
  const files = form.getAll("photos").filter((f) => f && typeof f !== "string").slice(0, 6);
  await caches.delete(SHARE_CACHE);
  const cache = await caches.open(SHARE_CACHE);
  await Promise.all(
    files.map((f, i) =>
      cache.put(`/share-inbox/${i}`, new Response(f, { headers: { "Content-Type": f.type || "image/jpeg", "X-File-Name": encodeURIComponent(f.name || `shared-${i}.jpg`) } })),
    ),
  );
  return Response.redirect(`/dining/share?files=${files.length}`, 303);
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const shareUrl = new URL(req.url);
  if (req.method === "POST" && shareUrl.origin === self.location.origin && shareUrl.pathname === "/dining/share") {
    event.respondWith(receiveShare(req).catch(() => Response.redirect("/dining/share?files=0", 303)));
    return;
  }
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/auth/")) return;

  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(SHELL_CACHE).then((c) => c.put(req, copy));
            }
            return res;
          }),
      ),
    );
    return;
  }

  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok && !res.redirected && url.pathname !== "/login") {
            const copy = res.clone();
            caches.open(PAGE_CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(async () => (await caches.match(req)) || (await caches.match("/offline")) || Response.error()),
    );
  }
});

// ------------------------------------------------------------ push --------
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "Hearth", body: event.data ? event.data.text() : "" };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "Hearth", {
      body: data.body || "",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      tag: data.tag,
      actions: Array.isArray(data.actions) ? data.actions.slice(0, 2) : [],
      data: { url: data.url || "/" },
    }),
  );
});

// "+250 ml" on a water reminder: log it without opening the app.
async function logWaterFromNotification(ml) {
  try {
    const res = await fetch("/api/water/log", { method: "POST", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify({ ml }) });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || "failed");
    await self.registration.showNotification(body.title || "💧 +" + ml + " ml", { body: body.message || "", icon: "/icons/icon-192.png", badge: "/icons/icon-192.png", tag: "water-logged", data: { url: "/food" } });
  } catch {
    await self.clients.openWindow("/food?water=1");
  }
}

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  if (event.action === "water-250") {
    event.waitUntil(logWaterFromNotification(250));
    return;
  }
  const url = new URL((event.notification.data && event.notification.data.url) || "/", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
      for (const w of wins) {
        if (w.url.startsWith(self.location.origin) && "focus" in w) {
          w.navigate(url);
          return w.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});

// The page asks a freshly installed version to take over ("Reload" on the update banner).
self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});
