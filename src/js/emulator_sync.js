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
 *
 * In the Pcalc app sync is on until it's turned off: the app reads RetroArch itself, so it connects
 * as soon as RetroArch answers. While nothing answers it asks less often, and not at all while the
 * calculator is out of sight.
 */

var EMULATOR_SYNC_KEY = "emulatorSync";
var EMULATOR_URL = "http://127.0.0.1:31125/state";
var EMULATOR_SCRIPTS = {mgba: "emulator/radicalred_sync.lua", retroarch: "emulator/retroarch_sync.py"};
var EMULATOR_STAT_ROWS = [null, "at", "df", "sp", "sa", "sd"];
// How often to ask, in ms: while connected, and while nothing answers.
var EMULATOR_POLL_MS = 1000;
var EMULATOR_WAIT_POLL_MS = 3000;
var emulatorSync = {timer: null, busy: false, applied: {}, history: {}, historyChanged: false, lastRaw: "", connected: false, lastPoll: 0};

function isEmulatorSyncOn() {
	var setting = readSetting(EMULATOR_SYNC_KEY);
	// In the app it's on unless turned off.
	return setting === null ? isInPcalcApp() : setting === "true";
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

/*
 * What has happened in the battle (battle_history.js), from the game's own state, when the sync
 * sends it (script 2 on: status2, status3, lastMove, lockedMove, disable, wish for each battler):
 * the trainer AI's predictions then follow the battle turn by turn.
 */
function getEmulatorVolatile(key, battler) {
	if (battler.status2 === undefined || !battler.disable || typeof AI_VOLATILE_DEFAULTS === "undefined") return null;
	var disable = [];
	for (var i = 0; i < battler.disable.length; i += 2) disable.push(parseInt(battler.disable.substr(i, 2), 16));
	var u16 = function (at) {
		return disable[at] | (disable[at + 1] << 8);
	};
	var known = getBattleHistoryMoves(key);
	// A move id as the panel names it (its Hidden Power carries the type).
	var moveName = function (id) {
		var name = id && id !== 0xFFFF ? RADICAL_RED_SAVE_DATA.moves[id] || "" : "";
		if (!name) return "";
		for (var k = 0; k < known.length; k++) {
			if (known[k] === name || known[k].indexOf(name + " ") === 0) return known[k];
		}
		return name;
	};
	var status2 = battler.status2 >>> 0;
	var status3 = battler.status3 >>> 0;
	var has2 = function (mask) {
		return (status2 & mask) !== 0;
	};
	var perish = (status3 & 0x20) !== 0;
	return $.extend({}, AI_VOLATILE_DEFAULTS, {
		firstTurn: disable[0x16] !== 0,
		lastMove: moveName(battler.lastMove),
		protectUses: disable[0x08],
		sub: has2(0x01000000),
		taunt: (disable[0x13] & 0xF) !== 0,
		encore: (disable[0x0E] & 0xF) !== 0,
		torment: has2(0x80000000),
		disabled: (disable[0x0B] & 0xF) !== 0 ? moveName(u16(0x04)) : "",
		yawn: (status3 & 0x1800) !== 0,
		perish: perish,
		perishLast: perish && (disable[0x0F] & 0xF) === 0,
		confused: has2(0x7),
		infatuated: has2(0x000F0000),
		wrapped: has2(0x0000E000),
		noEscape: has2(0x04000000),
		destinyBond: has2(0x02000000),
		recharge: has2(0x00400000),
		locked: has2(0x00001000) && !!battler.lockedMove,
		stockpile: Math.min(3, disable[0x09]),
		wish: battler.wish > 0
	});
}

// Sets a side's history from the game, once its Pokémon is in its panel.
function applyEmulatorHistory(key, battler) {
	var vol = getEmulatorVolatile(key, battler);
	if (!vol) return;
	// Encored: the game keeps the move it is held to.
	if (vol.encore && battler.disable) {
		var encored = parseInt(battler.disable.substr(14, 2) + battler.disable.substr(12, 2), 16);
		var name = encored ? RADICAL_RED_SAVE_DATA.moves[encored] : "";
		if (name) vol.lastMove = name;
	}
	var text = JSON.stringify(vol);
	if (emulatorSync.history[key] === text && getBattleVolatile(key)) return;
	emulatorSync.history[key] = text;
	battleHistory[key] = {setId: getBattleHistorySetId(key), vol: vol, synced: true};
	emulatorSync.historyChanged = true;
}

// Running inside the Pcalc Android app, whose user agent ends in "Pcalc/<version>".
function isInPcalcApp() {
	return /\bPcalc\//.test(navigator.userAgent);
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
		applyEmulatorHistory("p1", state.mons[0]);
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
			applyEmulatorHistory("p2", state.mons[1]);
		} else {
			notes.push("the trainer's " + theirs.species + " is not in its team here");
		}
	} else if (theirs) {
		notes.push(state.trainer ? "this trainer is not in the calc yet" : "a wild " + theirs.species);
	}
	// The AI's predictions again, with what has happened in the battle.
	if (emulatorSync.historyChanged) {
		emulatorSync.historyChanged = false;
		if (typeof performCalculations === "function") performCalculations();
	}
	setEmulatorStatus("Connected · in battle" + (notes.length ? " · " + notes.join("; ") : ""), true);
}

function pollEmulator() {
	if (emulatorSync.busy || document.hidden) return;
	if (!emulatorSync.connected && Date.now() - emulatorSync.lastPoll < EMULATOR_WAIT_POLL_MS - 100) return;
	emulatorSync.busy = true;
	emulatorSync.lastPoll = Date.now();
	$.ajax({url: EMULATOR_URL, dataType: "text", cache: false, timeout: 900})
		.done(function (raw) {
			emulatorSync.connected = true;
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
			emulatorSync.connected = false;
			emulatorSync.lastRaw = "";
			emulatorSync.via = null;
			// The RetroArch script is running but RetroArch is not answering it: it says why.
			setEmulatorStatus(xhr.status === 503 && xhr.responseText ? xhr.responseText :
				isInPcalcApp() ? "Waiting for RetroArch" : "Waiting for the emulator: start its sync script (below)", false);
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
	emulatorSync.history = {};
	emulatorSync.connected = false;
	emulatorSync.lastPoll = 0;
	if (on) {
		emulatorSync.timer = setInterval(pollEmulator, EMULATOR_POLL_MS);
		pollEmulator();
	}
}

// Back in sight: ask straight away.
document.addEventListener("visibilitychange", function () {
	if (!document.hidden && emulatorSync.timer) {
		emulatorSync.lastPoll = 0;
		pollEmulator();
	}
});

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
	var panel = $('<div id="emulator-sync-panel" class="emulator-sync-panel"></div>').append($('<div id="emulator-sync-status"></div>'));
	// The Pcalc app (kvarflow/Pcalc) reads RetroArch itself: no script to run.
	if (isInPcalcApp()) {
		panel.append($('<div class="emulator-sync-how"></div>').append($("<b></b>").text("RetroArch: "), document.createTextNode(
			"built into this app, and it connects by itself. Play with the mGBA core and turn on Settings > Network > " +
			"Network Commands (port 55355).")),
		$('<div class="emulator-sync-help"></div>').text("Import your .sav first so your Pok\u00e9mon are in your box. Single battles for now."));
		$("#import-save").after(button);
		button.closest(".import-actions").after(panel);
		setEmulatorSync(isEmulatorSyncOn());
		return;
	}
	panel.append(
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
