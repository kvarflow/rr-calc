'use strict';
/*
 * Resolves Pokémon Radical Red names to the calc's spelling, for the import scripts.
 *
 * Names from the ROM are cut to fit the game's text boxes ("Charzardite X", "Drain Kiss",
 * "ThermalExchange") and the boss documents abbreviate or misspell some ("Disarm. Voice",
 * "Eathquake"). Names are compared on letters and digits only, then through the aliases
 * below, then (for documents) as abbreviations where a word ending in "." is a prefix.
 */

const calc = require('../calc/dist/index.js');

const MOVE_ALIASES = {
	'Disarm Cry': 'Disarming Voice',
	'Drain Kiss': 'Draining Kiss',
	'Soupercell Slam': 'Supercell Slam',
	'Sunsteel Ram': 'Sunsteel Strike',
	// Spellings in the boss documents.
	'Pow-Up Punch': 'Power-Up Punch',
	'Eathquake': 'Earthquake',
};
const ITEM_ALIASES = {
	'Charzardite X': 'Charizardite X',
	'Charzardite Y': 'Charizardite Y',
	'Blastoisnite': 'Blastoisinite',
	'Kangaskanite': 'Kangaskhanite',
	'Aerodactlite': 'Aerodactylite',
	'Houndoomnite': 'Houndoominite',
	'Applite': 'Appletunite',
	'Electr Memory': 'Electric Memory',
	'Necrozium Z': 'Ultranecrozium Z',
	'Alorichium Z': 'Aloraichium Z',
	'Mimikium Z Z': 'Mimikium Z',
	'Pikshunium Z': 'Pikashunium Z',
	'Adrenal Orb': 'Adrenaline Orb',
	'Rusty Sword': 'Rusted Sword',
	'Rusty Shield': 'Rusted Shield',
	'Duraludite': 'Duraludonite',
	'Boost Energy': 'Booster Energy',
	'Punch Glove': 'Punching Glove',
	'Safe Goggles': 'Safety Goggles',
	'Protect Pads': 'Protective Pads',
	'Eter.Max Orb': 'Eternamax Orb',
	// The game's Leek is the old Stick item; the calc only boosts crits for "Leek".
	'Leek Stick': 'Leek',
};
const ABILITY_ALIASES = {
	'Neutralize Gas': 'Neutralizing Gas',
	'Wandering Soul': 'Wandering Spirit',
	'Electromrphosis': 'Electromorphosis',
	'Alchemic Power': 'Power of Alchemy',
	// Spellings in the boss documents.
	'Comotose': 'Comatose',
	'Swords of Ruin': 'Sword of Ruin',
};
// "As One" is two different abilities in the calc, one per Calyrex forme.
const AS_ONE_BY_SPECIES = {
	'Calyrex-Ice': 'As One (Glastrier)',
	'Calyrex-Shadow': 'As One (Spectrier)',
};

function toKey(name) {
	return calc.toID(String(name).normalize('NFD').replace(/[̀-ͯ]/g, ''));
}

function indexByKey(names) {
	const index = {};
	names.forEach(name => { index[toKey(name)] = name; });
	return index;
}

const MOVE_NAMES = Object.keys(calc.MOVES[9]);
const ITEM_NAMES = calc.ITEMS[9];
const ABILITY_NAMES = calc.ABILITIES[9];
const SPECIES_NAMES = Object.keys(calc.SPECIES[9]);
const INDEXES = {
	move: indexByKey(MOVE_NAMES),
	item: indexByKey(ITEM_NAMES),
	ability: indexByKey(ABILITY_NAMES),
	species: indexByKey(SPECIES_NAMES),
};
const LISTS = {move: MOVE_NAMES, item: ITEM_NAMES, ability: ABILITY_NAMES, species: SPECIES_NAMES};
const ALIASES = {move: MOVE_ALIASES, item: ITEM_ALIASES, ability: ABILITY_ALIASES, species: {}};

// The calc's spelling of a move, item, ability or species name, or null if it has none.
function resolve(kind, name, species) {
	if (!name) return null;
	name = String(name).trim().replace(/^HP (\w+)$/, 'Hidden Power $1');
	if (kind === 'ability' && name === 'As One') return AS_ONE_BY_SPECIES[species] || null;
	const index = INDEXES[kind];
	const direct = index[toKey(ALIASES[kind][name] || name)];
	if (direct) return direct;
	// Document abbreviations: "Disarm. Voice" -> "Disarming Voice".
	const words = name.split(/\s+/);
	if (!words.some(w => w.endsWith('.'))) return null;
	const matches = LISTS[kind].filter(n => {
		const nameWords = n.split(/\s+/);
		return nameWords.length === words.length && words.every((w, i) =>
			w.endsWith('.') ? toKey(nameWords[i]).startsWith(toKey(w)) : toKey(nameWords[i]) === toKey(w));
	});
	return matches.length === 1 ? matches[0] : null;
}

module.exports = {calc, toKey, resolve, MOVE_NAMES, ITEM_NAMES, ABILITY_NAMES};
