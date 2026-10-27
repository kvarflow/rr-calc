/*
 * The Dex (a sheet, sheets.js): one Pokémon at a time, as this game has it: types, base stats,
 * abilities (with what they do), its evolution line with how each stage evolves and its level-up
 * moves (both from the game: data/learnsets/<game>.js, loaded the first time the Dex opens), where
 * to catch it and which trainers use it. Opens on the Pokémon in Pokémon 2, or on one tapped in the
 * other sheets.
 */

var DEX_SPECIES_KEY = "dexSpecies";
var DEX_STAT_NAMES = [["hp", "HP"], ["atk", "Atk"], ["def", "Def"], ["spa", "SpA"], ["spd", "SpD"], ["spe", "Spe"]];
var dexSpecies = null;
var learnsetsLoading = null;

// Opens the Dex on a Pokémon.
function openDex(species) {
	dexSpecies = species;
	if (typeof openSheetKey !== "undefined" && openSheetKey) showSheet("dex");
	else openSheet("dex");
}

// The game's learnsets, loaded once (the page lists the file to fetch, so it is kept for offline use).
function loadLearnsets(callback) {
	if (typeof LEARNSETS !== "undefined") return callback();
	var link = $('link[rel="prefetch"][data-learnsets]');
	if (!link.length) return callback();
	if (!learnsetsLoading) {
		learnsetsLoading = $.Deferred();
		var script = document.createElement("script");
		script.src = link.attr("href");
		script.onload = function () {
			learnsetsLoading.resolve();
		};
		script.onerror = function () {
			learnsetsLoading.resolve();
		};
		document.head.appendChild(script);
	}
	learnsetsLoading.done(callback);
}

function getDexSpeciesList() {
	return Object.keys(pokedex).filter(function (name) {
		return !/-(Gmax|Totem)$/.test(name);
	}).sort();
}

function getDefaultDexSpecies() {
	var foe = getPokemonName($("#p2 input.set-selector").val() || "");
	var saved = readSetting(DEX_SPECIES_KEY);
	return [dexSpecies, foe, saved, "Bulbasaur"].filter(function (name) {
		return name && pokedex[name];
	})[0] || getDexSpeciesList()[0];
}

function buildDexTypes(types) {
	return $('<span class="dex-types"></span>').append(types.map(function (type) {
		return $('<span class="dex-type"></span>').attr("data-type", type).text(type);
	}));
}

function buildDexStats(species) {
	var table = $('<div class="dex-stats"></div>');
	var bs = species.bs;
	var stats = {hp: bs.hp, atk: bs.at, def: bs.df, spa: gen === 1 ? bs.sl : bs.sa, spd: gen === 1 ? bs.sl : bs.sd, spe: bs.sp};
	var total = 0;
	DEX_STAT_NAMES.forEach(function (stat) {
		var value = stats[stat[0]] || 0;
		total += value;
		$('<div class="dex-stat"></div>').append(
			$('<span class="dex-stat-name"></span>').text(stat[1]),
			$('<span class="dex-stat-value"></span>').text(value),
			$('<span class="dex-stat-bar"></span>').append($("<span></span>").css({
				width: Math.min(100, value / 2) + "%",
				background: "hsl(" + Math.min(120, value * 0.8) + ", 65%, 45%)"
			}))).appendTo(table);
	});
	$('<div class="dex-stat dex-stat-total"></div>').append($('<span class="dex-stat-name"></span>').text("Total"),
		$('<span class="dex-stat-value"></span>').text(total)).appendTo(table);
	return table;
}

// A Pokémon's abilities as {slot: name}: the game's own list where the page has it (the calc's
// species data keeps only the first), else the calc's.
function getDexAbilities(name, species) {
	var data = typeof RADICAL_RED_SAVE_DATA !== "undefined" && getCurrentGame().id === "radicalred" ? RADICAL_RED_SAVE_DATA : null;
	var id = data ? data.species.indexOf(name) : -1;
	if (id === -1) return species.abilities || {};
	var slots = data.abilities[id] || [];
	var abilities = {0: slots[0]};
	if (slots[1] && slots[1] !== slots[0]) abilities[1] = slots[1];
	if (slots[2]) abilities.H = slots[2];
	return abilities;
}

