/*
 * Imported sets ("custom sets") are the contents of the Team/Box panel. They are stored
 * per calculator mode under `customsets:<mode>` so that Normal and Hardcore keep separate
 * boxes. Older versions kept a single shared `customsets` key: a mode with nothing stored
 * yet starts from that legacy key, which is left untouched so every mode can inherit it.
 */
var LEGACY_CUSTOM_SETS_KEY = "customsets";

// The mode this page was served as. Read from the HTML attribute rather than the live
// `checked` property, which changes as soon as the user clicks another mode.
function getPageMode() {
	return $("input.mode[checked]").attr("id");
}

function getCustomSetsKey(mode) {
	return "customsets:" + (mode || getPageMode());
}

function readCustomSets(mode) {
	var stored = localStorage.getItem(getCustomSetsKey(mode));
	if (stored === null) stored = localStorage.getItem(LEGACY_CUSTOM_SETS_KEY);
	try {
		return stored ? JSON.parse(stored) : {};
	} catch (e) {
		return {};
	}
}

function writeCustomSets(customsets, mode) {
	localStorage.setItem(getCustomSetsKey(mode), JSON.stringify(customsets));
	$(document).trigger("customsets:changed");
}

function hasCustomSets(customsets) {
	return Object.keys(customsets).length > 0;
}

function placeBsBtn() {
	var importBtn = "<button id='import' class='bs-btn bs-btn-default'>Import</button>";
	$("#import-1_wrapper").append(importBtn);

	$("#import.bs-btn").click(function () {
		var pokes = document.getElementsByClassName("import-team-text")[0].value;
		var name = document.getElementsByClassName("import-name-text")[0].value.trim() === "" ? "Custom Set" : document.getElementsByClassName("import-name-text")[0].value;
		addSets(pokes, name);
	});
}

function ExportPokemon(pokeInfo) {
	var pokemon = createPokemon(pokeInfo);
	var EV_counter = 0;
	var finalText = "";
	finalText = pokemon.name + (pokemon.item ? " @ " + pokemon.item : "") + "\n";
	finalText += "Level: " + pokemon.level + "\n";
	finalText += pokemon.nature && gen > 2 ? pokemon.nature + " Nature" + "\n" : "";
	if (gen === 9) {
		var teraType = pokeInfo.find(".teraType").val();
		if (teraType !== undefined && teraType !== pokemon.types[0]) {
			finalText += "Tera Type: " + teraType + "\n";
		}
	}
	finalText += pokemon.ability ? "Ability: " + pokemon.ability + "\n" : "";
	if (gen > 2) {
		var EVs_Array = [];
		for (var stat in pokemon.evs) {
			var ev = pokemon.evs[stat] ? pokemon.evs[stat] : 0;
			if (ev > 0) {
				EVs_Array.push(ev + " " + calc.Stats.displayStat(stat));
			}
			EV_counter += ev;
			if (EV_counter > 510) break;
		}
		if (EVs_Array.length > 0) {
			finalText += "EVs: ";
			finalText += serialize(EVs_Array, " / ");
			finalText += "\n";
		}
	}

	var IVs_Array = [];
	for (var stat in pokemon.ivs) {
		var iv = pokemon.ivs[stat] ? pokemon.ivs[stat] : 0;
		if (iv < 31) {
			IVs_Array.push(iv + " " + calc.Stats.displayStat(stat));
		}
	}
	if (IVs_Array.length > 0) {
		finalText += "IVs: ";
		finalText += serialize(IVs_Array, " / ");
		finalText += "\n";
	}

	for (var i = 0; i < 4; i++) {
		var moveName = pokemon.moves[i].name;
		if (moveName !== "(No Move)") {
			finalText += "- " + moveName + "\n";
		}
	}
	finalText = normalizeExportText(finalText.trim());
	$("textarea.import-team-text").val(finalText);
}

$("#exportL").click(function () {
	ExportPokemon($("#p1"));
});

$("#exportR").click(function () {
	ExportPokemon($("#p2"));
});

