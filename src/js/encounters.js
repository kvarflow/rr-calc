/*
 * Wild encounters tab (small screens: the Thor and phones): every location's wild Pokémon by method, for day
 * (04:00-16:59) and night (17:00-03:59), from data/encounters.js. It opens on the current
 * trainer's location, and ticks species already in your box, or evolved from or into one there.
 *
 * Nuzlocke (ticked per mode): one encounter per location, counting a location as the game names it
 * (all of Mt. Moon's floors are one). A .sav import fills in where each of your Pokémon was caught;
 * tapping a Pokémon, or "Missed it", uses up a location by hand. Professor Oak's new run clears them.
 * Dupes clause: anything in the evolution family of a Pokémon you have caught (or have in your box) is
 * blacked out at other locations, and is not your encounter there.
 */

var ENCOUNTER_LOCATION_KEY = "encounterLocation";
// Grass and fishing are the likeliest, so they sit side by side: on foot on the left, on the
// water on the right (the rods, then surfing).
var ENCOUNTER_METHODS = [
	{key: "grass", label: "Grass / cave", side: "land"},
	{key: "rockSmash", label: "Rock Smash", side: "land"},
	{key: "oldRod", label: "Old Rod", side: "water"},
	{key: "goodRod", label: "Good Rod", side: "water"},
	{key: "superRod", label: "Super Rod", side: "water"},
	{key: "surf", label: "Surfing", side: "water"}
];
var NUZLOCKE_KEY = "nuzlocke";
// {location name: {species: [names], fromSave: bool, missed: bool}}
var NUZLOCKE_ENCOUNTERS_KEY = "nuzlockeEncounters";

// A tab of the small-screen layout, so not on desktop.
function isWildTabShown() {
	return document.documentElement.classList.contains("small-screen");
}

function encounterLabel(location) {
	return location.name + (location.area ? " · " + location.area : "");
}

