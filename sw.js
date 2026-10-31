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

var VERSION = "2f493320";
var PRECACHE = [
	"./",
	"./index.html",
	"./manifest.webmanifest?8f6b284d",
	"./img/app-icon-192.png?07f2e407",
	"./img/app-icon-512.png?5bbcc345",
	"./js/vendor/select2/select2.css",
	"./css/main.css?8161652e",
	"./css/vendor/bootstrap.css",
	"./css/dark-theme.css?7dbe2673",
	"./img/pokemonshowdownbeta.png",
	"./js/vendor/jquery-1.9.1.min.js",
	"./js/vendor/select2/select2.min.js",
	"./js/vendor/url-search-params-0.1.2.min.js",
	"./calc/util.js?51463f0d",
	"./calc/stats.js?a9e37d1a",
	"./calc/data/species.js?d520f346",
	"./js/data/sets/gen9.js?7889fef7",
	"./js/data/sets/gen8.js?3be4b348",
	"./js/data/sets/gen7.js?bd0cb2a4",
	"./js/data/sets/gen6.js?5117b267",
	"./js/data/sets/gen5.js?3eaeb969",
	"./js/data/sets/gen4.js?2bf8fb89",
	"./js/data/sets/gen3.js?24dfbd92",
	"./js/data/sets/gen2.js?3b085680",
	"./js/data/sets/gen1.js?e995772f",
	"./calc/data/types.js?e75b6fc2",
	"./calc/data/natures.js?28612810",
	"./calc/data/abilities.js?dea9203e",
	"./calc/data/moves.js?e6974fb6",
	"./calc/data/items.js?6fa96275",
	"./calc/data/index.js?8c0ffdca",
	"./calc/move.js?e1af98b9",
	"./calc/pokemon.js?1e459e1e",
	"./calc/field.js?bbf04408",
	"./calc/items.js?fe10bd4c",
	"./calc/mechanics/util.js?3bbcbdf7",
	"./calc/mechanics/gen789.js?da63c0b4",
	"./calc/mechanics/gen56.js?1377b286",
	"./calc/mechanics/gen4.js?3e11438d",
	"./calc/mechanics/gen3.js?76b8e79a",
	"./calc/mechanics/gen12.js?a49058b2",
	"./calc/calc.js?40a2d9b1",
	"./calc/desc.js?e1b01da2",
	"./calc/result.js?9f8881b5",
	"./calc/adaptable.js?92e49194",
	"./calc/index.js?951162b4",
	"./js/games.js?23dfdf9a",
	"./js/shared_controls.js?91762625",
	"./js/index_randoms_controls.js?b65266d5",
	"./js/moveset_import.js?a9c113bb",
	"./js/box_controls.js?a41278bc",
	"./js/color_coding.js?f29c7194",
	"./js/box_ranking.js?b7f7eac1",
	"./js/suggested_evs.js?05f6674e",
	"./js/crit_tools.js?d649bb34",
	"./js/pokemon_panels.js?92ee3c60",
	"./js/range_compare.js?6eb7ac11",
	"./js/data/radical_red_save_data.js?f6682704",
	"./js/save_import.js?e7dc28e3",
	"./js/import_panel.js?98702a81",
	"./js/save_lock.js?8a8cada9",
	"./js/protean.js?c722697c",
	"./js/consecutive_moves.js?a9bee49d",
	"./js/data/ability_descriptions.js?b4fc7313",
	"./js/ability_info.js?3e3915b9",
	"./js/data/item_descriptions.js?f135adb7",
	"./js/item_info.js?94c34525",
	"./js/site_settings.js?5f9f739d",
	"./js/data/encounters.js?70b39b82",
	"./js/encounters.js?1c05fe12",
	"./js/small_screen.js?a97882ec",
	"./js/offline.js?395b09b8",
	"./js/dark-theme-toggle.js?5a292cd8",
	"./normal.html",
	"./js/data/learnsets/radicalred.js?5acc0a1d",
	"./js/data/sets/normal.js?207916da",
	"./js/data/trainers/normal.js?ef5854e4",
	"./js/trainer_controls.js?c3183763",
	"./js/trainer_progress.js?79340ff5",
	"./js/run_record.js?f01c019c",
	"./js/data/trainer_ai.js?8c05201d",
	"./js/trainer_ai.js?ab2170d9",
	"./js/sheets.js?c5e1c072",
	"./js/mastersheet.js?bf239e41",
	"./js/fragsheet.js?3284352a",
	"./js/dex.js?6d624654",
	"./js/emulator_sync.js?75ff5123",
	"./hardcore.html",
	"./js/data/sets/hardcore.js?7690d0eb",
	"./js/data/trainers/hardcore.js?a5e11dcd",
	"./js/vendor/select2/select2.png",
	"./js/vendor/select2/select2-spinner.gif",
	"./js/vendor/select2/select2x2.png",
	"./img/app-icon-192.png",
	"./img/app-icon-512.png",
	"./img/app-icon-maskable.png"
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
