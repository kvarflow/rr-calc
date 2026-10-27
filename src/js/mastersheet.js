/*
 * The Mastersheet (a sheet, sheets.js): the whole game in the order Previous / Next take you, by
 * level-cap arc and then by place. Each place has its wild Pokémon (with your Nuzlocke dupes) and
 * its trainers, each trainer with its whole team as the calc has it: level, item, ability, nature
 * and moves. Beaten trainers are ticked. Tap a trainer to fight it in the calc, or one of its
 * Pokémon to load that one.
 *
 * Only the arc you are in is open at first; the others build when opened. A search opens every
 * arc with a match.
 */

var MASTERSHEET_FILTERS_KEY = "mastersheetFilters";
// The boss documents' names for places, as the wild encounter data has them.
var MASTERSHEET_PLACE_ALIASES = {
	"Nugget Bridge": "Route 24", "Vermillion City": "Vermilion City", "Dig House": "Cerulean City",
	"Game Corner": "Celadon City", "Celadon City Hotel": "Celadon City", "Pokemon Tower": "Pokémon Tower",
	"Pokemon Mansion 4f": "Pokémon Mansion", "Cinnabar Island Lab": "Cinnabar Island", "Cinnabar Island Gym": "Cinnabar Island"
};

/*
 * What you have folded, per mode: places ({"arc/place": true} folded) and trainers ({index: true}
 * open, false folded; without one a trainer is folded once beaten).
 */
var MASTERSHEET_FOLDS_KEY = "mastersheetFolds";

function readMastersheetFolds() {
	var folds = {};
	try {
		folds = JSON.parse(readSetting(MASTERSHEET_FOLDS_KEY + ":" + getPageMode())) || {};
	} catch (e) {}
	return {places: folds.places || {}, trainers: folds.trainers || {}};
}

function writeMastersheetFolds(folds) {
	writeSetting(MASTERSHEET_FOLDS_KEY + ":" + getPageMode(), JSON.stringify(folds));
}

// A new run starts with every trainer folded or open by whether it is beaten.
$(document).on("run:new", function () {
	writeMastersheetFolds({places: readMastersheetFolds().places, trainers: {}});
});

function isTrainerFolded(index, folds) {
	var saved = folds.trainers[index];
	return saved === undefined ? isTrainerDefeated(index) : !saved;
}

// A chevron that turns as its part opens.
function buildFoldIcon() {
	return $('<span class="ms-fold-icon" aria-hidden="true">\u25B8</span>');
}

function readMastersheetFilters() {
	var filters = {};
	try {
		filters = JSON.parse(readSetting(MASTERSHEET_FILTERS_KEY)) || {};
	} catch (e) {}
	return {routes: filters.routes !== false, wild: filters.wild !== false, hideDefeated: !!filters.hideDefeated};
}

function writeMastersheetFilters(filters) {
	writeSetting(MASTERSHEET_FILTERS_KEY, JSON.stringify(filters));
}

function getPlaceKey(location) {
	return encounterKey(MASTERSHEET_PLACE_ALIASES[location] || location);
}

function hasWildData() {
	return typeof ENCOUNTERS !== "undefined" && hasGameFeature("encounters");
}

/*
 * The arcs, each with its places in order: [{arc, number, places: [{name, key, trainers: [index],
 * wild: [encounter areas]}]}]. A place with wild Pokémon but no trainers (Route 1) comes after the
 * place before it in the wild data, which is in game order.
 */
function buildMastersheetArcs() {
	var arcs = getArcs();
	var sections = arcs.map(function (arc, number) {
		return {arc: arc, number: number, places: []};
	});
	var firstPlace = {};
	getTrainerNavOrder(true).forEach(function (index) {
		var trainer = TRAINER_ORDER[index];
		if (trainer.duplicate) return;
		var story = getStoryIndex(index);
		var number = 0;
		while (number < arcs.length - 1 && story > arcs[number].last) number++;
		var places = sections[number].places;
		var key = getPlaceKey(trainer.location);
		var last = places[places.length - 1];
		if (!last || last.key !== key) {
			last = {name: trainer.location || "Elsewhere", key: key, trainers: [], wild: []};
			places.push(last);
			if (!firstPlace[key]) firstPlace[key] = last;
		}
		last.trainers.push(index);
	});
	if (!hasWildData()) return sections;
	var wildOnly = [];
	var anchor = null;
	ENCOUNTERS.forEach(function (area) {
		var key = encounterKey(area.name);
		if (firstPlace[key]) {
			firstPlace[key].wild.push(area);
			anchor = firstPlace[key];
			return;
		}
		var after = anchor;
		var own = wildOnly.filter(function (place) {
			return place.key === key;
		})[0];
		if (own) own.wild.push(area);
		else wildOnly.push({name: area.name, key: key, trainers: [], wild: [area], after: after});
	});
	// Each wild-only place goes in after its anchor (or at the start of the game).
	wildOnly.forEach(function (place) {
		sections.some(function (section) {
			var at = place.after ? section.places.indexOf(place.after) : 0;
			if (at === -1) return false;
			var insertAt = place.after ? at + 1 : 0;
			while (insertAt < section.places.length && section.places[insertAt].wildOnly && section.places[insertAt].after === place.after) insertAt++;
			place.wildOnly = true;
			section.places.splice(insertAt, 0, place);
			return true;
		});
	});
	return sections;
}

