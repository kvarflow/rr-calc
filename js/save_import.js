/* global Uint8Array, DataView */ // browser built-ins the ES5 lint config does not know
/*
 * Imports the party and PC boxes of a Pokémon Radical Red 4.1 save file (.sav) into the
 * Team/Box panel. The Team section mirrors the party, the rest go to the Box.
 *
 * Radical Red runs on the CFRU engine on top of FireRed. Its save keeps the Gen 3
 * envelope: 32 sectors of 0x1000 bytes holding two rotating copies of 14 sections, each
 * with a footer (section id u16 at 0xFF4, signature u32 at 0xFF8, save index u32 at 0xFFC).
 * CFRU differences, as documented by PKForge's Radical Red engine:
 *  - Pokémon data is plaintext (no PID-based shuffling or XOR encryption).
 *  - The party (section 1, count at 0x34, entries at 0x38) uses 100-byte entries.
 *  - The PC uses compact 58-byte entries with bit-packed moves. Boxes 1-19 sit in the
 *    PokemonStorage stream, the first 0xFF0 bytes of sections 5-12 plus 0x450 bytes of
 *    section 13 joined together; boxes 20-22 sit in the unchecksummed sectors 30-31.
 *  - Species, move and item ids are Radical Red's own (see radical_red_save_data.js).
 */

var SAVE_SECTOR_SIZE = 0x1000;
var SAVE_FILE_SIZE = 0x20000;
var SAVE_SECTION_COUNT = 14;
var SAVE_PARTY_SECTION = 1;
var SAVE_PARTY_COUNT_OFFSET = 0x34;
var SAVE_PARTY_OFFSET = 0x38;
var PARTY_MON_SIZE = 100;
var PC_MON_SIZE = 58;
var BOX_SLOTS = 30;
var STREAM_BOXES = 19;
// Bytes of each storage section (5-13) that belong to the PokemonStorage stream.
var STORAGE_SECTION_SIZES = [0xFF0, 0xFF0, 0xFF0, 0xFF0, 0xFF0, 0xFF0, 0xFF0, 0xFF0, 0x450];
// Boxes 20-22: region starting at sector 30 whose second half continues in sector 31,
// skipping sector 30's footer (bytes 0xFF0-0xFFF).
var RAW_REGION_FILE_OFFSET = 0x1E000;
var RAW_REGION_SECTOR_DATA = 0xFF0;
var RAW_BOXES_REGION_OFFSET = 0xB0C;
var RAW_BOXES = 3;
// CFRU's extra event flags (ids from 0x900) are stored in the spare bytes after
// section 0's data, then continue in the spare bytes after section 4's.
var EXTRA_FLAG_AREAS = [{section: 0, start: 0xF24, size: 0xCC}, {section: 4, start: 0xD98, size: 0x258}];
var FIRST_EXTRA_FLAG = 0x900;
// Game mode flags, set when a new game starts. Found by comparing fresh Hardcore,
// Normal + Minimal Grinding and Normal saves: Minimal Grinding sets 0x1032, Hardcore
// sets 0x1034 (and always turns Minimal Grinding on too).
var MINIMAL_GRINDING_FLAG = 0x1032;
var HARDCORE_FLAG = 0x1034;

var SAVE_NATURES = ["Hardy", "Lonely", "Brave", "Adamant", "Naughty", "Bold", "Docile", "Relaxed", "Impish", "Lax",
	"Timid", "Hasty", "Serious", "Jolly", "Naive", "Modest", "Mild", "Quiet", "Bashful", "Rash",
	"Calm", "Gentle", "Sassy", "Careful", "Quirky"];
var HIDDEN_POWER_TYPES = ["Fighting", "Flying", "Poison", "Ground", "Rock", "Bug", "Ghost", "Steel",
	"Fire", "Water", "Grass", "Electric", "Psychic", "Ice", "Dragon", "Dark"];

