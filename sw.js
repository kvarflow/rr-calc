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

var VERSION = "411862a9";
var PRECACHE = [
	"./",
	"./index.html",
	"./js/vendor/select2/select2.css",
	"./css/main.css?b52f22d2",
	"./css/vendor/bootstrap.css",
	"./css/dark-theme.css?69ecca92",
	"./img/pokemonshowdownbeta.png",
	"./js/vendor/jquery-1.9.1.min.js",
	"./js/vendor/select2/select2.min.js",
	"./js/vendor/url-search-params-0.1.2.min.js",
	"./calc/util.js?51463f0d",
	"./calc/stats.js?a9e37d1a",
	"./calc/data/species.js?058b5a06",
	"./js/data/sets/gen9.js?7889fef7",
	"./js/data/sets/gen8.js?3be4b348",
	"./js/data/sets/gen7.js?bd0cb2a4",
	"./js/data/sets/gen6.js?5117b267",
	"./js/data/sets/gen5.js?3eaeb969",
	"./js/data/sets/gen4.js?2bf8fb89",
	"./js/data/sets/gen3.js?24dfbd92",
	"./js/data/sets/gen2.js?3b085680",
	"./js/data/sets/gen1.js?e995772f",
	"./calc/data/types.js?a641e10b",
	"./calc/data/natures.js?28612810",
	"./calc/data/abilities.js?1d75da7b",
	"./calc/data/moves.js?e0e2a1dd",
	"./calc/data/items.js?5963b503",
	"./calc/data/index.js?abecbd82",
	"./calc/move.js?14f744c5",
	"./calc/pokemon.js?1e459e1e",
	"./calc/field.js?bbf04408",
	"./calc/items.js?067e42a4",
	"./calc/mechanics/util.js?943cd2a1",
	"./calc/mechanics/gen789.js?cd447ac6",
	"./calc/mechanics/gen56.js?1377b286",
	"./calc/mechanics/gen4.js?3e11438d",
	"./calc/mechanics/gen3.js?76b8e79a",
	"./calc/mechanics/gen12.js?a49058b2",
	"./calc/calc.js?40a2d9b1",
	"./calc/desc.js?4ba68fcf",
	"./calc/result.js?9f8881b5",
	"./calc/adaptable.js?92e49194",
	"./calc/index.js?0b1745b9",
	"./js/shared_controls.js?509a17bb",
	"./js/index_randoms_controls.js?7f7c0241",
	"./js/moveset_import.js?881033d9",
	"./js/box_controls.js?76afb4a9",
	"./js/color_coding.js?884174ec",
	"./js/crit_tools.js?9eb76b1e",
	"./js/pokemon_panels.js?92ee3c60",
	"./js/range_compare.js?6eb7ac11",
	"./js/data/radical_red_save_data.js?f6682704",
	"./js/save_import.js?19060533",
	"./js/import_panel.js?98702a81",
	"./js/save_lock.js?8a8cada9",
	"./js/data/ability_descriptions.js?b4fc7313",
	"./js/ability_info.js?6b1cc7cc",
	"./js/site_settings.js?3b06e028",
	"./js/data/encounters.js?70b39b82",
	"./js/encounters.js?8e068b1e",
	"./js/small_screen.js?e4fd78ec",
	"./js/offline.js?395b09b8",
	"./js/dark-theme-toggle.js?054b266a",
	"./normal.html",
	"./js/data/sets/normal.js?811dee42",
	"./js/data/trainers/normal.js?03ae9b00",
	"./js/trainer_controls.js?7f821d4b",
	"./js/trainer_progress.js?6df01c24",
	"./hardcore.html",
	"./js/data/sets/hardcore.js?621de5a2",
	"./js/data/trainers/hardcore.js?c9267471",
	"./js/vendor/select2/select2.png",
	"./js/vendor/select2/select2-spinner.gif",
	"./js/vendor/select2/select2x2.png"
];
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
