/* plaka — servis çalışanı: çevrimdışı açılış için uygulama dosyalarını saklar.
   Hesap verisi (API) burada saklanmaz; çevrimdışı değişiklikleri uygulama kendisi bekletip eşitler. */
const VERSION = "2.2.2";
const CACHE = "plaka-" + VERSION;
const SHELL = [
  "/", "/assets/app.css?v=" + VERSION, "/assets/app.js?v=" + VERSION,
  "/assets/turkiye.svg", "/assets/iller.json", "/assets/manifest.webmanifest?v=" + VERSION,
  "/assets/favicon.svg?v=" + VERSION, "/assets/icon-192.png?v=" + VERSION, "/assets/icon-512.png?v=" + VERSION, "/assets/apple-touch-icon.png?v=" + VERSION,
  "/assets/fonts/inter-400-latin.woff2", "/assets/fonts/inter-500-latin.woff2", "/assets/fonts/inter-600-latin.woff2",
  "/assets/fonts/inter-700-latin.woff2", "/assets/fonts/inter-800-latin.woff2",
  "/assets/fonts/inter-500-latin-ext.woff2", "/assets/fonts/inter-700-latin-ext.woff2",
];
self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith("plaka-") && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== location.origin || url.pathname.startsWith("/api/")) return;   // hesap verisi her zaman sunucudan
  if (req.mode === "navigate") {                    // sayfa: önce ağ, olmazsa saklanan kopya
    e.respondWith(fetch(req).then(r => { const copy = r.clone(); caches.open(CACHE).then(c => c.put("/", copy)); return r; }).catch(() => caches.match("/")));
    return;
  }
  e.respondWith(caches.match(req).then(hit => {      // dosyalar: saklanan kopya, arkada güncelle
    const net = fetch(req).then(r => { if (r.ok) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(req, copy)); } return r; }).catch(() => hit);
    return hit || net;
  }));
});