// Total EXP needed to reach `level`, by PokeAPI growth rate id (see radical_red_save_data.js).
var GROWTH_RATE_FORMULAS = {
	1: function (n) { return Math.floor(5 * n * n * n / 4); }, // slow
	2: function (n) { return n * n * n; }, // medium fast
	3: function (n) { return Math.floor(4 * n * n * n / 5); }, // fast
	4: function (n) { return Math.floor(6 * n * n * n / 5) - 15 * n * n + 100 * n - 140; }, // medium slow
	5: function (n) { // erratic
		if (n <= 50) return Math.floor(n * n * n * (100 - n) / 50);
		if (n <= 68) return Math.floor(n * n * n * (150 - n) / 100);
		if (n <= 98) return Math.floor(n * n * n * Math.floor((1911 - 10 * n) / 3) / 500);
		return Math.floor(n * n * n * (160 - n) / 100);
	},
	6: function (n) { // fluctuating
		if (n <= 15) return Math.floor(n * n * n * (Math.floor((n + 1) / 3) + 24) / 50);
		if (n <= 36) return Math.floor(n * n * n * (n + 14) / 50);
		return Math.floor(n * n * n * (Math.floor(n / 2) + 32) / 50);
	}
};
// Used for Radical Red-only species missing from the growth rate table.
var DEFAULT_GROWTH_RATE = 2;

function getExpForLevel(growthRate, level) {
	return level <= 1 ? 0 : GROWTH_RATE_FORMULAS[growthRate](level);
}

function getLevelFromExp(speciesId, exp) {
	var growthRate = +RADICAL_RED_SAVE_DATA.growthRates[speciesId] || DEFAULT_GROWTH_RATE;
	var level = 1;
	while (level < 100 && exp >= getExpForLevel(growthRate, level + 1)) level++;
	return level;
}

function getHiddenPowerType(ivs) {
	// Gen 3 formula, with the stats in game order HP, Atk, Def, Spe, SpA, SpD.
	var bits = [ivs.hp, ivs.at, ivs.df, ivs.sp, ivs.sa, ivs.sd];
	var sum = 0;
	for (var i = 0; i < bits.length; i++) sum += (bits[i] & 1) << i;
	return HIDDEN_POWER_TYPES[Math.floor(sum * 15 / 63)];
}

// Gen 3 text encoding: letters, digits and the punctuation that can appear in nicknames.
function decodeSaveString(bytes, offset, length) {
	var special = {0x00: " ", 0x1B: "é", 0xAB: "!", 0xAC: "?", 0xAD: ".", 0xAE: "-", 0xB4: "'",
		0xB5: "♂", 0xB6: "♀", 0xB8: ",", 0xBA: "/", 0xF0: ":"};
	var text = "";
	for (var i = 0; i < length; i++) {
		var c = bytes[offset + i];
		if (c === 0xFF) break;
		if (c >= 0xBB && c <= 0xD4) text += String.fromCharCode(65 + c - 0xBB);
		else if (c >= 0xD5 && c <= 0xEE) text += String.fromCharCode(97 + c - 0xD5);
		else if (c >= 0xA1 && c <= 0xAA) text += String.fromCharCode(48 + c - 0xA1);
		else if (special[c] !== undefined) text += special[c];
	}
	return text.trim();
}

// File offsets of the newest copy of each section, or null if any is missing.
function findSaveSections(bytes, view) {
	var offsets = [];
	var saveIndexes = [];
	for (var sector = 0; sector < SAVE_FILE_SIZE / SAVE_SECTOR_SIZE; sector++) {
		var base = sector * SAVE_SECTOR_SIZE;
		// The low byte of the signature varies between FireRed builds (0x08012025 retail).
		if ((view.getUint32(base + 0xFF8, true) & 0xFFFFFF00) !== 0x08012000) continue;
		var id = view.getUint16(base + 0xFF4, true);
		var saveIndex = view.getUint32(base + 0xFFC, true);
		if (id < SAVE_SECTION_COUNT && (offsets[id] === undefined || saveIndex >= saveIndexes[id])) {
			offsets[id] = base;
			saveIndexes[id] = saveIndex;
		}
	}
	for (var i = 0; i < SAVE_SECTION_COUNT; i++) {
		if (offsets[i] === undefined) return null;
	}
	return offsets;
}

function readStorageStream(bytes, sections) {
	var total = STORAGE_SECTION_SIZES.reduce(function (sum, size) { return sum + size; }, 0);
	var stream = new Uint8Array(total);
	var cursor = 0;
	for (var i = 0; i < STORAGE_SECTION_SIZES.length; i++) {
		var start = sections[5 + i];
		stream.set(bytes.subarray(start, start + STORAGE_SECTION_SIZES[i]), cursor);
		cursor += STORAGE_SECTION_SIZES[i];
	}
	return stream;
}