// A team Pokémon's level: the document's, or as many below your highest as the game sets it.
function getMastersheetLevel(index, variant, slot, set) {
	var below = variant.levelBelowHighest ? variant.levelBelowHighest[slot] : null;
	// As applyRelativeLevels: the document's when there is no level to follow (a fight your .sav
	// marked won has none recorded).
	var highest = typeof below === "number" ? getTeamHighestLevel(index, variant) : 0;
	if (!highest) return set.documentLevel !== undefined ? set.documentLevel : set.level;
	return Math.max(1, Math.min(100, highest - below));
}

function getSetData(setId) {
	var id = splitSetId(setId);
	return {species: id.pokemonName, name: id.setName, set: (setdex[id.pokemonName] || {})[id.setName] || {}};
}

// The slots of that team you have KO'd, crossed out as on the Battle tab.
function getMastersheetKOs(index, variant) {
	return readSharedTrainerKOs()[getVariantKey(index, variant)] || [];
}

function buildMastersheetMon(index, variant, setId, slot) {
	var data = getSetData(setId);
	var set = data.set;
	var cell = $('<button type="button" class="ms-mon"></button>').attr({"data-set-id": setId, title: "Load " + data.species + " in the calc"})
		.toggleClass("ms-mon-ko", getMastersheetKOs(index, variant).indexOf(slot) !== -1);
	$('<span class="ms-mon-sprite"></span>').append(createSpriteImage(data.species, function () {
		$(this).remove();
	})).appendTo(cell);
	var info = $('<span class="ms-mon-info"></span>').appendTo(cell);
	$('<span class="ms-mon-name"></span>').text(data.species + " Lv " + getMastersheetLevel(index, variant, slot, set)).appendTo(info);
	var details = [set.item, set.ability, set.nature].filter(Boolean);
	if (details.length) $('<span class="ms-mon-details"></span>').text(details.join(" · ")).appendTo(info);
	$('<span class="ms-mon-moves"></span>').text((set.moves || []).join(" · ")).appendTo(info);
	cell.click(function () {
		openTrainerInCalc(index, setId, slot);
	});
	return cell;
}

// A trainer's team folded: small sprites under its name, each still loading that Pokémon.
function buildMastersheetMiniTeam(index, variant) {
	var kos = getMastersheetKOs(index, variant);
	return $('<div class="ms-team-mini"></div>').append(variant.sets.map(function (setId, slot) {
		return $('<button type="button" class="ms-mini-mon"></button>').attr({"data-set-id": setId, title: getPokemonName(setId)})
			.toggleClass("ms-mon-ko", kos.indexOf(slot) !== -1)
			.append(createSpriteImage(getPokemonName(setId), function () {
				$(this).replaceWith(document.createTextNode(getPokemonName(setId)));
			})).click(function () {
				openTrainerInCalc(index, setId, slot);
			});
	}));
}

function buildMastersheetTrainer(index, folds) {
	var trainer = TRAINER_ORDER[index];
	var variant = getTrainerVariant(trainer);
	var defeated = isTrainerDefeated(index);
	var card = $('<div class="ms-trainer"></div>').attr("data-index", index)
		.toggleClass("ms-trainer-defeated", defeated).toggleClass("ms-trainer-route", !!trainer.route);
	var head = $('<div class="ms-trainer-head"></div>').appendTo(card);
	var fold = $('<button type="button" class="ms-trainer-fold"></button>').append(buildFoldIcon()).appendTo(head);
	$('<button type="button" class="ms-trainer-name" title="Fight this trainer in the calc"></button>').text(trainer.name)
		.click(function () {
			openTrainerInCalc(index);
		}).appendTo(head);
	var tags = [];
	if (defeated) tags.push("✓ Defeated");
	if (trainer.route) tags.push("Route trainer");
	else if (trainer.optional) tags.push("Optional");
	if (variant.battleEffect) tags.push(variant.battleEffect);
	if (trainer.levelCap && !trainer.route) tags.push("Cap " + trainer.levelCap);
	if (tags.length) $('<span class="ms-trainer-tags"></span>').text(tags.join(" · ")).appendTo(head);
	var team = $('<div class="ms-team"></div>').appendTo(card);
	var mini = $("<div></div>").appendTo(card);
	var showVariant = function (shown) {
		team.empty().append(shown.sets.map(function (setId, slot) {
			return buildMastersheetMon(index, shown, setId, slot);
		}));
		mini.replaceWith(mini = buildMastersheetMiniTeam(index, shown));
	};
	// Folded (beaten trainers start so): the team as small sprites under the name.
	var setFolded = function (folded) {
		card.toggleClass("ms-trainer-folded", folded);
		fold.attr({"aria-expanded": !folded, "aria-label": (folded ? "Show " : "Hide ") + trainer.name + "\u2019s team"});
	};
	fold.click(function () {
		var folded = !card.hasClass("ms-trainer-folded");
		setFolded(folded);
		var saved = readMastersheetFolds();
		saved.trainers[index] = !folded;
		writeMastersheetFolds(saved);
	});
	// A fight with several teams (the rival's by starter, Lorelei's weather): the one the calc would
	// show, and the others to look at.
	if (trainer.variants.length > 1) {
		var select = $('<select class="ms-variant" aria-label="Team"></select>').appendTo(head);
		trainer.variants.forEach(function (v, k) {
			select.append($("<option></option>").val(k).text(v.label));
		});
		select.val(trainer.variants.indexOf(variant)).change(function () {
			showVariant(trainer.variants[+$(this).val()]);
		});
	}
	showVariant(variant);
	setFolded(isTrainerFolded(index, folds));
	return card;
}

