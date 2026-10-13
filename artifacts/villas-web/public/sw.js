/*
 * Service worker de Villas: lo justo para instalarse y abrir rápido.
 * - Archivos de la app (/assets) y fotos: se guardan en el celular (nunca cambian).
 * - Páginas: siempre de la red; si no hay señal, la última versión guardada.
 * - API: siempre de la red (datos al día, sesiones seguras).
 */
const VERSION = "villas-v2";
const SHELL = "/index.html";

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.add(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  const immutable = url.pathname.startsWith("/assets/") || url.pathname.startsWith("/api/photos/");
  if (immutable) {
    e.respondWith(
      caches.open(VERSION).then(async (c) => {
        const hit = await c.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) c.put(req, res.clone());
        return res;
      }),
    );
    return;
  }
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(VERSION).then((c) => c.put(SHELL, copy));
          }
          return res;
        })
        .catch(() => caches.match(SHELL)),
    );
  }
  // Todo lo demás (API incluida) va directo a la red.
});