function readRawBoxes(bytes) {
	var size = RAW_BOXES * BOX_SLOTS * PC_MON_SIZE;
	var out = new Uint8Array(size);
	for (var i = 0; i < size; i++) {
		var regionOffset = RAW_BOXES_REGION_OFFSET + i;
		var fileOffset = RAW_REGION_FILE_OFFSET + (regionOffset < RAW_REGION_SECTOR_DATA ?
			regionOffset : SAVE_SECTOR_SIZE + regionOffset - RAW_REGION_SECTOR_DATA);
		out[i] = bytes[fileOffset];
	}
	return out;
}

// Field offsets inside a 100-byte party entry and a compact 58-byte PC entry.
var MON_LAYOUTS = {
	party: {species: 0x20, item: 0x22, exp: 0x24, moves: 0x2C, evs: 0x38, ivs: 0x48, level: 0x54},
	pc: {species: 0x1C, item: 0x1E, exp: 0x20, packedMoves: 0x27, evs: 0x2C, ivs: 0x36}
};

// Decodes one Pokémon, or returns null for an empty slot, an egg or unknown data.
function decodeSaveMon(bytes, offset, isParty) {
	var layout = isParty ? MON_LAYOUTS.party : MON_LAYOUTS.pc;
	var view = new DataView(bytes.buffer, bytes.byteOffset + offset, isParty ? PARTY_MON_SIZE : PC_MON_SIZE);
	var data = RADICAL_RED_SAVE_DATA;
	var speciesId = view.getUint16(layout.species, true);
	var ivWord = view.getUint32(layout.ivs, true);
	var isBadEgg = view.getUint8(0x13) & 1;
	var isEgg = (ivWord >>> 30) & 1;
	if (!data.species[speciesId] || isBadEgg || isEgg) return null;

	var moveIds = [];
	if (isParty) {
		for (var i = 0; i < 4; i++) moveIds.push(view.getUint16(layout.moves + 2 * i, true));
	} else {
		// Four 10-bit move ids packed little-endian into 5 bytes. 40 bits overflow 32-bit
		// bitwise operators, so the packed value is built with arithmetic.
		var packed = 0;
		for (var b = 4; b >= 0; b--) packed = packed * 256 + view.getUint8(layout.packedMoves + b);
		for (var m = 0; m < 4; m++) {
			moveIds.push(packed % 1024);
			packed = Math.floor(packed / 1024);
		}
	}

	// EVs and IVs are stored in the order HP, Atk, Def, Spe, SpA, SpD.
	var evs = {
		hp: view.getUint8(layout.evs), at: view.getUint8(layout.evs + 1), df: view.getUint8(layout.evs + 2),
		sp: view.getUint8(layout.evs + 3), sa: view.getUint8(layout.evs + 4), sd: view.getUint8(layout.evs + 5)
	};
	var ivs = {
		hp: ivWord & 31, at: (ivWord >>> 5) & 31, df: (ivWord >>> 10) & 31,
		sp: (ivWord >>> 15) & 31, sa: (ivWord >>> 20) & 31, sd: (ivWord >>> 25) & 31
	};
	var pid = view.getUint32(0, true);
	// No ability id is stored: the hidden-ability flag picks slot 3, otherwise the PID's
	// lowest bit picks slot 1 or 2.
	var abilitySlots = data.abilities[speciesId] || [];
	var hasHiddenAbility = (ivWord >>> 31) & 1;
	var ability = hasHiddenAbility && abilitySlots[2] ? abilitySlots[2] :
		(pid & 1) && abilitySlots[1] ? abilitySlots[1] : abilitySlots[0];

	var moves = moveIds.map(function (id) {
		var name = data.moves[id] || "";
		return name === "Hidden Power" ? name + " " + getHiddenPowerType(ivs) : name;
	}).filter(Boolean);

	return {
		species: data.species[speciesId],
		nickname: decodeSaveString(bytes, offset + 8, 10),
		item: data.items[view.getUint16(layout.item, true)] || "",
		level: isParty ? view.getUint8(layout.level) : getLevelFromExp(speciesId, view.getUint32(layout.exp, true)),
		nature: SAVE_NATURES[pid % 25],
		ability: ability || "",
		evs: evs,
		ivs: ivs,
		moves: moves
	};
}

