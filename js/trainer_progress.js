/*
 * Run progress for the trainer panel. "KO'd" marks the Pokémon 2 Pokémon as fainted (its
 * sprite greys out) and moves on to the next one; "Defeated" marks or clears the whole team.
 * A trainer counts as defeated once every Pokémon of the team you face is KO'd. Two bars
 * under the panel count defeated trainers: in the level-cap arc you are in (getProgressArc) and
 * in the whole game. KOs are saved per mode.
 */

function getTrainerKOKey() {
	return "trainerKOs:" + getPageMode();
}

function readTrainerKOs() {
	try {
		return JSON.parse(readSetting(getTrainerKOKey())) || {};
	} catch (e) {
		return {};
	}
}

// The KOs as last read, for the many read-only checks (isTrainerDefeated for every trainer); it is
// parsed again only when the saved text changes. Never changed in place: readTrainerKOs gives a copy
// to change.
var sharedTrainerKOs = {text: null, kos: {}};

function readSharedTrainerKOs() {
	var text = readSetting(getTrainerKOKey());
	if (text !== sharedTrainerKOs.text) sharedTrainerKOs = {text: text, kos: readTrainerKOs()};
	return sharedTrainerKOs.kos;
}

function writeTrainerKOs(kos) {
	writeSetting(getTrainerKOKey(), JSON.stringify(kos));
	renderTrainerProgress();
	$(document).trigger("trainer:progress");
}

// Called by the Professor Oak button when a new run starts.
function clearTrainerProgress() {
	writeSetting(getDefeatLevelsKey(), "");
	writeTrainerKOs({});
}

// Teams that depend on a choice (the rival's starter, Lorelei's weather) are tracked apart.
function getTeamKey(index) {
	return index + "|" + getTrainerVariant(TRAINER_ORDER[index]).label;
}

function getKOSlots(index, kos) {
	return (kos || readSharedTrainerKOs())[getTeamKey(index)] || [];
}

function setKOSlots(index, slots) {
	var kos = readTrainerKOs();
	if (slots.length) kos[getTeamKey(index)] = slots;
	else delete kos[getTeamKey(index)];
	recordDefeatLevel(index, slots.length >= getTeamSize(index));
	writeTrainerKOs(kos);
}

function getVariantKey(index, variant) {
	return index + "|" + variant.label;
}

// Whether that team of a fight is beaten (a fight with several teams can be beaten with any).
function isVariantDefeated(index, variant, kos) {
	var slots = (kos || readSharedTrainerKOs())[getVariantKey(index, variant)] || [];
	return variant.sets.length > 0 && slots.length >= variant.sets.length;
}

/*
 * A beaten team keeps the levels it had: the level it followed when you marked it defeated (your
 * save's highest, or the cap you were at). A fight a save marks won (trainer_controls.js) has none
 * recorded and shows the document's levels.
 */
function getDefeatLevelsKey() {
	return "defeatLevels:" + getPageMode();
}

function readDefeatLevels() {
	try {
		return JSON.parse(readSetting(getDefeatLevelsKey())) || {};
	} catch (e) {
		return {};
	}
}

function recordDefeatLevel(index, defeated) {
	var levels = readDefeatLevels();
	// The level the team followed just before (getTeamLevelBasis: your save's, or the cap's).
	var highest = typeof getTeamHighestLevel === "function" ? getTeamHighestLevel(index, getTrainerVariant(TRAINER_ORDER[index])) : 0;
	var cap = typeof getShownLevelCap === "function" ? parseInt(getShownLevelCap(index)) || 0 : 0;
	// The arc you are in as you beat it (this fight left out, so a gym leader counts in its own).
	var kos = readTrainerKOs();
	delete kos[getTeamKey(index)];
	var arcs = getArcs();
	var arcCap = arcs[getProgressArc(arcs, kos)].cap;
	if (defeated) levels[getTeamKey(index)] = {level: highest, cap: cap, arcCap: arcCap};
	else delete levels[getTeamKey(index)];
	writeSetting(getDefeatLevelsKey(), JSON.stringify(levels));
}

// Recorded as {level, cap}; older records are just the level.
function getDefeatRecord(index, variant) {
	var record = readDefeatLevels()[getVariantKey(index, variant)];
	return typeof record === "number" ? {level: record, cap: 0} : record || {level: 0, cap: 0};
}

function getDefeatLevel(index, variant) {
	return getDefeatRecord(index, variant).level || 0;
}