function serialize(array, separator) {
	var text = "";
	for (var i = 0; i < array.length; i++) {
		if (i < array.length - 1) {
			text += array[i] + separator;
		} else {
			text += array[i];
		}
	}
	return text;
}

function normalizeUnicodeText(text, form) {
	if (text === undefined || text === null) return '';
	text = '' + text;
	return typeof text.normalize === 'function' ? text.normalize(form) : text;
}

function normalizeCalcText(text) {
	return normalizeUnicodeText(text, 'NFD');
}

function normalizeExportText(text) {
	return normalizeUnicodeText(text, 'NFC');
}

function getSpeciesKey(speciesName) {
	var normalizedName = normalizeCalcText(speciesName.trim());
	if (calc.SPECIES[9][normalizedName] !== undefined) return normalizedName;
	if (calc.SPECIES[9][speciesName.trim()] !== undefined) return speciesName.trim();
	return normalizedName;
}

function getAbility(row) {
	var ability = row[1] ? row[1].trim() : '';
	if (calc.ABILITIES[9].indexOf(ability) !== -1) return ability;
}

function getTeraType(row) {
	var teraType = row[1] ? row[1].trim() : '';
	if (Object.keys(calc.TYPE_CHART[9]).slice(1).indexOf(teraType) !== -1) return teraType;
}

function statToLegacyStat(stat) {
	switch (stat) {
	case 'hp':
		return "hp";
	case 'atk':
		return "at";
	case 'def':
		return "df";
	case 'spa':
		return "sa";
	case 'spd':
		return "sd";
	case 'spe':
		return "sp";
	}
}

function getStats(currentPoke, rows, offset) {
	currentPoke.nature = "Serious";
	var currentEV;
	var currentIV;
	var currentAbility;
	var currentTeraType;
	var currentNature;
	currentPoke.level = 100;
	for (var x = offset; x < offset + 9; x++) {
		var currentRow = rows[x] ? rows[x].split(/[/:]/) : '';
		var evs = {};
		var ivs = {};
		var ev;
		var j;

		switch (currentRow[0]) {
		case 'Level':
			currentPoke.level = parseInt(currentRow[1].trim());
			break;
		case 'EVs':
			for (j = 1; j < currentRow.length; j++) {
				currentEV = currentRow[j].trim().split(" ");
				currentEV[1] = statToLegacyStat(currentEV[1].toLowerCase());
				evs[currentEV[1]] = parseInt(currentEV[0]);
			}
			currentPoke.evs = evs;
			break;
		case 'IVs':
			for (j = 1; j < currentRow.length; j++) {
				currentIV = currentRow[j].trim().split(" ");
				currentIV[1] = statToLegacyStat(currentIV[1].toLowerCase());
				ivs[currentIV[1]] = parseInt(currentIV[0]);
			}
			currentPoke.ivs = ivs;
			break;

		}
		currentAbility = rows[x] ? rows[x].trim().split(":") : '';
		if (currentAbility[0] == "Ability") {
			currentPoke.ability = currentAbility[1].trim();
		}

		currentTeraType = rows[x] ? rows[x].trim().split(":") : '';
		if (currentTeraType[0] == "Tera Type") {
			currentPoke.teraType = currentTeraType[1].trim();
		}

		currentNature = rows[x] ? rows[x].trim().split(" ") : '';
		if (currentNature[1] == "Nature") {
			currentPoke.nature = currentNature[0];
		}
	}
	return currentPoke;
}

function getItem(currentRow, j) {
	for (;j < currentRow.length; j++) {
		var item = currentRow[j].trim();
		if (calc.ITEMS[9].indexOf(item) != -1) {
			return item;
		}
	}
}

function getMoves(currentPoke, rows, offset) {
	var movesFound = false;
	var moves = [];
	for (var x = offset; x < offset + 12; x++) {
		if (rows[x]) {
			if (rows[x][0] == "-") {
				movesFound = true;
				var move = rows[x].substr(2, rows[x].length - 2).replace("[", "").replace("]", "").replace("  ", "");
				moves.push(move);
			} else {
				if (movesFound == true) {
					break;
				}
			}
		}
	}
	currentPoke.moves = moves;
	return currentPoke;
}

