const CACHE = "changong-yixing-v1";
const MAX_ENTRIES = 200;
const BASE = self.registration.scope;
const SHELL = [BASE, new URL("manifest.webmanifest", BASE), new URL("icon-192.png", BASE), new URL("icon-512.png", BASE)];

// 安装时预缓存核心资源
self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)));
  self.skipWaiting();
});

// 激活时清理旧版本缓存
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

// 请求拦截：网络优先，失败时降级到缓存
self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  // 跳过非本域请求和 API 请求
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok && response.type === "basic") {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => {
            cache.put(request, copy);
            trimCache(cache);
          });
        }
        return response;
      })
      .catch(() =>
        caches.match(request).then((cached) => cached || caches.match(BASE))
      )
  );
});

// 限制缓存条目数量，超出时删除最旧的
async function trimCache(cache) {
  const keys = await cache.keys();
  if (keys.length > MAX_ENTRIES) {
    const toDelete = keys.slice(0, keys.length - MAX_ENTRIES);
    await Promise.all(toDelete.map((req) => cache.delete(req)));
  }
}