function getDefeatCap(index, variant) {
	return getDefeatRecord(index, variant).cap || 0;
}

function getTeamSize(index) {
	return getTrainerVariant(TRAINER_ORDER[index]).sets.length;
}

function isTrainerDefeated(index, kos) {
	var size = getTeamSize(index);
	return size > 0 && getKOSlots(index, kos).length >= size;
}

// The level cap's number: Hardcore writes some as "16+" or "28/36"; back-to-back fights have none.
function getCapLevel(index) {
	return parseInt(TRAINER_ORDER[index].levelCap) || 0;
}

/*
 * Route trainers (`route`, every other trainer in the game) come after the boss fights in
 * TRAINER_ORDER, so saved progress keeps its places, and each is fought before the boss fight
 * `route.before` (null: after the last). They are in the arc of that fight and leave the progress
 * bars to the boss fights.
 */
function isRouteTrainer(index) {
	return !!(TRAINER_ORDER[index] && TRAINER_ORDER[index].route);
}

// How many boss fights TRAINER_ORDER starts with.
function getStoryLength() {
	for (var i = 0; i < TRAINER_ORDER.length; i++) {
		if (TRAINER_ORDER[i].route) return i;
	}
	return TRAINER_ORDER.length;
}

// The boss fight a trainer is placed by: itself, or the one a route trainer comes before.
function getStoryIndex(index) {
	var placed = isRouteTrainer(index) ? TRAINER_ORDER[index].route : isMovedFight(index) ? TRAINER_ORDER[index].moved : null;
	if (!placed) return index;
	var before = placed.before;
	return before === null || before === undefined ? getLastStoryFight() : before;
}

/*
 * A boss fight you have moved (Mastersheet, Reorder; trainer_controls.js's applyTrainerOrderFixes):
 * `moved.before` is the fight it now comes before (null: after the last). It keeps its place in
 * TRAINER_ORDER (so saved KOs stay with it) but counts in that fight's arc, like a route trainer.
 */
function isMovedFight(index) {
	return !!(TRAINER_ORDER[index] && TRAINER_ORDER[index].moved);
}

// The last boss fight still in its own place.
function getLastStoryFight() {
	for (var i = getStoryLength() - 1; i > 0; i--) {
		if (!isMovedFight(i)) return i;
	}
	return 0;
}

/*
 * Which level-cap arc each trainer belongs to, as the cap in force while you play: a required
 * fight with a higher cap starts a new arc; required fights listed with a lower cap (the
 * Kanto rematches) and fights with no cap stay in the arc they are fought in; an optional fight
 * listed with a higher cap belongs to the arc it is fought in, the next one.
 */
var trainerArcCaps = null;

function getArcCaps() {
	if (trainerArcCaps) return trainerArcCaps;
	trainerArcCaps = [];
	var running = 0;
	var previous = 0;
	TRAINER_ORDER.forEach(function (trainer, index) {
		if (trainer.route) return;
		// A moved fight takes the arc of the one it now comes before (below).
		if (trainer.moved) {
			trainerArcCaps.push(null);
			return;
		}
		var cap = getCapLevel(index);
		previous = previous || running;
		if (!trainer.optional && cap > running) {
			running = cap;
			trainerArcCaps.push(cap);
		} else if (trainer.optional && cap > running) {
			trainerArcCaps.push(getNextArcCap(index, running) || cap);
		} else {
			trainerArcCaps.push(previous || running);
		}
		previous = trainerArcCaps[index];
	});
	endArcsAtTheirBoss(trainerArcCaps);
	for (var m = 0; m < trainerArcCaps.length; m++) {
		if (trainerArcCaps[m] === null) trainerArcCaps[m] = trainerArcCaps[getStoryIndex(m)];
	}
	for (var i = trainerArcCaps.length; i < TRAINER_ORDER.length; i++) trainerArcCaps.push(trainerArcCaps[getStoryIndex(i)]);
	return trainerArcCaps;
}

// The fight an arc is named after, among the fights first..last at one cap: its gym leader; else
// its last required fight listed at that cap; else its last required fight; else the last.
function findArcBoss(first, last, cap) {
	var leaders = typeof LEVEL_CAP_LEADERS !== "undefined" ? LEVEL_CAP_LEADERS : [];
	var i;
	for (i = last; i >= first; i--) {
		if (!isMovedFight(i) && leaders.indexOf(TRAINER_ORDER[i].name) !== -1) return i;
	}
	for (i = last; i >= first; i--) {
		if (!isMovedFight(i) && !TRAINER_ORDER[i].optional && getCapLevel(i) === cap) return i;
	}
	for (i = last; i >= first; i--) {
		if (!isMovedFight(i) && !TRAINER_ORDER[i].optional) return i;
	}
	while (last > first && isMovedFight(last)) last--;
	return last;
}

