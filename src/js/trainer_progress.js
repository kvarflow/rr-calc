/*
 * Run progress for the trainer panel. "KO'd" marks the Pokémon 2 Pokémon as fainted (its
 * sprite greys out) and moves on to the next one; "Defeated" marks or clears the whole team.
 * A trainer counts as defeated once every Pokémon of the team you face is KO'd. Two bars
 * under the panel count defeated trainers: in the current level-cap arc (every trainer,
 * optional ones too, up to the last one with this fight's level cap, named after its last
 * required fight) and in the whole game. KOs are saved per mode.
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

function writeTrainerKOs(kos) {
	writeSetting(getTrainerKOKey(), JSON.stringify(kos));
	renderTrainerProgress();
	$(document).trigger("trainer:progress");
}

// Called by the Professor Oak button when a new run starts.
function clearTrainerProgress() {
	writeTrainerKOs({});
}

// Teams that depend on a choice (the rival's starter, Lorelei's weather) are tracked apart.
function getTeamKey(index) {
	return index + "|" + getTrainerVariant(TRAINER_ORDER[index]).label;
}

function getKOSlots(index, kos) {
	return (kos || readTrainerKOs())[getTeamKey(index)] || [];
}

function setKOSlots(index, slots) {
	var kos = readTrainerKOs();
	if (slots.length) kos[getTeamKey(index)] = slots;
	else delete kos[getTeamKey(index)];
	writeTrainerKOs(kos);
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
	TRAINER_ORDER.forEach(function (trainer, index) {
		var cap = getCapLevel(index);
		var previous = index ? trainerArcCaps[index - 1] : running;
		if (!trainer.optional && cap > running) {
			running = cap;
			trainerArcCaps.push(cap);
		} else if (trainer.optional && cap > running) {
			trainerArcCaps.push(getNextArcCap(index, running) || cap);
		} else {
			trainerArcCaps.push(previous || running);
		}
	});
	return trainerArcCaps;
}

// The cap of the next required fight that raises the level cap above `running`.
function getNextArcCap(index, running) {
	for (var i = index + 1; i < TRAINER_ORDER.length; i++) {
		if (!TRAINER_ORDER[i].optional && getCapLevel(i) > running) return getCapLevel(i);
	}
	return 0;
}

// The arc around a trainer: its first and last trainer, named after its last required fight
// at the arc's level cap (e.g. Brock).
function getArc(index) {
	var caps = getArcCaps();
	var first = index;
	var last = index;
	while (first > 0 && caps[first - 1] === caps[index]) first--;
	while (last < caps.length - 1 && caps[last + 1] === caps[index]) last++;
	var boss = -1;
	for (var i = last; i >= first && boss === -1; i--) {
		if (!TRAINER_ORDER[i].optional && getCapLevel(i) === caps[index]) boss = i;
	}
	for (i = last; i >= first && boss === -1; i--) {
		if (!TRAINER_ORDER[i].optional) boss = i;
	}
	return {first: first, last: last, name: TRAINER_ORDER[boss === -1 ? last : boss].name};
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
	var arc = getArc(currentTrainerIndex);
	var arcTotal = arc.last - arc.first + 1;
	var arcDefeated = 0;
	var defeated = 0;
	TRAINER_ORDER.forEach(function (trainer, index) {
		if (!isTrainerDefeated(index, kos)) return;
		defeated++;
		if (index >= arc.first && index <= arc.last) arcDefeated++;
	});
	$("#arc-progress-label").text(arc.name + " Arc — " + arcDefeated + "/" + arcTotal + " trainers defeated");
	drawProgressBar($("#arc-progress-bar"), arcDefeated, arcTotal);
	$("#game-progress-label").text("Game progress — " + defeated + "/" + TRAINER_ORDER.length + " trainers defeated");
	drawProgressBar($("#game-progress-bar"), defeated, TRAINER_ORDER.length);

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