function readExtraFlag(bytes, sections, flagId) {
	var byteIndex = (flagId - FIRST_EXTRA_FLAG) >> 3;
	for (var i = 0; i < EXTRA_FLAG_AREAS.length; i++) {
		var area = EXTRA_FLAG_AREAS[i];
		if (byteIndex < area.size) {
			return ((bytes[sections[area.section] + area.start + byteIndex] >> (flagId & 7)) & 1) === 1;
		}
		byteIndex -= area.size;
	}
	return false;
}

/*
 * Returns {party: [mon], boxes: [mon], hardcore: bool, minimalGrinding: bool} with each mon as returned by decodeSaveMon plus a
 * `location` label, or null if the file is not a readable Radical Red save.
 */
function parseRadicalRedSave(bytes) {
	if (bytes.length < SAVE_FILE_SIZE) return null;
	var view = new DataView(bytes.buffer, bytes.byteOffset, SAVE_FILE_SIZE);
	var sections = findSaveSections(bytes, view);
	if (!sections) return null;

	var result = {
		party: [],
		boxes: [],
		hardcore: readExtraFlag(bytes, sections, HARDCORE_FLAG),
		minimalGrinding: readExtraFlag(bytes, sections, MINIMAL_GRINDING_FLAG)
	};
	var partyBase = sections[SAVE_PARTY_SECTION];
	var partyCount = Math.min(view.getUint32(partyBase + SAVE_PARTY_COUNT_OFFSET, true), 6);
	for (var i = 0; i < partyCount; i++) {
		var mon = decodeSaveMon(bytes, partyBase + SAVE_PARTY_OFFSET + i * PARTY_MON_SIZE, true);
		if (mon) {
			mon.location = "Party " + (i + 1);
			result.party.push(mon);
		}
	}

	// The stream starts with the current box number (u32) before box 1.
	var boxAreas = [
		{bytes: readStorageStream(bytes, sections), offset: 4, firstBox: 1, count: STREAM_BOXES},
		{bytes: readRawBoxes(bytes), offset: 0, firstBox: STREAM_BOXES + 1, count: RAW_BOXES}
	];
	boxAreas.forEach(function (area) {
		for (var box = 0; box < area.count; box++) {
			for (var slot = 0; slot < BOX_SLOTS; slot++) {
				var boxed = decodeSaveMon(area.bytes, area.offset + (box * BOX_SLOTS + slot) * PC_MON_SIZE, false);
				if (boxed) {
					boxed.location = "Box " + (area.firstBox + box);
					result.boxes.push(boxed);
				}
			}
		}
	});
	return result;
}

// Default nicknames are the species name, cut to the game's 10-character limit.
function hasCustomNickname(mon) {
	var nickname = calc.toID(mon.nickname);
	var species = calc.SPECIES[gen][mon.species];
	var defaultNames = [mon.species, (species && species.baseSpecies) || mon.species];
	return !!nickname && !defaultNames.some(function (name) {
		return calc.toID(name).indexOf(nickname) === 0;
	});
}

// Set name shown in the set list: the nickname if it was changed, otherwise where the
// Pokémon is in the save. Made unique per species, and parentheses are removed because
// set ids are "Species (Set Name)".
function getSaveSetName(mon, setsForSpecies) {
	var base = (hasCustomNickname(mon) ? mon.nickname : mon.location).replace(/[()]/g, "");
	base = normalizeCalcText(base);
	var name = base;
	for (var n = 2; setsForSpecies[name]; n++) name = base + " " + n;
	return name;
}

function toCustomSet(mon) {
	return {
		level: mon.level,
		ability: mon.ability,
		nature: mon.nature,
		item: mon.item,
		evs: mon.evs,
		ivs: mon.ivs,
		moves: mon.moves,
		isCustomSet: true,
		// Marks sets that the next .sav import replaces.
		fromSave: true
	};
}

/*
 * Replaces the sets from any earlier .sav import in this mode with the save's current
 * contents. Sets imported as text are left alone. The party goes to the Team section;
 * boxed Pokémon go to the Box unless the user already moved that set to Box 2 or Trash.
 */
