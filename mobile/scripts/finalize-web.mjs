import { createHash } from "node:crypto";
import { readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const directory = process.argv[2];
const indexPath = join(directory, "index.html");
const original = await readFile(indexPath, "utf8");
const scripts = [...original.matchAll(/<script\b[^>]*\bsrc="([^"]+\.js)"[^>]*>/g)]
  .map(match => match[1]).filter(url => /^(?:\/[^/]+)*\/_expo\/static\/[\w./-]+\.js$/.test(url));
if (!scripts.length) throw new Error("Expo web export has no hashed scripts");
const base = scripts[0].split("/_expo/")[0] + "/";
await writeFile(join(directory, "companion-assets.json"), JSON.stringify({ scripts }));
if (process.env.COMPANION_SERVICE_WORKER === "0") process.exit(0);

const icons = (await readdir(directory)).filter(name => /^favicon\.(?:ico|png)$/.test(name)).map(name => base + name);
const update = String.raw`
(() => {
  if (!("serviceWorker" in navigator)) return;
  const script = document.currentScript;
  const pendingLabel = "새 버전이 있습니다 · 새로고침";
  const registrations = navigator.serviceWorker;
  let reload = false;
  registrations.addEventListener("controllerchange", () => { if (reload) location.reload(); });
  registrations.register(new URL("companion-sw.js", script.src), { updateViaCache: "none" }).then(registration => {
    const show = () => {
      if (!registration.waiting || !registrations.controller || document.querySelector(".companion-update")) return;
      const button = document.createElement("button");
      button.className = "companion-update";
      button.textContent = pendingLabel;
      button.addEventListener("click", () => {
        if (!registration.waiting) { location.reload(); return; }
        reload = true;
        registration.waiting.postMessage("activate-update");
      });
      document.body.append(button);
    };
    show();
    registration.addEventListener("updatefound", () => {
      registration.installing?.addEventListener("statechange", show);
    });
  }).catch(() => {});
})();
`;
const css = ".companion-update{position:fixed;z-index:2147483647;right:16px;bottom:max(16px,env(safe-area-inset-bottom));background:#17233a;color:#fff;border:1px solid #6f9cff;border-radius:8px;padding:10px 14px;font:inherit;cursor:pointer}";
const index = original.replace("</head>", `<link rel="stylesheet" href="${base}companion-update.css"></head>`)
  .replace("</body>", `<script src="${base}companion-update.js" defer></script></body>`);
const worker = String.raw`
self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(PRECACHE.map(url => new Request(url, { cache: "reload" })))));
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const keys = (await caches.keys()).filter(key => key.startsWith(PREFIX) && key !== CACHE);
    await Promise.all(keys.map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener("message", event => {
  if (event.data === "activate-update") event.waitUntil(self.skipWaiting());
});

self.addEventListener("fetch", event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin || !url.pathname.startsWith(BASE)) return;
  const path = url.pathname.slice(BASE.length);
  if (path === "api" || path.startsWith("api/")) return;
  if (request.mode === "navigate") {
    const cached = caches.open(CACHE).then(cache => cache.match(INDEX));
    const checked = fetch(new Request(INDEX, { cache: "no-cache" })).then(async response => {
      if (response.ok) {
        const previous = await cached;
        if (previous && (await response.clone().text()) !== (await previous.clone().text())) await self.registration.update();
      }
      return response;
    });
    event.waitUntil(checked.catch(() => undefined));
    event.respondWith(cached.then(previous => previous || checked));
    return;
  }
  if (path.startsWith("_expo/static/") || PRECACHE.includes(url.pathname)) {
    event.respondWith(caches.open(CACHE).then(async cache => {
      const previous = await cache.match(request);
      if (previous) return previous;
      const response = await fetch(request);
      if (response.ok && path.startsWith("_expo/static/")) await cache.put(request, response.clone());
      return response;
    }));
  }
});
`;
const scopeKey = "companion-shell:" + base + ":";
const updateFiles = [base + "companion-update.js", base + "companion-update.css"];
const precache = [base + "index.html", ...scripts, ...icons, ...updateFiles];
const revision = createHash("sha256").update(index).update(update).update(css).update(worker).update(JSON.stringify(precache)).digest("hex").slice(0, 16);
const settings = { BASE: base, INDEX: base + "index.html", PREFIX: scopeKey, CACHE: scopeKey + revision, PRECACHE: precache };
await Promise.all([
  writeFile(indexPath, index),
  writeFile(join(directory, "companion-update.css"), css),
  writeFile(join(directory, "companion-update.js"), update),
  writeFile(join(directory, "companion-sw.js"), Object.entries(settings).map(([name, data]) => `const ${name} = ${JSON.stringify(data)};`).join("\n") + "\n" + worker),
]);