function buildDexAbilities(name, species) {
	var list = $('<div class="dex-abilities"></div>');
	var abilities = getDexAbilities(name, species);
	Object.keys(abilities).forEach(function (slot) {
		var ability = abilities[slot];
		var item = $('<div class="dex-ability"></div>').append($("<b></b>").text(ability + (slot === "H" ? " (hidden)" : "")));
		if (typeof ABILITY_DESCRIPTIONS !== "undefined" && hasGameFeature("abilityText") && ABILITY_DESCRIPTIONS[ability]) {
			item.append(": ", document.createTextNode(ABILITY_DESCRIPTIONS[ability]));
		}
		list.append(item);
	});
	return list;
}

// The Pokémon a species evolves from (EVOLUTIONS lists what each evolves into).
function getPreEvolution(name) {
	for (var from in EVOLUTIONS) {
		if (EVOLUTIONS[from].some(function (evolution) {
			return evolution[0] === name;
		})) return from;
	}
	return null;
}

// One Pokémon of the line and, under it, what it evolves into and how.
function buildEvolutionNode(name, current, seen) {
	seen[name] = true;
	var node = $('<div class="dex-evo-node"></div>');
	$('<button type="button" class="dex-evo-mon"></button>').toggleClass("dex-evo-current", name === current)
		.attr("title", name === current ? name : "Open " + name + " in the Dex")
		.append(createSpriteImage(name, function () {
			$(this).remove();
		}), $('<span class="dex-evo-name"></span>').text(name))
		.click(function () {
			if (name !== current && pokedex[name]) openDex(name);
		}).appendTo(node);
	(EVOLUTIONS[name] || []).forEach(function (evolution) {
		if (seen[evolution[0]]) return;
		$('<div class="dex-evo-branch"></div>').append(
			$('<div class="dex-evo-how"></div>').text(evolution[1]),
			buildEvolutionNode(evolution[0], current, seen)).appendTo(node);
	});
	return node;
}

// The whole line, from its first stage, with how each one evolves (from the game).
function buildDexEvolutions(name) {
	var section = $('<div class="dex-evolutions"></div>');
	loadLearnsets(function () {
		if (typeof EVOLUTIONS === "undefined") {
			section.append('<p class="dex-none">No evolution data for this game yet.</p>');
			return;
		}
		var root = name;
		var guard = 0;
		for (var from = getPreEvolution(root); from && guard < 10; from = getPreEvolution(root), guard++) root = from;
		if (root === name && !EVOLUTIONS[name]) {
			section.append('<p class="dex-none">Does not evolve.</p>');
			return;
		}
		section.append(buildEvolutionNode(root, name, {}));
	});
	return section;
}

function buildDexMoves(name) {
	var section = $('<div class="dex-moves"></div>');
	loadLearnsets(function () {
		var learnset = typeof LEARNSETS !== "undefined" ? LEARNSETS[name] || LEARNSETS[(pokedex[name] || {}).baseSpecies] : null;
		if (!learnset) {
			section.append('<p class="dex-none">No level-up moves for this Pokémon in this game\'s data.</p>');
			return;
		}
		var table = $('<table class="dex-table"><thead><tr><th>Lv</th><th>Move</th><th>Type</th><th>Cat.</th><th class="dex-numeric">Power</th></tr></thead></table>');
		var body = $("<tbody></tbody>").appendTo(table);
		learnset.forEach(function (entry) {
			var move = calc.MOVES[gen][entry[1]] || {};
			var category = move.category || (gen <= 3 ? "" : "Physical");
			$("<tr></tr>").append(
				$("<td></td>").text(entry[0] === 0 ? "Evo" : entry[0]),
				$("<td></td>").text(entry[1]),
				$("<td></td>").append(move.type ? buildDexTypes([move.type]) : ""),
				$("<td></td>").text(category),
				$('<td class="dex-numeric"></td>').text(move.bp || "—")).appendTo(body);
		});
		section.append(table);
	});
	return section;
}

// Every wild area with this Pokémon: [{area, method, when, min, max, rate}].
function findWildEncounters(name) {
	var found = [];
	if (typeof ENCOUNTERS === "undefined" || !hasGameFeature("encounters")) return found;
	ENCOUNTERS.forEach(function (area, index) {
		[["day", area.night ? "day" : ""], ["night", "night"]].forEach(function (time) {
			var table = area[time[0]];
			if (!table) return;
			ENCOUNTER_METHODS.forEach(function (method) {
				(table[method.key] || []).forEach(function (row) {
					if (row[0] === name) {
						found.push({area: area, index: index, method: method.label, when: time[1], min: row[1], max: row[2], rate: row[3]});
					}
				});
			});
		});
	});
	return found;
}