function importSaveIntoBox(save) {
	var customsets = readCustomSets();
	for (var pokemonName in customsets) {
		for (var setName in customsets[pokemonName]) {
			if (customsets[pokemonName][setName].fromSave) removeCustomSet(customsets, pokemonName, setName);
		}
	}

	var addSaveMons = function (mons) {
		return mons.map(function (mon) {
			var pokemonName = getSpeciesKey(mon.species);
			customsets[pokemonName] = customsets[pokemonName] || {};
			var setName = getSaveSetName(mon, customsets[pokemonName]);
			customsets[pokemonName][setName] = toCustomSet(mon);
			return getSetId(pokemonName, setName);
		});
	};
	var partyIds = addSaveMons(save.party);
	var boxIds = addSaveMons(save.boxes);
	var layout = readBoxLayout();
	var userPlaced = (layout.box2 || []).concat(layout.trash || []);
	moveSetsToSection(partyIds, "team");
	moveSetsToSection(boxIds.filter(function (id) {
		return userPlaced.indexOf(id) === -1;
	}), "box");
	updateDex(customsets);
	$(allPokemon("#importedSetsOptions")).css("display", "inline");
}

var SAVE_MODE_LABELS = {normal: "Normal Mode", hardcore: "Hardcore Mode"};
// Carries a parsed save to the other mode's page when the user chooses to switch.
var PENDING_SAVE_IMPORT_KEY = "pendingSaveImport";

function getSaveMode(save) {
	return save.hardcore ? "hardcore" : "normal";
}

function importSaveAndReport(save, fileName) {
	importSaveIntoBox(save);
	alert("Imported " + save.party.length + " party and " + save.boxes.length + " boxed Pok\u00e9mon from " + fileName + "." +
		"\nThis is a " + SAVE_MODE_LABELS[getSaveMode(save)] + " save, Minimal Grinding " + (save.minimalGrinding ? "on" : "off") + ".");
}

function importSaveInMode(save, fileName, mode) {
	try {
		sessionStorage.setItem(PENDING_SAVE_IMPORT_KEY, JSON.stringify({save: save, fileName: fileName}));
	} catch (e) {
		alert("Could not switch modes with the save loaded. Switch to " + SAVE_MODE_LABELS[mode] + " and import it there.");
		return;
	}
	navigateToMode(mode);
}

// Imports into this mode, or first asks to switch when the save belongs to another mode.
function importSave(save, fileName) {
	var saveMode = getSaveMode(save);
	if (saveMode === getPageMode()) {
		importSaveAndReport(save, fileName);
		return;
	}
	var modeLabel = SAVE_MODE_LABELS[saveMode];
	showChoiceDialog(
		"This is a " + modeLabel + " save",
		"Switch to " + modeLabel + " and import there?",
		[{
			label: "Switch to " + modeLabel,
			primary: true,
			action: function () {
				importSaveInMode(save, fileName, saveMode);
			}
		}, {
			label: "Import here anyway",
			action: function () {
				importSaveAndReport(save, fileName);
			}
		}]);
}

function handleSaveFile(file) {
	var reader = new FileReader();
	reader.onload = function () {
		var save = parseRadicalRedSave(new Uint8Array(reader.result));
		if (!save) {
			alert("Could not read " + file.name + ". Please choose a Pok\u00e9mon Radical Red 4.1 .sav file.");
			return;
		}
		importSave(save, file.name);
	};
	reader.readAsArrayBuffer(file);
}

// Finishes an import started on another mode's page (see importSaveInMode).
function importPendingSave() {
	var pending;
	try {
		pending = JSON.parse(sessionStorage.getItem(PENDING_SAVE_IMPORT_KEY));
		sessionStorage.removeItem(PENDING_SAVE_IMPORT_KEY);
	} catch (e) {
		return; // storage unavailable or unreadable: nothing to finish
	}
	if (pending) importSaveAndReport(pending.save, pending.fileName);
}

$(document).ready(function () {
	var fileInput = $('<input type="file" id="save-file-input" accept=".sav,.srm" class="visually-hidden" />');
	var button = $('<button type="button" id="import-save" class="bs-btn bs-btn-default" title="Load your party and PC boxes from a Radical Red .sav file">Import .sav</button>');
	button.click(function () {
		fileInput.click();
	});
	fileInput.change(function () {
		if (this.files[0]) handleSaveFile(this.files[0]);
		// Allow importing the same file again after the game has been saved.
		this.value = "";
	});
	$("#import-1_wrapper").append(button, fileInput);
	importPendingSave();
});