/*
 * An arc ends with its boss: the fights the documents list after it at the same cap (the S.S. Anne
 * after Misty, Route 9 and Morty after Lt. Surge) are on the way to the next boss, so they open the
 * next arc. Those after the last arc's boss (the postgame) stay.
 */
function endArcsAtTheirBoss(caps) {
	// Over the fights in their own place (a moved one, null here, is skipped).
	var own = [];
	caps.forEach(function (cap, index) {
		if (cap !== null) own.push(index);
	});
	var first = 0;
	while (first < own.length) {
		var last = first;
		while (last < own.length - 1 && caps[own[last + 1]] === caps[own[first]]) last++;
		if (last < own.length - 1) {
			var next = caps[own[last + 1]];
			var boss = findArcBoss(own[first], own[last], caps[own[first]]);
			for (var i = first; i <= last; i++) {
				if (own[i] > boss) caps[own[i]] = next;
			}
		}
		first = last + 1;
	}
}

// The cap of the next required fight that raises the level cap above `running`.
function getNextArcCap(index, running) {
	for (var i = index + 1; i < getStoryLength(); i++) {
		if (!isMovedFight(i) && !TRAINER_ORDER[i].optional && getCapLevel(i) > running) return getCapLevel(i);
	}
	return 0;
}

// The arc around a trainer: its first and last trainer, named after its last required fight
// at the arc's level cap (e.g. Brock).
function getArc(index) {
	index = getStoryIndex(index);
	var caps = getArcCaps();
	var first = index;
	var last = index;
	// Across the moved fights in between (they belong to the fight they now come before).
	var step = function (from, by) {
		for (var i = from + by; i >= 0 && i < getStoryLength(); i += by) {
			if (!isMovedFight(i)) return caps[i] === caps[index] ? i : -1;
		}
		return -1;
	};
	for (var j = step(first, -1); j !== -1; j = step(first, -1)) first = j;
	for (j = step(last, 1); j !== -1; j = step(last, 1)) last = j;
	var boss = findArcBoss(first, last, caps[index]);
	return {first: first, last: last, boss: boss, cap: caps[index], name: TRAINER_ORDER[boss].name};
}

// Every arc in game order.
function getArcs() {
	var arcs = [];
	for (var index = 0; index < getStoryLength(); index++) {
		if (isMovedFight(index)) continue;
		var arc = getArc(index);
		arcs.push(arc);
		index = arc.last;
	}
	return arcs;
}

// The arc a trainer counts in, by arc number. A defeated one: the arc you were in when you beat
// it (recorded then; a .sav's fights and older records have none, so the arc it is listed in). One
// still to fight: its own arc, or the one you are in if that is later (it was left for later).
function getCountedArc(index, arcs, current, kos) {
	var listed = 0;
	while (listed < arcs.length - 1 && getStoryIndex(index) > arcs[listed].last) listed++;
	if (!isTrainerDefeated(index, kos)) return Math.max(listed, current);
	var arcCap = getDefeatRecord(index, getTrainerVariant(TRAINER_ORDER[index])).arcCap;
	for (var arc = 0; arc < arcs.length; arc++) {
		if (arcs[arc].cap === arcCap) return arc;
	}
	return listed;
}

/*
 * The arc you are in, by your progress rather than the trainer you look at: the one after the last
 * arc whose boss (its gym leader, or the fight that raises the cap) you have beaten. So beating
 * Misty moves you on to Lt. Surge's arc, which takes the fights you left for later with it.
 */
function getProgressArc(arcs, kos) {
	var current = 0;
	arcs.forEach(function (arc, i) {
		if (isTrainerDefeated(arc.boss, kos)) current = Math.min(i + 1, arcs.length - 1);
	});
	return current;
}

function drawProgressBar(bar, done, total) {
	var percent = total ? 100 * done / total : 0;
	// Drawn like the Pokémon HP bars, always green.
	bar.css("background", "linear-gradient(to right, green " + percent + "%, white 0%)")
		.attr({"aria-valuenow": done, "aria-valuemax": total});
	if (bar[0]) bar[0].style.setProperty("--hp-fill", percent + "%"); // for the small-screen layout
}