function buildDexWild(name) {
	var found = findWildEncounters(name);
	if (!found.length) return $('<p class="dex-none">Not found in the wild.</p>');
	var table = $('<table class="dex-table"><thead><tr><th>Where</th><th>How</th><th>Lv</th><th class="dex-numeric">Chance</th></tr></thead></table>');
	var body = $("<tbody></tbody>").appendTo(table);
	found.forEach(function (row) {
		$("<tr></tr>").append(
			$("<td></td>").text(encounterLabel(row.area)),
			$("<td></td>").text(row.method + (row.when ? " (" + row.when + ")" : "")),
			$("<td></td>").text(row.min === row.max ? row.min : row.min + "–" + row.max),
			$('<td class="dex-numeric"></td>').text(row.rate + "%")).appendTo(body);
	});
	return table;
}

function buildDexTrainers(name) {
	var list = $('<div class="dex-trainers"></div>');
	getTrainerNavOrder(true).forEach(function (index) {
		var trainer = TRAINER_ORDER[index];
		trainer.variants.forEach(function (variant) {
			variant.sets.forEach(function (setId, slot) {
				if (getPokemonName(setId) !== name) return;
				var set = getSetData(setId).set;
				$('<button type="button" class="dex-trainer"></button>')
					.text(trainer.name + (trainer.variants.length > 1 ? " (" + variant.label + ")" : "") + " · Lv " +
						getMastersheetLevel(index, variant, slot, set) + (trainer.location ? " · " + trainer.location : ""))
					.toggleClass("dex-trainer-defeated", isTrainerDefeated(index))
					.attr("title", (set.moves || []).join(", "))
					.click(function () {
						openTrainerInCalc(index, setId, slot);
					}).appendTo(list);
			});
		});
	});
	if (!list.children().length) list.append('<p class="dex-none">No trainer uses it.</p>');
	return list;
}

function renderDex(container) {
	var name = getDefaultDexSpecies();
	dexSpecies = name;
	writeSetting(DEX_SPECIES_KEY, name);
	var species = pokedex[name];
	var tools = $('<div class="dex-tools"></div>').appendTo(container);
	var list = $('<datalist id="dex-species-list"></datalist>').append(getDexSpeciesList().map(function (option) {
		return $("<option></option>").val(option);
	}));
	var input = $('<input type="search" class="dex-search" list="dex-species-list" placeholder="Find a Pokémon" aria-label="Pokémon" />');
	tools.append(input, list);
	input.on("change keydown", function (ev) {
		if (ev.type === "keydown" && ev.key !== "Enter") return;
		var wanted = $.trim(input.val()).toLowerCase();
		var match = getDexSpeciesList().filter(function (option) {
			return option.toLowerCase() === wanted;
		})[0] || getDexSpeciesList().filter(function (option) {
			return option.toLowerCase().indexOf(wanted) === 0;
		})[0];
		if (match) openDex(match);
	});
	var page = $('<div class="dex-page"></div>').appendTo(container);
	var head = $('<div class="dex-head"></div>').appendTo(page);
	$('<span class="dex-sprite"></span>').append(createSpriteImage(name, function () {
		$(this).remove();
	})).appendTo(head);
	$('<div class="dex-title"></div>').append($("<h2></h2>").text(name), buildDexTypes(species.types),
		species.weightkg ? $('<span class="dex-weight"></span>').text(species.weightkg + " kg") : "").appendTo(head);
	var grid = $('<div class="dex-grid"></div>').appendTo(page);
	var card = function (title, content) {
		return $('<section class="dex-card"></section>').append($("<h3></h3>").text(title), content).appendTo(grid);
	};
	card("Base stats", buildDexStats(species));
	card("Evolution", buildDexEvolutions(name));
	if (gen >= 3) card("Abilities", buildDexAbilities(name, species));
	card("Level-up moves", buildDexMoves(name));
	if (hasGameFeature("encounters")) card("In the wild", buildDexWild(name));
	if (TRAINER_ORDER.length) card("Trainers with it", buildDexTrainers(name));
}

registerSheet({key: "dex", label: "Dex", icon: "📕", render: renderDex});

// Tapping a Pokémon's name in the other sheets opens it here.
$(document).on("click", ".sheet-view .ms-wild-mon, .sheet-view .fs-species", function () {
	var name = $(this).attr("data-species");
	if (name && pokedex[name]) openDex(name);
});
