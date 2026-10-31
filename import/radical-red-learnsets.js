#!/usr/bin/env node
'use strict';
/*
 * Generates src/js/data/learnsets/radicalred.js for the Dex (dex.js): each Pokémon's level-up, TM,
 * tutor and egg moves, and how it evolves.
 *
 * Usage (after `node build` so calc/dist exists):
 *   node import/radical-red-learnsets.js <Pokémon Radical Red 4.1 ROM>
 *
 * Radical Red keeps a pointer to each species' learnset in a table at 0x0980175C (by species id,
 * the ids radical_red_save_data.js names); each learnset is 3-byte entries (u16 move id, u8 level)
 * ended by level 0xFF. The same table gives route trainers their moves (rr-rom's
 * analysis/progression/route_trainers.js).
 *
 * Evolutions come from CFRU's gEvolutionTable, repointed to 0x097CD9B0 (as the encounters importer
 * reads it): 16 entries a species id of {u16 method, u16 parameter, u16 target, u16 extra}. The
 * methods are CFRU's (include/constants/pokemon.h), checked against the evolutions they give here.
 *
 * What each move does, for tapping a move in the Dex: the game's own descriptions (FireRed's
 * gMoveDescriptionPointers, repointed to 0x0903DF74 and grown: a pointer for each move id from
 * Pound, 1) and its move data (gBattleMoves, repointed to 0x091521D0: 12 bytes a move id of
 * {effect, power, type, accuracy, PP, effect chance, target, priority, ...}).
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const {resolve} = require('./rom-names');

const OUTPUT = path.resolve(__dirname, '../src/js/data/learnsets/radicalred.js');
const ROM_BASE = 0x08000000;
const LEARNSETS = 0x0980175C;
const EVOLUTIONS = 0x097CD9B0;
const EVOLUTIONS_PER_SPECIES = 16;
const MOVE_DESCRIPTIONS = 0x0903DF74;
// CFRU reads these through pointers at fixed addresses (its src/item.c and include/new/item.h):
// the TM/HM moves (u16 a TM, TM01-TM120 then HM01-HM08), the tutor moves, and for each species
// id a 16-byte bit field of which TMs/HMs, and of which tutor moves, it can learn (bit i: byte
// i >> 3, bit i & 7).
const TM_MOVES_POINTER = 0x08125A8C;
const TUTOR_MOVES_POINTER = 0x08120BE4;
const TM_LEARNSETS_POINTER = 0x08043C68;
const TUTOR_LEARNSETS_POINTER = 0x08120C30;
const TMS = 120;
const HMS = 8;
const TUTORS = 128;
const BITS_SIZE = 16;
// FireRed's gEggMoves, repointed and grown to 0x097CB0E4 (GetEggMoves loads it): u16s, a species
// as 20000 + its id followed by its egg moves, ended by 0xFFFF.
const EGG_MOVES = 0x097CB0E4;
const EGG_SPECIES_OFFSET = 20000;
const BATTLE_MOVES = 0x091521D0;
const BATTLE_MOVE_SIZE = 12;
// CFRU's type ids (Fairy after the "???" gap).
const TYPES = {0: 'Normal', 1: 'Fighting', 2: 'Flying', 3: 'Poison', 4: 'Ground', 5: 'Rock', 6: 'Bug', 7: 'Ghost',
	8: 'Steel', 10: 'Fire', 11: 'Water', 12: 'Grass', 13: 'Electric', 14: 'Psychic', 15: 'Ice', 16: 'Dragon', 17: 'Dark',
	23: 'Fairy'};
const hour = h => String(h).padStart(2, '0') + ':00';

// The game's own item names (the save data names only items a Pokémon can hold): its item table is
// FireRed's layout, 0x2C bytes an item starting with a 14-byte name, moved and grown by the hack (the
// last table whose item 1 is "Master Ball", as import/radical-red-item-descriptions.js finds it).
const ITEM_SIZE = 0x2C;
const TEXT = {0x00: ' ', 0x1B: 'é', 0x2D: '&', 0x2E: '+', 0x35: '=', 0x36: ';', 0x5B: '%', 0x5C: '(', 0x5D: ')',
	0xAB: '!', 0xAC: '?', 0xAD: '.', 0xAE: '-', 0xB0: '…', 0xB1: '“', 0xB2: '”', 0xB3: '‘', 0xB4: '’', 0xB5: '♂',
	0xB6: '♀', 0xB8: ',', 0xBA: '/', 0xF0: ':', 0xFE: '\n'};
for (let i = 0; i < 26; i++) {
	TEXT[0xBB + i] = String.fromCharCode(65 + i);
	TEXT[0xD5 + i] = String.fromCharCode(97 + i);
}
for (let i = 0; i < 10; i++) TEXT[0xA1 + i] = String(i);
const CODES = Object.fromEntries(Object.entries(TEXT).map(([code, char]) => [char, +code]));
let itemTable = null;

function romItemName(rom, id) {
	if (itemTable === null) itemTable = rom.lastIndexOf(Buffer.from([...'Master Ball'].map(c => CODES[c]).concat(0xFF))) - ITEM_SIZE;
	let name = '';
	for (let i = 0; i < 14; i++) {
		const b = rom[itemTable + id * ITEM_SIZE + i];
		if (b === 0xFF) break;
		name += TEXT[b] !== undefined ? TEXT[b] : '';
	}
	return resolve('item', name) || name;
}

function romText(rom, at, max) {
	let text = '';
	for (let i = 0; i < max && at + i < rom.length && rom[at + i] !== 0xFF; i++) {
		text += TEXT[rom[at + i]] !== undefined ? TEXT[rom[at + i]] : '';
	}
	// The game's line breaks: a word split over two lines ("40-\nHP", "in-\nflict") joins up again,
	// with its hyphen marked as a line break's until unhyphenate() decides whether to keep it.
	return text.replace(/-\n/g, LINE_HYPHEN).replace(/\s+/g, ' ').trim();
}

const LINE_HYPHEN = '\u00AD';

// Words the texts split over two lines but never write whole.
const WHOLE_WORDS = ['chlorophyll', 'disaster', 'flowers', 'frightful', 'waterfalls'];

// A hyphen at a line break stays if it is part of the word ("critical-hit"), and goes if the word
// is written whole somewhere else in the texts ("inflict").
function unhyphenate(texts) {
	const words = new Set((WHOLE_WORDS.join(' ') + ' ' + texts.join(' ')).replace(new RegExp(LINE_HYPHEN, 'g'), ' ').toLowerCase().split(/[^a-z\u00e9]+/));
	return texts.map(text => text.replace(new RegExp('([A-Za-z\u00e9]*)' + LINE_HYPHEN + '([A-Za-z\u00e9]*)', 'g'),
		(all, a, b) => a && b && words.has((a + b).toLowerCase()) ? a + b : a + '-' + b));
}

// [description, accuracy (0: never misses), PP, priority, effect chance %] for a move id.
function romMoveInfo(rom, id) {
	const pointer = rom.readUInt32LE(MOVE_DESCRIPTIONS - ROM_BASE + (id - 1) * 4);
	const description = pointer >= ROM_BASE && pointer < ROM_BASE + rom.length ? romText(rom, pointer - ROM_BASE, 400) : '';
	const at = BATTLE_MOVES - ROM_BASE + id * BATTLE_MOVE_SIZE;
	return [description, rom[at + 3], rom[at + 4], rom.readInt8(at + 7), rom[at + 5]];
}

// How a method reads, given its parameter, extra value and names for items, moves and species.
function describeEvolution(method, param, extra, names) {
	switch (method) {
	case 1: return 'High friendship';
	case 2: return 'High friendship by day';
	case 3: return 'High friendship at night';
	case 4: return 'Level ' + param;
	case 5: return 'Trade';
	case 6: return 'Trade holding ' + names.item(param);
	case 7: return 'Use ' + names.item(param);
	case 8: return 'Level ' + param + ' with Attack higher than Defense';
	case 9: return 'Level ' + param + ' with Attack equal to Defense';
	case 10: return 'Level ' + param + ' with Attack lower than Defense';
	case 11: case 12: return 'Level ' + param + ' (by personality)';
	case 13: return 'Level ' + param;
	case 14: return 'Level ' + param + ' with a free party slot and a Pok\u00e9 Ball';
	case 15: return 'High beauty';
	case 16: return 'Level ' + param + ' in rain or fog';
	case 17: return 'Level up knowing a ' + TYPES[param] + '-type move';
	case 18: return 'Level ' + param + ' with a ' + TYPES[extra] + '-type Pok\u00e9mon in the party';
	case 20: return 'Level ' + param + ' (male)';
	case 21: return 'Level ' + param + ' (female)';
	case 22: return 'Level ' + param + ' at night';
	case 23: return 'Level ' + param + ' by day';
	case 26: return 'Level up knowing ' + names.move(param);
	case 27: return 'Level up with ' + names.species(param) + ' in the party';
	case 28: return 'Level ' + param + ' from ' + hour(extra >> 8) + ' to ' + hour(extra & 0xFF);
	case 30: return 'Level ' + param + ' with an Amped nature';
	case 31: return 'Level ' + param + ' with a Low Key nature';
	case 0xFE: return 'Mega Evolves holding ' + names.item(param);
	default: return null;
	}
}

function loadSaveData() {
	const context = {};
	vm.createContext(context);
	vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../src/js/data/radical_red_save_data.js'), 'utf8') +
		';this.data = RADICAL_RED_SAVE_DATA;', context);
	return context.data;
}

function main() {
	const rom = fs.readFileSync(process.argv[2]);
	const data = loadSaveData();
	const learnsets = {};
	const moveInfo = {};
	let unresolved = 0;
	data.species.forEach((species, id) => {
		if (!species || learnsets[species]) return;
		const pointer = rom.readUInt32LE(LEARNSETS - ROM_BASE + id * 4);
		if (pointer < ROM_BASE || pointer >= ROM_BASE + rom.length) return;
		const moves = [];
		for (let at = pointer - ROM_BASE; at + 3 <= rom.length; at += 3) {
			const level = rom[at + 2];
			if (level === 0xFF) break;
			const moveId = rom.readUInt16LE(at);
			const name = resolve('move', data.moves[moveId]) || data.moves[moveId];
			if (!name) {
				unresolved++;
				continue;
			}
			moves.push([level, name]);
			if (!moveInfo[name]) moveInfo[name] = romMoveInfo(rom, moveId);
		}
		if (moves.length) learnsets[species] = moves;
	});
	const moveName = id => resolve('move', data.moves[id]) || data.moves[id] || '';
	const describe = (id, name) => {
		if (name && !moveInfo[name]) moveInfo[name] = romMoveInfo(rom, id);
	};
	// TMs, HMs and tutor moves: the moves, then each species' bit field as hex.
	const pointer = address => rom.readUInt32LE(address - ROM_BASE) - ROM_BASE;
	const moveList = (address, count) => Array.from({length: count}, (_, i) => rom.readUInt16LE(pointer(address) + i * 2));
	const tmIds = moveList(TM_MOVES_POINTER, TMS + HMS);
	const tutorIds = moveList(TUTOR_MOVES_POINTER, TUTORS);
	const tmMoves = tmIds.map(moveName);
	const tutorMoves = tutorIds.map(moveName);
	tmIds.forEach((id, i) => describe(id, tmMoves[i]));
	tutorIds.forEach((id, i) => describe(id, tutorMoves[i]));
	const bitFields = (address, count) => {
		const fields = {};
		data.species.forEach((species, id) => {
			if (!species || fields[species] !== undefined) return;
			const bytes = rom.subarray(pointer(address) + id * BITS_SIZE, pointer(address) + (id + 1) * BITS_SIZE);
			// (Bits past the last move are left out.)
			const hex = Buffer.from(bytes.map((b, k) => k * 8 + 8 > count ? b & ((1 << Math.max(0, count - k * 8)) - 1) : b)).toString('hex');
			if (/[^0]/.test(hex)) fields[species] = hex.replace(/(00)+$/, '');
		});
		return fields;
	};
	const tms = bitFields(TM_LEARNSETS_POINTER, TMS + HMS);
	const tutors = bitFields(TUTOR_LEARNSETS_POINTER, TUTORS);
	// Egg moves, by the species that hatches.
	const eggMoves = {};
	for (let at = EGG_MOVES - ROM_BASE, species = null; at + 2 <= rom.length; at += 2) {
		const value = rom.readUInt16LE(at);
		if (value === 0xFFFF) break;
		if (value > EGG_SPECIES_OFFSET) {
			species = data.species[value - EGG_SPECIES_OFFSET] || null;
			if (species && !eggMoves[species]) eggMoves[species] = [];
			else species = null; // a forme's own entry after the first: the Dex shows one list a name
		} else if (species) {
			const name = moveName(value);
			if (name && eggMoves[species].indexOf(name) === -1) eggMoves[species].push(name);
			describe(value, name);
		}
	}
	const names = {
		item: id => resolve('item', data.items[id]) || data.items[id] || romItemName(rom, id) || 'an item',
		move: id => resolve('move', data.moves[id]) || data.moves[id] || 'a move',
		species: id => data.species[id] || 'another Pok\u00e9mon',
	};
	// {species: [[into, how]]}, each once (a species' formes can share a name: Burmy's cloaks).
	const evolutions = {};
	const unknown = new Set();
	data.species.forEach((species, id) => {
		if (!species) return;
		for (let k = 0; k < EVOLUTIONS_PER_SPECIES; k++) {
			const at = EVOLUTIONS - ROM_BASE + (id * EVOLUTIONS_PER_SPECIES + k) * 8;
			const method = rom.readUInt16LE(at);
			const into = data.species[rom.readUInt16LE(at + 4)];
			// (A Mega's entry back to its base form, with no item, is not an evolution.)
			if (!method || !into || into === species || (method === 0xFE && !rom.readUInt16LE(at + 2))) continue;
			const how = describeEvolution(method, rom.readUInt16LE(at + 2), rom.readUInt16LE(at + 6), names);
			if (!how) {
				unknown.add(method);
				continue;
			}
			// Two ways to the same Pokémon (Onix: Metal Coat, or a trade holding it) on one line.
			const list = evolutions[species] = evolutions[species] || [];
			const same = list.find(e => e[0] === into);
			if (!same) list.push([into, how]);
			else if (same[1].split(' or ').indexOf(how) === -1) same[1] += ' or ' + how.charAt(0).toLowerCase() + how.slice(1);
		}
	});
	const descriptions = unhyphenate(Object.keys(moveInfo).map(name => moveInfo[name][0]));
	Object.keys(moveInfo).forEach((name, i) => { moveInfo[name][0] = descriptions[i]; });
	fs.writeFileSync(OUTPUT,
		'/* For the Dex, read from the Radical Red 4.1 ROM by import/radical-red-learnsets.js; do not edit by\n' +
		' * hand. Loaded when the Dex opens. LEARNSETS: each Pokémon\'s level-up moves as [level, move]\n' +
		' * (level 0: on evolving). EVOLUTIONS: what each evolves into and how, as [species, how].\n' +
		' * TM_MOVES: TM01-TM120 then HM01-HM08; TUTOR_MOVES: the move tutors\' moves. TMS and TUTORS:\n' +
		' * which of those each Pokémon learns, as hex bytes (move i: byte i >> 3, bit i & 7). EGG_MOVES:\n' +
		' * each first-stage Pokémon\'s egg moves. MOVE_INFO: each of those moves\' description, accuracy\n' +
		' * (0: never misses), PP, priority and effect chance (%), as the game has them. */\n' +
		'var LEARNSETS = ' + JSON.stringify(learnsets) + ';\n' +
		'var EVOLUTIONS = ' + JSON.stringify(evolutions) + ';\n' +
		'var TM_MOVES = ' + JSON.stringify(tmMoves) + ';\n' +
		'var TUTOR_MOVES = ' + JSON.stringify(tutorMoves) + ';\n' +
		'var TMS = ' + JSON.stringify(tms) + ';\n' +
		'var TUTORS = ' + JSON.stringify(tutors) + ';\n' +
		'var EGG_MOVES = ' + JSON.stringify(eggMoves) + ';\n' +
		'var MOVE_INFO = ' + JSON.stringify(moveInfo) + ';\n');
	console.log(`${Object.keys(learnsets).length} learnsets, ${Object.keys(evolutions).length} Pokémon that evolve, ` +
		`${Object.keys(tms).length} with TMs, ${Object.keys(tutors).length} with tutor moves, ` +
		`${Object.keys(eggMoves).length} with egg moves, ${Object.keys(moveInfo).length} moves described` +
		(unresolved ? `, ${unresolved} moves without a name` : '') + (unknown.size ? `; methods not described: ${[...unknown].join(', ')}` : ''));
}

main();
