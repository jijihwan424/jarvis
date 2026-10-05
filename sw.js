// 자비스 오프라인 캐시. 앱 파일을 고치면 CACHE 이름의 숫자를 올려줘야 새 버전이 반영돼.
var CACHE = "jarvis-v14";
var LIB = "jarvis-lib"; // AI 라이브러리처럼 밖에서 받아온 파일 (버전이 바뀌어도 지우지 않음)
var FILES = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-512-maskable.png"
];

self.addEventListener("install", function (e) {
  e.waitUntil(
    // cache: "reload" → 브라우저에 남은 옛 파일 말고 서버에서 새로 받는다
    caches.open(CACHE).then(function (c) { return c.addAll(FILES.map(function (f) { return new Request(f, { cache: "reload" }); })); }).then(function () { return self.skipWaiting(); })
  );
});

// 예전 버전 앱 캐시만 지운다. AI 모델 캐시(webllm…)와 라이브러리 캐시는 건드리지 않는다.
self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return /^jarvis-v/.test(k) && k !== CACHE; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function (e) {
  if (e.request.method !== "GET") return;
  var url = new URL(e.request.url);
  // 앱 파일: 캐시에 있으면 그걸 쓰고, 없으면 인터넷에서
  if (url.origin === self.location.origin) {
    e.respondWith(
      caches.match(e.request, { cacheName: CACHE }).then(function (hit) {
        return hit || fetch(e.request).catch(function () { return caches.match("./index.html", { cacheName: CACHE }); });
      })
    );
    return;
  }
  // AI 라이브러리와 글꼴: 한 번 받으면 저장해두고 인터넷 없이도 쓴다
  if (/(^|\.)cdn\.jsdelivr\.net$|^fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) {
    e.respondWith(
      caches.open(LIB).then(function (c) {
        return c.match(e.request).then(function (hit) {
          if (hit) return hit;
          return fetch(e.request).then(function (res) {
            if (res && (res.ok || res.type === "opaque")) c.put(e.request, res.clone());
            return res;
          });
        });
      })
    );
  }
  // 그 밖(AI 모델 파일 등)은 그대로 둔다. 모델은 AI 라이브러리가 따로 저장한다.
});
