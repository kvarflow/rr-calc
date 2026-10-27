#!/usr/bin/env node
'use strict';
/*
 * Generates src/js/data/learnsets/radicalred.js, each Pokémon's level-up moves, for the Dex (dex.js).
 *
 * Usage (after `node build` so calc/dist exists):
 *   node import/radical-red-learnsets.js <Pokémon Radical Red 4.1 ROM>
 *
 * Radical Red keeps a pointer to each species' learnset in a table at 0x0980175C (by species id,
 * the ids radical_red_save_data.js names); each learnset is 3-byte entries (u16 move id, u8 level)
 * ended by level 0xFF. The same table gives route trainers their moves (rr-rom's
 * analysis/progression/route_trainers.js).
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const {resolve} = require('./rom-names');

const OUTPUT = path.resolve(__dirname, '../src/js/data/learnsets/radicalred.js');
const ROM_BASE = 0x08000000;
const LEARNSETS = 0x0980175C;

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
		}
		if (moves.length) learnsets[species] = moves;
	});
	fs.writeFileSync(OUTPUT,
		'/* Each Pokémon\'s level-up moves as [level, move] (level 0: on evolving), read from the Radical Red\n' +
		' * 4.1 ROM by import/radical-red-learnsets.js; do not edit by hand. Loaded when the Dex opens. */\n' +
		'var LEARNSETS = ' + JSON.stringify(learnsets) + ';\n');
	console.log(`${Object.keys(learnsets).length} learnsets` + (unresolved ? `, ${unresolved} moves without a name` : ''));
}

main();