// Adds one parsed set to `customsets` (call updateDex afterwards to save and show it).
function addToDex(poke, customsets) {
	poke.name = getSpeciesKey(poke.name);
	poke.nameProp = normalizeCalcText(poke.nameProp);
	var dexObject = {
		level: poke.level,
		evs: poke.evs,
		ivs: poke.ivs,
		moves: poke.moves,
		nature: poke.nature,
		item: poke.item,
		isCustomSet: poke.isCustomSet
	};
	if (poke.ability !== undefined) dexObject.ability = poke.ability;
	if (poke.teraType !== undefined) dexObject.teraType = poke.teraType;
	customsets[poke.name] = customsets[poke.name] || {};
	customsets[poke.name][poke.nameProp] = dexObject;
	if (poke.name === "Aegislash-Blade") {
		customsets["Aegislash-Shield"] = customsets["Aegislash-Shield"] || {};
		customsets["Aegislash-Shield"][poke.nameProp] = dexObject;
	}
}

// Every generation's set list; imported sets are added to all of them.
function getAllSetdexes() {
	return [SETDEX_SV, SETDEX_SS, SETDEX_SM, SETDEX_XY, SETDEX_BW, SETDEX_DPP, SETDEX_ADV, SETDEX_GSC, SETDEX_RBY];
}

function updateDex(customsets) {
	var normalizedCustomsets = {};
	var setdexes = getAllSetdexes();
	for (var pokemon in customsets) {
		var pokemonName = getSpeciesKey(pokemon);
		if (!normalizedCustomsets[pokemonName]) normalizedCustomsets[pokemonName] = {};
		for (var moveset in customsets[pokemon]) {
			var setName = normalizeCalcText(moveset);
			normalizedCustomsets[pokemonName][setName] = customsets[pokemon][moveset];
			for (var i = 0; i < setdexes.length; i++) {
				if (!setdexes[i][pokemonName]) setdexes[i][pokemonName] = {};
				setdexes[i][pokemonName][setName] = customsets[pokemon][moveset];
			}
		}
	}
	writeCustomSets(normalizedCustomsets);
}

// Removes a set from the in-memory set lists (not from storage).
function removeFromDex(pokemonName, setName) {
	getAllSetdexes().forEach(function (setdex) {
		if (setdex[pokemonName]) delete setdex[pokemonName][setName];
	});
}

// Set ids, as used by the set selector and the box, are "Species (Set Name)".
function getSetId(pokemonName, setName) {
	return pokemonName + " (" + setName + ")";
}

// Splits a set id such as "Garchomp (Custom Set)" into its species and set name.
function splitSetId(setId) {
	var open = setId.indexOf(" (");
	return {pokemonName: setId.substring(0, open), setName: setId.substring(open + 2, setId.lastIndexOf(")"))};
}

// Removes one set from a custom set object and from the in-memory set lists.
function removeCustomSet(customsets, pokemonName, setName) {
	// addToDex mirrors Aegislash-Blade sets onto Aegislash-Shield, so remove both.
	var names = pokemonName === "Aegislash-Blade" ? [pokemonName, "Aegislash-Shield"] : [pokemonName];
	names.forEach(function (name) {
		if (!customsets[name]) return;
		delete customsets[name][setName];
		removeFromDex(name, setName);
		if (!Object.keys(customsets[name]).length) delete customsets[name];
	});
}

// Permanently deletes the given sets ("Species (Set Name)" ids) from this mode.
function deleteCustomSets(setIds) {
	var customsets = readCustomSets();
	setIds.forEach(function (setId) {
		var set = splitSetId(setId);
		removeCustomSet(customsets, set.pokemonName, set.setName);
	});
	writeCustomSets(customsets);
	if (!hasCustomSets(customsets)) $(allPokemon("#importedSetsOptions")).hide();
}

