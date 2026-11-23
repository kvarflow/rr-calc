/*
 * Pokémon genders as the game works them out (POKEMON_GENDERS, generated from the ROM by rr-rom's
 * analysis/progression/genders.js), so Rivalry, Attract and Captivate go as they will in the game:
 *  - a trainer's Pokémon: from the personality the game gives that slot of its party (the trainer's
 *    class and gender, its name's length, the slot), which a boss's set nature keeps;
 *  - yours, from a .sav: from its personality value (the set's pid).
 * A species' gender ratio of 0 is always male, 254 always female, 255 genderless; else it is female
 * when the personality's low byte is below the ratio.
 */
var GENDER_RATIO_BY_SPECIES = null;

function getGenderRatio(speciesName) {
	if (typeof POKEMON_GENDERS === "undefined") return null;
	if (!GENDER_RATIO_BY_SPECIES) {
		GENDER_RATIO_BY_SPECIES = {};
		Object.keys(POKEMON_GENDERS.ratios).forEach(function (ratio) {
			POKEMON_GENDERS.ratios[ratio].forEach(function (name) {
				GENDER_RATIO_BY_SPECIES[name] = parseInt(ratio);
			});
		});
	}
	var ratio = GENDER_RATIO_BY_SPECIES[speciesName];
	if (ratio === undefined && pokedex[speciesName] && pokedex[speciesName].baseSpecies) {
		ratio = GENDER_RATIO_BY_SPECIES[pokedex[speciesName].baseSpecies];
	}
	return ratio === undefined ? 127 : ratio;
}

// "M", "F" or "N" (genderless) for a species and the low byte of a personality value.
function getGenderFromPersonality(speciesName, personality) {
	var ratio = getGenderRatio(speciesName);
	if (ratio === null) return null;
	if (ratio === 255) return "N";
	if (ratio === 254) return "F";
	if (ratio === 0) return "M";
	return (personality & 0xFF) < ratio ? "F" : "M";
}

function getBaseSpeciesName(name) {
	return (pokedex[name] && pokedex[name].baseSpecies) || name;
}

// A trainer's Pokémon: its slot in the fight using this set (the current one first), matched by
// species to the game's party (bosses' teams are listed in the document's order).
function getTrainerSetGender(pokemonName, setName) {
	if (typeof POKEMON_GENDERS === "undefined" || typeof TRAINER_ORDER === "undefined") return null;
	var fullName = pokemonName + " (" + setName + ")";
	var trainers = TRAINER_ORDER.slice();
	if (typeof currentTrainerIndex === "number" && TRAINER_ORDER[currentTrainerIndex]) trainers.unshift(TRAINER_ORDER[currentTrainerIndex]);
	for (var t = 0; t < trainers.length; t++) {
		var variants = trainers[t].variants || [];
		for (var v = 0; v < variants.length; v++) {
			var variant = variants[v];
			var slot = variant.sets.indexOf(fullName);
			if (slot === -1 || !variant.trainerIds || !variant.trainerIds.length) continue;
			// The same species earlier in the team: this is the next one of it.
			var repeat = variant.sets.slice(0, slot).filter(function (id) {
				return getBaseSpeciesName(id.substring(0, id.indexOf(" ("))) === getBaseSpeciesName(pokemonName);
			}).length;
			for (var k = 0; k < variant.trainerIds.length; k++) {
				var party = POKEMON_GENDERS.trainers[variant.trainerIds[k]] || [];
				for (var p = 0, seen = 0; p < party.length; p += 2) {
					if (getBaseSpeciesName(party[p]) !== getBaseSpeciesName(pokemonName)) continue;
					if (seen++ === repeat) return getGenderFromPersonality(pokemonName, party[p + 1]);
				}
			}
			// Not in the game's party by that species (it evolves with the level cap): by its place.
			var first = POKEMON_GENDERS.trainers[variant.trainerIds[0]] || [];
			if (first[slot * 2 + 1] !== undefined) return getGenderFromPersonality(pokemonName, first[slot * 2 + 1]);
		}
	}
	return null;
}

// The gender a set has in the game, or null when the calc can't tell.
function getKnownGender(pokemonName, setName, set) {
	if (set && set.gender) return set.gender;
	if (set && typeof set.pid === "number") return getGenderFromPersonality(pokemonName, set.pid);
	if (set && set.isCustomSet) return null;
	return getTrainerSetGender(pokemonName, setName);
}

// The gender select's value for it ("" for genderless), or null.
function getKnownGenderOption(pokemonName, setName, set) {
	var gender = getKnownGender(pokemonName, setName, set);
	return gender === "F" ? "Female" : gender === "M" ? "Male" : gender === "N" ? "" : null;
}