function buildMastersheetWild(area, caught, nuzlocke) {
	var card = $('<div class="ms-wild"></div>');
	$('<div class="ms-wild-head"></div>').text("Wild Pokémon" + (area.area ? " · " + area.area : "")).appendTo(card);
	// By day and, where it differs, by night.
	var times = area.night ? [{table: area.day, when: " (day)"}, {table: area.night, when: " (night)"}] : [{table: area.day, when: ""}];
	ENCOUNTER_METHODS.forEach(function (method) {
		times.forEach(function (time) {
			var rows = time.table[method.key];
			if (!rows) return;
			var line = $('<div class="ms-wild-method"></div>')
				.append($('<span class="ms-wild-label"></span>').text(method.label + time.when)).appendTo(card);
			rows.forEach(function (row) {
				var dupe = nuzlocke && !!caught[getEvolutionFamily(row[0])];
				$('<span class="ms-wild-mon" role="button" tabindex="0"></span>').attr("data-species", row[0]).toggleClass("ms-wild-dupe", dupe)
					.attr("title", row[0] + " · Lv " + row[1] + (row[2] !== row[1] ? "–" + row[2] : "") +
						" · " + row[3] + "%" + (dupe ? " · dupe" : ""))
					.append(createSpriteImage(row[0], function () {
						$(this).remove();
					}), $('<span class="ms-wild-name"></span>').text(row[0]), $('<span class="ms-wild-rate"></span>').text(row[3] + "%"))
					.appendTo(line);
			});
		});
	});
	return card;
}

// Does a trainer or wild area match the search: a trainer, place or Pokémon name.
function mastersheetMatches(query, place, index) {
	if (!query) return true;
	var text = place.name;
	if (index !== undefined) {
		var trainer = TRAINER_ORDER[index];
		text += " " + trainer.name + " " + getTrainerVariant(trainer).sets.join(" ");
	} else {
		place.wild.forEach(function (area) {
			[area.day, area.night || {}].forEach(function (table) {
				Object.keys(table).forEach(function (method) {
					table[method].forEach(function (row) {
						text += " " + row[0];
					});
				});
			});
		});
	}
	return text.toLowerCase().indexOf(query) !== -1;
}