// Deletes every custom set in this mode, after asking.
function confirmClearCustomSets() {
	if (!confirm("Are you sure you want to delete your custom sets for this mode? This empties your Team/Box and cannot be undone.")) {
		return;
	}
	var customsets = readCustomSets();
	var allIds = [];
	for (var pokemonName in customsets) {
		for (var setName in customsets[pokemonName]) allIds.push(getSetId(pokemonName, setName));
	}
	// Writes an empty set list rather than removing the key, so this mode does not fall
	// back to the legacy shared sets on the next load.
	deleteCustomSets(allIds);
	loadDefaultLists();
}

function addSets(pokes, name) {
	var rows = pokes.split("\n");
	name = normalizeCalcText(name);
	var currentRow;
	var currentPoke;
	var addedpokes = 0;
	var customsets = readCustomSets();
	for (var i = 0; i < rows.length; i++) {
		currentRow = rows[i].split(/[()@]/);
		for (var j = 0; j < currentRow.length; j++) {
			currentRow[j] = getSpeciesKey(checkExeptions(currentRow[j].trim()));
			if (calc.SPECIES[9][currentRow[j]] !== undefined) {
				currentPoke = {name: currentRow[j]};
				currentPoke.item = getItem(currentRow, j + 1);
				if (j === 1 && currentRow[0].trim()) {
					currentPoke.nameProp = normalizeCalcText(currentRow[0].trim());
				} else {
					currentPoke.nameProp = name;
				}
				currentPoke.isCustomSet = true;
				currentPoke.ability = getAbility(rows[i + 1].split(":"));
				currentPoke.teraType = getTeraType(rows[i + 1].split(":"));
				currentPoke = getStats(currentPoke, rows, i + 1);
				currentPoke = getMoves(currentPoke, rows, i);
				addToDex(currentPoke, customsets);
				addedpokes++;
			}
		}
	}
	if (addedpokes > 0) {
		// Saved once for the whole import, which also redraws the box once.
		updateDex(customsets);
		alert("Successfully imported " + addedpokes + " set(s)");
		$(allPokemon("#importedSetsOptions")).css("display", "inline");
	} else {
		alert("No sets imported, please check your syntax and try again");
	}
}

function checkExeptions(poke) {
	switch (poke) {
	case 'Aegislash':
		poke = "Aegislash-Blade";
		break;
	case 'Basculin-Blue-Striped':
		poke = "Basculin";
		break;
	case 'Gastrodon-East':
		poke = "Gastrodon";
		break;
	case 'Mimikyu-Busted-Totem':
		poke = "Mimikyu-Totem";
		break;
	case 'Mimikyu-Busted':
		poke = "Mimikyu";
		break;
	case 'Pikachu-Belle':
	case 'Pikachu-Cosplay':
	case 'Pikachu-Libre':
	case 'Pikachu-Original':
	case 'Pikachu-Partner':
	case 'Pikachu-PhD':
	case 'Pikachu-Pop-Star':
	case 'Pikachu-Rock-Star':
		poke = "Pikachu";
		break;
	case 'Vivillon-Fancy':
	case 'Vivillon-Pokeball':
		poke = "Vivillon";
		break;
	case 'Florges-White':
	case 'Florges-Blue':
	case 'Florges-Orange':
	case 'Florges-Yellow':
		poke = "Florges";
		break;
	case 'Shellos-East':
		poke = "Shellos";
		break;
	case 'Deerling-Summer':
	case 'Deerling-Autumn':
	case 'Deerling-Winter':
		poke = "Deerling";
		break;
	}
	return poke;

}

$(allPokemon("#clearSets")).click(confirmClearCustomSets);

$(allPokemon("#importedSets")).click(function () {
	var pokeID = $(this).parent().parent().prop("id");
	var showCustomSets = $(this).prop("checked");
	if (showCustomSets) {
		loadCustomList(pokeID);
	} else {
		loadDefaultLists();
	}
});

$(document).ready(function () {
	var customSets = readCustomSets();
	placeBsBtn();
	if (hasCustomSets(customSets)) {
		updateDex(customSets);
		$(allPokemon("#importedSetsOptions")).css("display", "inline");
	} else {
		loadDefaultLists();
	}
});
