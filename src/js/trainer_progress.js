/*
 * Run progress for the trainer panel. "KO'd" marks the Pokémon 2 Pokémon as fainted (its
 * sprite greys out) and moves on to the next one; "Defeated" marks or clears the whole team.
 * A trainer counts as defeated once every Pokémon of the team you face is KO'd. Two bars
 * under the panel follow the current level-cap arc (the trainers sharing this fight's level
 * cap, named after its last required fight) and the whole game. KOs are saved per mode.
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

// The run of consecutive trainers sharing this trainer's level cap.
function getArc(index) {
	var cap = String(TRAINER_ORDER[index].levelCap);
	var first = index;
	var last = index;
	while (first > 0 && String(TRAINER_ORDER[first - 1].levelCap) === cap) first--;
	while (last < TRAINER_ORDER.length - 1 && String(TRAINER_ORDER[last + 1].levelCap) === cap) last++;
	var boss = last;
	while (boss > first && TRAINER_ORDER[boss].optional) boss--;
	return {first: first, last: last, name: TRAINER_ORDER[boss].name};
}

function drawProgressBar(bar, done, total) {
	var percent = total ? 100 * done / total : 0;
	// Drawn like the Pokémon HP bars, always green.
	bar.css("background", "linear-gradient(to right, green " + percent + "%, white 0%)")
		.attr({"aria-valuenow": done, "aria-valuemax": total});
}

function renderTrainerProgress() {
	if (!$("#run-progress").length) return;
	var kos = readTrainerKOs();
	var arc = getArc(currentTrainerIndex);
	var arcKOs = 0;
	var arcTotal = 0;
	for (var i = arc.first; i <= arc.last; i++) {
		arcKOs += Math.min(getKOSlots(i, kos).length, getTeamSize(i));
		arcTotal += getTeamSize(i);
	}
	var defeated = TRAINER_ORDER.filter(function (trainer, index) {
		return isTrainerDefeated(index, kos);
	}).length;
	$("#arc-progress-label").text(arc.name + " Arc — " + arcKOs + "/" + arcTotal + " Pokémon KO'd");
	drawProgressBar($("#arc-progress-bar"), arcKOs, arcTotal);
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
