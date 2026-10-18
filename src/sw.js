/*
 * Offline mode: a service worker that keeps the calculator working with no connection once
 * it has been opened online (registered by js/offline.js).
 *  - On install it saves every page and every file they load. `node build` fills in the list
 *    and a version that changes whenever any of them does, so each new build installs fresh
 *    and the previous build's copies are deleted.
 *  - Pages are fetched online first (with a time limit, for a weak signal) so updates arrive,
 *    and the saved copy is used when that fails.
 *  - Scripts and stylesheets carry a content hash in their URL, so the saved copy is used.
 *  - Sprites (loaded from GitHub) are saved the first time they load, in a cache kept across
 *    versions; one never seen online shows as its label offline.
 */

var VERSION = "__VERSION__";
var PRECACHE = __PRECACHE__;
var CACHE = "rr-calc-" + VERSION;
var SPRITE_CACHE = "rr-calc-sprites";
var PAGE_TIMEOUT_MS = 4000;

self.addEventListener("install", function (event) {
	event.waitUntil(caches.open(CACHE).then(function (cache) {
		return cache.addAll(PRECACHE);
	}).then(function () {
		return self.skipWaiting();
	}));
});

self.addEventListener("activate", function (event) {
	event.waitUntil(caches.keys().then(function (names) {
		return Promise.all(names.filter(function (name) {
			return name.indexOf("rr-calc-") === 0 && name !== CACHE && name !== SPRITE_CACHE;
		}).map(function (name) {
			return caches.delete(name);
		}));
	}).then(function () {
		return self.clients.claim();
	}));
});

function saveCopy(cacheName, request, response) {
	if (response && (response.ok || response.type === "opaque")) {
		var copy = response.clone();
		caches.open(cacheName).then(function (cache) {
			cache.put(request, copy);
		});
	}
	return response;
}

// Online first, giving up after a few seconds; then the saved page (any ?mode= query).
function pageFromNetworkOrCache(request) {
	var fromCache = function () {
		return caches.match(request, {ignoreSearch: true}).then(function (saved) {
			return saved || caches.match("./hardcore.html");
		});
	};
	return new Promise(function (resolve) {
		var settled = false;
		var timer = setTimeout(function () {
			fromCache().then(function (saved) {
				if (saved && !settled) {
					settled = true;
					resolve(saved);
				}
			});
		}, PAGE_TIMEOUT_MS);
		fetch(request).then(function (response) {
			clearTimeout(timer);
			saveCopy(CACHE, request, response);
			if (!settled) {
				settled = true;
				resolve(response);
			}
		}).catch(function () {
			clearTimeout(timer);
			fromCache().then(function (saved) {
				if (!settled) {
					settled = true;
					resolve(saved || Response.error());
				}
			});
		});
	});
}

function fromCacheOrNetwork(cacheName, request) {
	return caches.match(request).then(function (saved) {
		return saved || fetch(request).then(function (response) {
			return saveCopy(cacheName, request, response);
		});
	});
}

self.addEventListener("fetch", function (event) {
	var request = event.request;
	if (request.method !== "GET") return;
	var url = new URL(request.url);
	if (url.origin === self.location.origin) {
		event.respondWith(request.mode === "navigate" ? pageFromNetworkOrCache(request) : fromCacheOrNetwork(CACHE, request));
	} else if (request.destination === "image") {
		event.respondWith(fromCacheOrNetwork(SPRITE_CACHE, request));
	}
});
