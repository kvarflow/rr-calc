/* global Uint8Array */ // a browser built-in the ES5 lint config does not know
/*
 * Emulator sync, after hzla's Dynamic Calc: with Radical Red running in mGBA on a computer and
 * emulator/radicalred_sync.lua loaded there, or in RetroArch (the Thor, a phone, a computer) with
 * emulator/retroarch_sync.py running beside it, the calc follows the battle. Once a second it reads
 * http://127.0.0.1:31125/state and, in a trainer battle, opens that trainer, loads the Pokémon each
 * side has out (yours from your box, by personality value, so import your .sav first) and sets each
 * one's HP, stat changes and status as the game has them. Single battles only.
 *
 * The party bytes are the save's own format, so save_import.js decodes them.
 */

var EMULATOR_SYNC_KEY = "emulatorSync";
var EMULATOR_URL = "http://127.0.0.1:31125/state";
var EMULATOR_SCRIPTS = {mgba: "emulator/radicalred_sync.lua", retroarch: "emulator/retroarch_sync.py"};
var EMULATOR_STAT_ROWS = [null, "at", "df", "sp", "sa", "sd"];
var emulatorSync = {timer: null, busy: false, applied: {}, lastRaw: ""};

function isEmulatorSyncOn() {
	return readSetting(EMULATOR_SYNC_KEY) === "true";
}