function encounterKey(text) {
	return String(text || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function isNightNow() {
	var hour = new Date().getHours();
	return hour >= 17 || hour < 4;
}

// Species in your Team, Box and Box 2 (by name, so a form counts on its own).
function getOwnedSpecies() {
	var owned = {};
	$("#box-panel .box-pokemon").each(function () {
		var setId = $(this).attr("data-set-id") || "";
		owned[setId.slice(0, setId.indexOf(" (")) || setId] = true;
	});
	return owned;
}

// The family a species belongs to (data/encounters.js), or the species itself.
var evolutionFamilyOf = {};
EVOLUTION_FAMILIES.forEach(function (family, i) {
	family.forEach(function (name) {
		evolutionFamilyOf[name] = "family " + i;
	});
});
function getEvolutionFamily(name) {
	return evolutionFamilyOf[name] || name;
}

// The families of everything you have caught: your Nuzlocke encounters and your box.
function getCaughtFamilies(owned, encounters) {
	var caught = {};
	Object.keys(owned).forEach(function (name) {
		caught[getEvolutionFamily(name)] = true;
	});
	Object.keys(encounters).forEach(function (location) {
		encounters[location].species.forEach(function (name) {
			caught[getEvolutionFamily(name)] = true;
		});
	});
	return caught;
}

function isNuzlockeOn() {
	return readSetting(NUZLOCKE_KEY + ":" + getPageMode()) === "true";
}

function readNuzlockeEncounters() {
	try {
		return JSON.parse(readSetting(NUZLOCKE_ENCOUNTERS_KEY + ":" + getPageMode())) || {};
	} catch (e) {
		return {};
	}
}

function writeNuzlockeEncounters(encounters) {
	writeSetting(NUZLOCKE_ENCOUNTERS_KEY + ":" + getPageMode(), JSON.stringify(encounters));
}

function setNuzlockeEncounter(name, encounter) {
	var encounters = readNuzlockeEncounters();
	if (encounter) encounters[name] = encounter;
	else delete encounters[name];
	writeNuzlockeEncounters(encounters);
	renderEncounters();
}

// The save's Pokémon by where they were caught (gifts, trades and eggs are not wild locations).
// They replace an earlier import's; locations you marked yourself stay as you marked them.
function recordSaveEncounters(save) {
	var wild = {};
	ENCOUNTERS.forEach(function (location) {
		wild[location.name] = true;
	});
	var encounters = readNuzlockeEncounters();
	Object.keys(encounters).forEach(function (name) {
		if (encounters[name].fromSave) delete encounters[name];
	});
	save.party.concat(save.boxes).forEach(function (mon) {
		var name = MAP_SECTIONS.names[mon.metLocation - MAP_SECTIONS.first];
		if (!name || !wild[name]) return;
		var encounter = encounters[name] = encounters[name] || {species: [], fromSave: true};
		if (encounter.fromSave) encounter.species.push(mon.species);
	});
	writeNuzlockeEncounters(encounters);
}

function renderNuzlockeStatus(location, encounter, encounters) {
	var status = $("#encounters .encounter-nuzlocke-status").empty();
	var names = {};
	ENCOUNTERS.forEach(function (l) {
		names[l.name] = true;
	});
	var used = Object.keys(encounters).filter(function (name) {
		return names[name];
	}).length;
	var count = $('<span class="encounter-nuzlocke-count"></span>').text(used + " of " + Object.keys(names).length + " locations used");
	if (!encounter) {
		var hint = "No encounter at " + location.name + " yet: tap the first Pokémon you meet" +
			($("#encounters .encounter-dupe").length ? " that is not a dupe. " : ". ");
		status.append(document.createTextNode(hint),
			$('<button type="button" class="encounter-nuzlocke-missed">Missed it</button>').click(function () {
				setNuzlockeEncounter(location.name, {species: [], missed: true});
			}));
	} else {
		status.append(
			$("<b></b>").text(location.name + ": "),
			document.createTextNode(encounter.missed ? "encounter missed" : encounter.species.join(", ")),
			encounter.fromSave ? '<span class="encounter-nuzlocke-source"> (from your .sav)</span>' : "",
			encounter.species.length > 1 ? '<span class="encounter-nuzlocke-warning"> More than one Pokémon was caught here.</span>' : "",
			" ",
			$('<button type="button" class="encounter-nuzlocke-clear">Clear</button>').click(function () {
				setNuzlockeEncounter(location.name, null);
			}));
	}
	status.append(" ", count);
}

function renderEncounters() {
	var panel = $("#encounters");
	var location = ENCOUNTERS[~~$("#encounter-location").val()];
	var list = panel.find(".encounter-list").empty();
	if (!location) return;
	var night = $("#encounter-night").attr("aria-pressed") === "true";
	var table = (night && location.night) || location.day;
	panel.find(".encounter-time-note").text(location.night ? "" : "Same by day and night.");
	var owned = getOwnedSpecies();
	var nuzlocke = isNuzlockeOn();
	var encounters = nuzlocke ? readNuzlockeEncounters() : {};
	var encounter = encounters[location.name];
	var caught = getCaughtFamilies(owned, encounters);
	// What of each family is in your box, so a Furret ticks Route 2's Sentret.
	var ownedByFamily = {};
	Object.keys(owned).forEach(function (name) {
		var family = getEvolutionFamily(name);
		(ownedByFamily[family] = ownedByFamily[family] || []).push(name);
	});
	panel.toggleClass("encounter-nuzlocke-on", nuzlocke);
	// Used locations are ticked in the list.
	$("#encounter-location option").text(function (i) {
		return encounterLabel(ENCOUNTERS[i]) + (encounters[ENCOUNTERS[i].name] ? " ✓" : "");
	});
	var columns = {land: $('<div class="encounter-column"></div>'), water: $('<div class="encounter-column"></div>')};
	ENCOUNTER_METHODS.forEach(function (method) {
		var rows = table[method.key];
		if (!rows) return;
		var section = $('<section class="encounter-method"></section>').append($("<h4></h4>").text(method.label));
		rows.forEach(function (row) {
			var levels = row[1] === row[2] ? "Lv " + row[1] : "Lv " + row[1] + "–" + row[2];
			// Your encounter here, as caught or since evolved (a Furret from Route 2's Sentret).
			var chosen = !!encounter && encounter.species.some(function (name) {
				return getEvolutionFamily(name) === getEvolutionFamily(row[0]);
			});
			var dupe = nuzlocke && !chosen && !!caught[getEvolutionFamily(row[0])];
			var inBox = ownedByFamily[getEvolutionFamily(row[0])];
			var element = $('<div class="encounter-row"></div>')
				.toggleClass("encounter-owned", !!inBox)
				.toggleClass("encounter-chosen", chosen)
				.toggleClass("encounter-blocked", !!encounter && !chosen)
				.toggleClass("encounter-dupe", dupe)
				.append(
					$('<span class="encounter-sprite"></span>').append(createSpriteImage(row[0], function () {
						$(this).remove();
					})),
					$('<span class="encounter-name"></span>').text(row[0])
						// A cosmetic forme the calc does not have ("Summer" Deerling).
						.append(row[4] ? $('<span class="encounter-forme"></span>').text(" (" + row[4] + ")") : "")
						.append(inBox ? [" ", $('<span class="encounter-check">✓</span>').attr("title", "In your box: " + inBox.join(", "))] : "")
						.append(dupe ? ' <span class="encounter-dupe-tag" title="You have caught one of this family">Dupe</span>' : ""),
					$('<span class="encounter-levels"></span>').text(levels),
					$('<span class="encounter-rate"></span>').text(row[3] + "%"))
				.appendTo(section);
			// Nuzlocke: the first Pokémon you meet here (that is not a dupe) is this location's encounter.
			if (nuzlocke && !encounter && !dupe) {
				element.attr({role: "button", tabindex: 0, title: "Your encounter here"}).on("click keydown", function (ev) {
					if (ev.type === "keydown" && ev.key !== "Enter" && ev.key !== " ") return;
					ev.preventDefault();
					setNuzlockeEncounter(location.name, {species: [row[0]]});
				});
			}
		});
		columns[method.side].append(section);
	});
	list.append(columns.land.children().length ? columns.land : "", columns.water.children().length ? columns.water : "");
	if (!list.children().length) list.append('<p class="encounter-empty">No wild Pokémon here.</p>');
	// After the rows, so it can tell whether any are dupes.
	if (nuzlocke) renderNuzlockeStatus(location, encounter, encounters);
}

function showEncounterLocation(index) {
	index = Math.max(0, Math.min(ENCOUNTERS.length - 1, index));
	$("#encounter-location").val(index);
	writeSetting(ENCOUNTER_LOCATION_KEY, index);
	renderEncounters();
}

// The first area of the location the current trainer is at, if it has wild Pokémon.
function findTrainerLocation() {
	var trainer = typeof TRAINER_ORDER !== "undefined" && TRAINER_ORDER[currentTrainerIndex];
	if (!trainer) return -1;
	var key = encounterKey(trainer.location);
	for (var i = 0; i < ENCOUNTERS.length; i++) {
		if (encounterKey(ENCOUNTERS[i].name) === key) return i;
	}
	return -1;
}

// A save import and a new run change the Nuzlocke encounters on any screen, for when the Wild
// tab is next opened.
$(document).on("save:imported", function (event, save) {
	recordSaveEncounters(save);
	if ($("#encounters").length) renderEncounters();
});
$(document).on("run:new", function () {
	writeNuzlockeEncounters({});
	if ($("#encounters").length) renderEncounters();
});

$(document).ready(function () {
	if (!isWildTabShown()) return;
	var select = $('<select id="encounter-location" aria-label="Location"></select>');
	ENCOUNTERS.forEach(function (location, i) {
		select.append($("<option></option>").val(i).text(encounterLabel(location)));
	});
	// The location on top, its Pokémon as the main view, and the options and notes under them.
	var panel = $('<fieldset id="encounters" class="encounters"><legend align="center">Wild encounters</legend></fieldset>').append(
		$('<div class="encounter-controls"></div>').append(
			$('<button type="button" class="encounter-step" aria-label="Previous location">◀</button>').click(function () {
				showEncounterLocation(~~select.val() - 1);
			}),
			select.change(function () {
				showEncounterLocation(~~$(this).val());
			}),
			$('<button type="button" class="encounter-step" aria-label="Next location">▶</button>').click(function () {
				showEncounterLocation(~~select.val() + 1);
			})),
		'<div class="encounter-list"></div>',
		$('<div class="encounter-footer"></div>').append(
			'<p class="encounter-nuzlocke-status" role="status"></p>',
			$('<div class="encounter-options"></div>').append(
				$('<button type="button" id="encounter-night" class="encounter-time"></button>')
					.attr("aria-pressed", isNightNow())
					.text(isNightNow() ? "☾ Night" : "☀ Day")
					.click(function () {
						var night = $(this).attr("aria-pressed") !== "true";
						$(this).attr("aria-pressed", night).text(night ? "☾ Night" : "☀ Day");
						renderEncounters();
					}),
				$('<label class="encounter-nuzlocke-toggle"></label>').append(
					$('<input type="checkbox" id="encounter-nuzlocke" />').prop("checked", isNuzlockeOn()).change(function () {
						writeSetting(NUZLOCKE_KEY + ":" + getPageMode(), this.checked);
						renderEncounters();
					}), " Nuzlocke"),
				'<p class="encounter-time-note"></p>')));
	$(".wrapper").append(panel);
	var saved = readSetting(ENCOUNTER_LOCATION_KEY);
	var start = findTrainerLocation();
	showEncounterLocation(start !== -1 ? start : (saved !== null ? ~~saved : 0));
	// Follow the trainer you are fighting; keep the box marks up to date.
	$(document).on("trainer:shown", function () {
		var here = findTrainerLocation();
		if (here !== -1) showEncounterLocation(here);
	});
	$(document).on("customsets:changed box:rendered", renderEncounters);
});
