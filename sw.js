/* Jalons : cache hors connexion.
   Changer VERSION à chaque mise à jour des fichiers, pour que les téléphones récupèrent la nouvelle version.
   Ajouter ici tout nouveau fichier de protocole (et sa balise <script> dans index.html). */
const VERSION = "jalons-1";
const FILES = [
  "./", "index.html", "manifest.webmanifest", "css/app.css",
  "js/engine.js", "js/app.js",
  "protocols/tvnim.js", "protocols/prostatectomie.js",
  "icons/icon.svg", "icons/icon-192.png", "icons/icon-512.png", "icons/icon-maskable-512.png", "icons/apple-touch-icon.png"
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Réseau d'abord pour recevoir les mises à jour, cache si hors connexion.
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(
    fetch(req)
      .then(res => {
        if (res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); }
        return res;
      })
      .catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || caches.match("index.html")))
  );
});