function buildMastersheetArcBody(section, filters, query) {
	var body = $('<div class="ms-arc-body"></div>');
	var nuzlocke = typeof isNuzlockeOn === "function" && isNuzlockeOn();
	var caught = nuzlocke ? getCaughtFamilies(getOwnedSpecies(), readNuzlockeEncounters()) : {};
	var folds = readMastersheetFolds();
	section.places.forEach(function (place, placeIndex) {
		var trainers = place.trainers.filter(function (index) {
			return (filters.routes || !TRAINER_ORDER[index].route) && !(filters.hideDefeated && isTrainerDefeated(index)) &&
				mastersheetMatches(query, place, index);
		});
		var wild = filters.wild && mastersheetMatches(query, place) ? place.wild : [];
		if (!trainers.length && !wild.length) return;
		// A place folds under its name, which counts what it hides. A search shows its matches open.
		var key = section.number + "/" + placeIndex;
		var block = $('<div class="ms-place"></div>').toggleClass("ms-place-folded", !query && !!folds.places[key]).appendTo(body);
		var beaten = trainers.filter(function (index) {
			return isTrainerDefeated(index);
		}).length;
		var counts = [];
		if (trainers.length) counts.push(trainers.length + (trainers.length === 1 ? " trainer" : " trainers") + (beaten ? ", " + beaten + " beaten" : ""));
		if (wild.length) counts.push("wild Pok\u00e9mon");
		var head = $('<button type="button" class="ms-place-head"></button>').attr("aria-expanded", !block.hasClass("ms-place-folded"))
			.append(buildFoldIcon(), $('<span class="ms-place-name"></span>').text(place.name),
				$('<span class="ms-place-meta"></span>').text(counts.join(" \u00b7 ")))
			.click(function () {
				var folded = !block.hasClass("ms-place-folded");
				block.toggleClass("ms-place-folded", folded);
				head.attr("aria-expanded", !folded);
				var saved = readMastersheetFolds();
				if (folded) saved.places[key] = true;
				else delete saved.places[key];
				writeMastersheetFolds(saved);
			});
		$("<h3></h3>").append(head).appendTo(block);
		var inside = $('<div class="ms-place-body"></div>').appendTo(block);
		wild.forEach(function (area) {
			inside.append(buildMastersheetWild(area, caught, nuzlocke));
		});
		trainers.forEach(function (index) {
			inside.append(buildMastersheetTrainer(index, folds));
		});
	});
	if (!body.children().length) body.append('<p class="ms-empty">Nothing here with these filters.</p>');
	return body;
}

function renderMastersheet(container) {
	var filters = readMastersheetFilters();
	var sections = buildMastersheetArcs();
	var kos = readTrainerKOs();
	var current = getProgressArc(getArcs(), kos);
	var tools = $('<div class="ms-tools"></div>').appendTo(container);
	var search = $('<input type="search" class="ms-search" placeholder="Search trainers, places, Pokémon" aria-label="Search the Mastersheet" />').appendTo(tools);
	var jump = $('<select class="ms-jump" aria-label="Jump to an arc"></select>').appendTo(tools);
	// Filters as chips, lit while on.
	var toggle = function (key, label) {
		var chip = $('<label class="ms-filter"></label>').toggleClass("ms-filter-on", !!filters[key]);
		return chip.append(
			$('<input type="checkbox" />').prop("checked", !!filters[key]).change(function () {
				filters[key] = this.checked;
				chip.toggleClass("ms-filter-on", this.checked);
				writeMastersheetFilters(filters);
				rebuild();
			}), document.createTextNode(label));
	};
	tools.append(toggle("routes", "Route trainers"), hasWildData() ? toggle("wild", "Wild Pokémon") : "", toggle("hideDefeated", "Hide defeated"));
	var list = $('<div class="ms-arcs"></div>').appendTo(container);

	var rebuild = function () {
		var query = $.trim(search.val()).toLowerCase();
		list.empty();
		jump.empty();
		sections.forEach(function (section) {
			var arc = section.arc;
			var fights = [];
			section.places.forEach(function (place) {
				fights = fights.concat(place.trainers.filter(function (index) {
					return !TRAINER_ORDER[index].route;
				}));
			});
			var beaten = fights.filter(function (index) {
				return isTrainerDefeated(index, kos);
			}).length;
			var details = $('<details class="ms-arc"></details>').attr("id", "ms-arc-" + section.number)
				.toggleClass("ms-arc-current", section.number === current).appendTo(list);
			$("<summary></summary>").append(
				$('<span class="ms-arc-name"></span>').text(arc.name + " Arc"),
				$('<span class="ms-arc-meta"></span>').text("Level cap " + arc.cap + " · " + beaten + "/" + fights.length + " boss fights" +
					(section.number === current ? " · you are here" : ""))).appendTo(details);
			// Built when opened: all of them at once would be thousands of sprites.
			details.on("toggle", function () {
				if (this.open && !details.children(".ms-arc-body").length) details.append(buildMastersheetArcBody(section, filters, query));
			});
			if (query || section.number === current) details.prop("open", true).append(buildMastersheetArcBody(section, filters, query));
			jump.append($("<option></option>").val(section.number).text(arc.name + " Arc (cap " + arc.cap + ")"));
		});
		jump.val(current);
	};
	search.on("input", function () {
		clearTimeout(search.data("timer"));
		search.data("timer", setTimeout(rebuild, 250));
	});
	jump.change(function () {
		var details = $("#ms-arc-" + $(this).val());
		if (!details.prop("open")) details.prop("open", true).trigger("toggle");
		details[0].scrollIntoView({block: "start"});
	});
	rebuild();
	// The arc you are in, at the top.
	setTimeout(function () {
		var here = $("#ms-arc-" + current);
		if (here.length && current > 0) here[0].scrollIntoView({block: "start"});
	}, 0);
}

if (typeof TRAINER_ORDER !== "undefined" && TRAINER_ORDER.length) {
	registerSheet({key: "mastersheet", label: "Mastersheet", icon: "📖", render: renderMastersheet});
}
