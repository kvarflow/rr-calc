/*
 * Wild encounters tab (AYN Thor only): every location's wild Pokémon by method, for day
 * (04:00-16:59) and night (17:00-03:59), from data/encounters.js. It opens on the current
 * trainer's location, and marks species already in your box.
 */

var ENCOUNTER_LOCATION_KEY = "encounterLocation";
var ENCOUNTER_METHODS = [
	{key: "grass", label: "Grass / cave"},
	{key: "surf", label: "Surfing"},
	{key: "rockSmash", label: "Rock Smash"},
	{key: "oldRod", label: "Old Rod"},
	{key: "goodRod", label: "Good Rod"},
	{key: "superRod", label: "Super Rod"}
];

// The Thor's lower screen is nearly square (8:7); phones are about twice as long as they are wide.
function isThorScreen() {
	var longSide = Math.max(screen.width, screen.height);
	var shortSide = Math.min(screen.width, screen.height);
	return document.documentElement.classList.contains("small-screen") && longSide / shortSide < 1.45;
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

function renderEncounters() {
	var panel = $("#encounters");
	var location = ENCOUNTERS[~~$("#encounter-location").val()];
	var list = panel.find(".encounter-list").empty();
	if (!location) return;
	var night = $("#encounter-night").attr("aria-pressed") === "true";
	var table = (night && location.night) || location.day;
	panel.find(".encounter-time-note").text(location.night ? "" : "Same by day and night.");
	var owned = getOwnedSpecies();
	ENCOUNTER_METHODS.forEach(function (method) {
		var rows = table[method.key];
		if (!rows) return;
		var section = $('<section class="encounter-method"></section>').append($("<h4></h4>").text(method.label));
		rows.forEach(function (row) {
			var levels = row[1] === row[2] ? "Lv " + row[1] : "Lv " + row[1] + "–" + row[2];
			$('<div class="encounter-row"></div>')
				.toggleClass("encounter-owned", !!owned[row[0]])
				.append(
					$('<span class="encounter-sprite"></span>').append(createSpriteImage(row[0], function () {
						$(this).remove();
					})),
					$('<span class="encounter-name"></span>').text(row[0]).append(owned[row[0]] ? ' <span class="encounter-check" title="In your box">✓</span>' : ""),
					$('<span class="encounter-levels"></span>').text(levels),
					$('<span class="encounter-rate"></span>').text(row[3] + "%"))
				.appendTo(section);
		});
		list.append(section);
	});
	if (!list.children().length) list.append('<p class="encounter-empty">No wild Pokémon here.</p>');
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

$(document).ready(function () {
	if (!isThorScreen()) return;
	var select = $('<select id="encounter-location" aria-label="Location"></select>');
	ENCOUNTERS.forEach(function (location, i) {
		select.append($("<option></option>").val(i).text(encounterLabel(location)));
	});
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
			}),
			$('<button type="button" id="encounter-night" class="encounter-time"></button>')
				.attr("aria-pressed", isNightNow())
				.text(isNightNow() ? "☾ Night" : "☀ Day")
				.click(function () {
					var night = $(this).attr("aria-pressed") !== "true";
					$(this).attr("aria-pressed", night).text(night ? "☾ Night" : "☀ Day");
					renderEncounters();
				})),
		'<p class="encounter-time-note"></p>',
		'<div class="encounter-list"></div>');
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