function hexToBytes(hex) {
	var bytes = new Uint8Array(hex.length / 2);
	for (var i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
	return bytes;
}

// A party as decoded Pokémon (null for an empty slot or an egg).
function decodeEmulatorParty(party) {
	var bytes = hexToBytes(party.hex);
	var mons = [];
	for (var i = 0; i < party.count; i++) mons.push(decodeSaveMon(bytes, i * PARTY_MON_SIZE, true));
	return mons;
}

// Your set for a Pokémon from the game: the one imported from your .sav with its personality value.
function findSetForPid(pid) {
	var sets = readCustomSets();
	for (var species in sets) {
		for (var name in sets[species]) {
			if (sets[species][name].pid === pid) return species + " (" + name + ")";
		}
	}
	return null;
}

// The fight with that trainer id (any of its teams), as {index, variant}.
function findFightForTrainerId(id) {
	for (var i = 0; i < TRAINER_ORDER.length; i++) {
		var variants = TRAINER_ORDER[i].variants;
		for (var v = 0; v < variants.length; v++) {
			if ((variants[v].trainerIds || []).indexOf(id) !== -1) return {index: i, variant: variants[v]};
		}
	}
	return null;
}

function emulatorStatusName(status) {
	if (status & 7) return "Asleep";
	if (status & 0x80) return "Badly Poisoned";
	if (status & 8) return "Poisoned";
	if (status & 0x10) return "Burned";
	// Radical Red's frostbite takes freeze's place.
	if (status & 0x20) return "Frostbitten";
	if (status & 0x40) return "Paralyzed";
	return "Healthy";
}

// The level, HP (as a share of the game's maximum: the calc works out its own), stat changes and
// status, as the game has them.
function applyEmulatorBattler(panel, battler) {
	var key = [battler.species, battler.level, battler.hp, battler.maxHp, battler.stages.join(), battler.status].join("|");
	if (emulatorSync.applied[panel] === key) return;
	emulatorSync.applied[panel] = key;
	if (battler.level && +$(panel + " .level").val() !== battler.level) $(panel + " .level").val(battler.level).change();
	var percent = battler.maxHp ? Math.round(1000 * battler.hp / battler.maxHp) / 10 : 100;
	$(panel + " .percent-hp").val(percent).trigger("input");
	EMULATOR_STAT_ROWS.forEach(function (row, stat) {
		if (row) $(panel + " ." + row + " .boost").val(Math.max(-6, Math.min(6, battler.stages[stat] - 6)));
	});
	$(panel + " .status").val(emulatorStatusName(battler.status));
	$(panel + " .current-hp").change();
}

function setEmulatorStatus(text, connected) {
	if (connected && emulatorSync.via) text = text.replace(/^Connected/, "Connected to " + emulatorSync.via);
	$("#emulator-sync-status").text(text).toggleClass("emulator-sync-connected", !!connected);
}

function applyEmulatorState(state) {
	if (!state.inBattle) {
		setEmulatorStatus("Connected · not in a battle", true);
		return;
	}
	if (state.mons.length > 2) {
		setEmulatorStatus("Connected · double battles are not followed yet", true);
		return;
	}
	var party = decodeEmulatorParty(state.party);
	var enemy = decodeEmulatorParty(state.enemyParty);
	var notes = [];
	// Yours: battler 0, from your box.
	var yours = party[state.partyIndexes[0]];
	var setId = yours ? findSetForPid(yours.pid) : null;
	if (setId) {
		if ($("#p1 input.set-selector").val() !== setId) {
			emulatorSync.applied["#p1"] = null;
			$("#p1 input.set-selector").val(setId).change();
		}
		applyEmulatorBattler("#p1", state.mons[0]);
	} else if (yours) {
		notes.push(yours.species + " is not in your box: import your .sav");
	}
	// Theirs: battler 1, from the trainer's team.
	var fight = state.trainer ? findFightForTrainerId(state.trainer) : null;
	var theirs = enemy[state.partyIndexes[1]];
	if (fight && theirs) {
		if (currentTrainerIndex !== fight.index) {
			// A fight with teams to pick from shows the one the game sent out (the rival's follows your
			// starter, Bugsy's your badges, as the game's do).
			if (TRAINER_ORDER[fight.index].variants.length > 1 && !isRivalStarterVariant(fight.variant) && !isBadgeVariant(fight.variant)) {
				writeSetting(TRAINER_VARIANT_KEY, fight.variant.label);
			}
			showTrainer(fight.index);
			emulatorSync.applied["#p2"] = null;
		}
		var sets = getTrainerVariant(TRAINER_ORDER[fight.index]).sets;
		var slot = state.partyIndexes[1] < sets.length && getPokemonName(sets[state.partyIndexes[1]]) === theirs.species ?
			state.partyIndexes[1] : sets.map(getPokemonName).indexOf(theirs.species);
		if (slot !== -1) {
			if (activeTrainerSlot !== slot || $("#p2 input.set-selector").val() !== sets[slot]) {
				emulatorSync.applied["#p2"] = null;
				loadTrainerPokemon(sets[slot], slot);
			}
			applyEmulatorBattler("#p2", state.mons[1]);
		} else {
			notes.push("the trainer's " + theirs.species + " is not in its team here");
		}
	} else if (theirs) {
		notes.push(state.trainer ? "this trainer is not in the calc yet" : "a wild " + theirs.species);
	}
	setEmulatorStatus("Connected · in battle" + (notes.length ? " · " + notes.join("; ") : ""), true);
}

function pollEmulator() {
	if (emulatorSync.busy) return;
	emulatorSync.busy = true;
	$.ajax({url: EMULATOR_URL, dataType: "text", cache: false, timeout: 900})
		.done(function (raw) {
			if (raw === emulatorSync.lastRaw) return;
			emulatorSync.lastRaw = raw;
			try {
				var state = JSON.parse(raw);
				emulatorSync.via = state.via === "retroarch" ? "RetroArch" : "mGBA";
				applyEmulatorState(state);
			} catch (e) {
				setEmulatorStatus("Connected, but could not read the game: " + e.message, true);
			}
		})
		.fail(function (xhr) {
			emulatorSync.lastRaw = "";
			emulatorSync.via = null;
			// The RetroArch script is running but RetroArch is not answering it: it says why.
			setEmulatorStatus(xhr.status === 503 && xhr.responseText ? xhr.responseText :
				"Waiting for the emulator: start its sync script (below)", false);
		})
		.always(function () {
			emulatorSync.busy = false;
		});
}

function setEmulatorSync(on) {
	writeSetting(EMULATOR_SYNC_KEY, on);
	$("#emulator-sync").attr("aria-pressed", on).text(on ? "Emulator sync: on" : "Emulator sync");
	$("#emulator-sync-panel").toggle(on);
	clearInterval(emulatorSync.timer);
	emulatorSync.timer = null;
	emulatorSync.lastRaw = "";
	emulatorSync.applied = {};
	if (on) {
		emulatorSync.timer = setInterval(pollEmulator, 1000);
		pollEmulator();
	}
}

$(document).ready(function () {
	if (getCurrentGame().features.saveImport !== "cfru" || !$("#import-save").length) return;
	var button = $('<button type="button" id="emulator-sync" class="bs-btn bs-btn-default" aria-pressed="false" ' +
		'title="Follow the battle in RetroArch or mGBA"></button>').click(function () {
		setEmulatorSync(!isEmulatorSyncOn());
	});
	var how = function (title, script, steps) {
		return $('<div class="emulator-sync-how"></div>').append($("<b></b>").text(title + ": "), document.createTextNode(steps + " "),
			$('<a target="_blank" rel="noopener"></a>').text("Get " + script.split("/").pop()).attr({href: "./" + script, download: ""}));
	};
	var panel = $('<div id="emulator-sync-panel" class="emulator-sync-panel"></div>').append(
		$('<div id="emulator-sync-status"></div>'),
		how("RetroArch (the Thor, phones, computers)", EMULATOR_SCRIPTS.retroarch,
			"with the mGBA core, turn on Settings > Network > Network Commands, then run this script on the same " +
			"device: on Android in Termux (pkg install python, termux-setup-storage, then " +
			"python ~/storage/downloads/retroarch_sync.py), on a computer with python3."),
		how("mGBA 0.10+ on a computer", EMULATOR_SCRIPTS.mgba, "Tools > Scripting, File > Load script, and pick it."),
		$('<div class="emulator-sync-help"></div>').text("Import your .sav first so your Pok\u00e9mon are in your box. Single battles for now."));
	$("#import-save").after(button);
	button.closest(".import-actions").after(panel);
	setEmulatorSync(isEmulatorSyncOn());
});