function renderTrainerProgress() {
	if (!$("#run-progress").length) return;
	var kos = readTrainerKOs();
	var arcs = getArcs();
	var current = getProgressArc(arcs, kos);
	var arc = arcs[current];
	var arcTotal = 0;
	var arcDefeated = 0;
	var total = 0;
	var defeated = 0;
	// A fight the documents list twice (marked duplicate) counts once; route trainers don't count.
	TRAINER_ORDER.forEach(function (trainer, index) {
		if (trainer.duplicate || trainer.route) return;
		var inArc = getCountedArc(index, arcs, current, kos) === current;
		total++;
		if (inArc) arcTotal++;
		if (!isTrainerDefeated(index, kos)) return;
		defeated++;
		if (inArc) arcDefeated++;
	});
	$("#arc-progress-label").text(arc.name + " Arc — " + arcDefeated + "/" + arcTotal + " trainers defeated");
	drawProgressBar($("#arc-progress-bar"), arcDefeated, arcTotal);
	$("#game-progress-label").text("Game progress — " + defeated + "/" + total + " trainers defeated");
	drawProgressBar($("#game-progress-bar"), defeated, total);

	// The current team: greyed-out KOs, the Defeated box and the KO button's label.
	var slots = getKOSlots(currentTrainerIndex, kos);
	$("#trainer-team .pokemon-sprite").each(function (slot) {
		$(this).toggleClass("trainer-pokemon-ko", slots.indexOf(slot) !== -1);
	});
	$("#trainer-defeated").prop("checked", isTrainerDefeated(currentTrainerIndex, kos));
	$("#trainer-ko").text(slots.indexOf(activeTrainerSlot) === -1 ? "KO'd" : "Undo KO");
}

// Marks the Pokémon in Pokémon 2 as KO'd and loads the next one still standing,
// or brings it back if it was already KO'd.
function toggleActiveKO() {
	var slots = getKOSlots(currentTrainerIndex).slice();
	var at = slots.indexOf(activeTrainerSlot);
	// For the run record (run_record.js): who made the KO.
	$(document).trigger("trainer:ko", [currentTrainerIndex, activeTrainerSlot, at === -1]);
	if (at !== -1) {
		slots.splice(at, 1);
		setKOSlots(currentTrainerIndex, slots);
		return;
	}
	slots.push(activeTrainerSlot);
	slots.sort(function (a, b) {
		return a - b;
	});
	setKOSlots(currentTrainerIndex, slots);
	var sprites = $("#trainer-team .pokemon-sprite");
	for (var step = 1; step < sprites.length; step++) {
		var next = (activeTrainerSlot + step) % sprites.length;
		if (slots.indexOf(next) === -1) {
			loadTrainerPokemon(sprites.eq(next).attr("data-set-id"), next);
			return;
		}
	}
}

$(document).ready(function () {
	if (typeof TRAINER_ORDER === "undefined" || !TRAINER_ORDER.length) return;
	$('<button type="button" id="trainer-ko" title="Mark the Pokémon in Pokémon 2 as KO\'d and load the next one"></button>')
		.click(toggleActiveKO)
		.insertBefore("#reset-trainer");
	$('<label class="trainer-defeated"><input type="checkbox" id="trainer-defeated" /> Defeated</label>')
		.appendTo("#trainer-nav .trainer-heading")
		.find("input")
		.change(function () {
			var slots = [];
			for (var slot = 0; this.checked && slot < getTeamSize(currentTrainerIndex); slot++) slots.push(slot);
			setKOSlots(currentTrainerIndex, slots);
		});
	$(
		'<fieldset id="run-progress">' +
		'<legend align="center">Progress</legend>' +
		'<div class="run-progress-row"><span id="arc-progress-label"></span>' +
		'<div id="arc-progress-bar" class="hpbar hp-green" role="progressbar" aria-labelledby="arc-progress-label" aria-valuemin="0"></div></div>' +
		'<div class="run-progress-row"><span id="game-progress-label"></span>' +
		'<div id="game-progress-bar" class="hpbar hp-green" role="progressbar" aria-labelledby="game-progress-label" aria-valuemin="0"></div></div>' +
		'</fieldset>')
		.insertAfter("#trainer-nav");
	$(document).on("trainer:shown trainer:active", renderTrainerProgress);
	renderTrainerProgress();
});
