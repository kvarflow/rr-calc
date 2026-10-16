#!/usr/bin/env node
'use strict';
/*
 * Generates src/js/data/encounters.js, every map's wild Pokémon for the small-screen Wild tab,
 * read from the Radical Red 4.1 ROM (which is not part of this repository).
 *
 * Usage (after `node build` so calc/dist exists):
 *   node import/radical-red-encounters.js <Radical Red .gba> <Rad-Red-4.1-Team-Exporter checkout> <map_groups.json>
 *
 * Radical Red (CFRU) picks a table by the clock: 04:00-16:59 the day table, 17:00-03:59 the
 * night table; a map missing from it, or a method its entry lacks, falls back to the default
 * table (FireRed's gWildMonHeaders, repointed). Species names come from the exporter's
 * Species.txt (line N = id N, fixed by rom-names.js); floor and area names from
 * pret/pokefirered's data/maps/map_groups.json, and for maps Radical Red added, from the
 * community's Pokémon Locations & Raid Dens v4.1 sheet.
 */

const fs = require('fs');
const path = require('path');
const {calc, resolve, romSpeciesName, COSMETIC_FORMES_BY_ID} = require('./rom-names');

const OUTPUT = path.resolve(__dirname, '../src/js/data/encounters.js');
const ROM_BASE = 0x08000000;
const DEFAULT_TABLE = 0x72c984;
const DAY_TABLE = 0x1166ab8;
const NIGHT_TABLE = 0x1166428;
const MAPSEC_NAMES = 0x3f1cac;
const FIRST_MAPSEC = 0x58;
const MAP_GROUPS = 0x3526a8;

// Each method's slot count and the chance of each slot, as in FireRed.
const METHODS = [
	{key: 'grass', slots: 12, rates: [20, 20, 10, 10, 10, 10, 5, 5, 4, 4, 1, 1]},
	{key: 'surf', slots: 5, rates: [60, 30, 5, 4, 1]},
	{key: 'rockSmash', slots: 5, rates: [60, 30, 5, 4, 1]},
	{key: 'fishing', slots: 10, rates: [70, 30, 60, 20, 20, 40, 40, 15, 4, 1]},
];
const RODS = [['oldRod', 0, 2], ['goodRod', 2, 5], ['superRod', 5, 10]];

// Radical Red reuses the Monean Chamber's map (2, 27) for another place, so its old Unown table
// no longer belongs to any map.
const ORPHANS = ['2,27'];
// Maps Radical Red added have no name of their own; these follow the locations sheet.
const AREA_NAMES = {
	'1,123': 'Postgame Area', // Rock Tunnel
	'1,125': '8F', '1,126': '9F', // Pokémon Tower
	'1,127': 'Expansion', // Viridian Forest
	'2,62': '4F', '2,63': 'Secret Area', // Pokémon Mansion (Gouging Fire's room)
	'2,64': 'Far West', // Safari Zone
};

function main(romFile, exporterDir, mapGroupsFile) {
	const rom = fs.readFileSync(romFile);
	const speciesNames = [''].concat(fs.readFileSync(path.join(exporterDir, 'Species.txt'), 'utf8')
		.split('\n').map((name, i) => romSpeciesName(i + 1, name.trim())));
	const pret = JSON.parse(fs.readFileSync(mapGroupsFile, 'utf8'));
	const pointer = offset => rom.readUInt32LE(offset) - ROM_BASE;

	const CHARS = {0x00: ' ', 0xAD: '.', 0xAE: '-', 0xB3: '\'', 0xB4: '\'', 0xB8: ',', 0x1B: 'é'};
	function text(offset) {
		let out = '';
		for (let c = rom[offset]; c !== 0xFF; c = rom[++offset]) {
			out += c >= 0xBB && c <= 0xD4 ? String.fromCharCode(65 + c - 0xBB) :
				c >= 0xD5 && c <= 0xEE ? String.fromCharCode(97 + c - 0xD5) :
				c >= 0xA1 && c <= 0xAA ? String.fromCharCode(48 + c - 0xA1) : (CHARS[c] || '?');
		}
		return out;
	}

	// {"group,num": [grass, surf, rock smash, fishing info offsets (0 if none)]}
	function readTable(offset) {
		const rows = {};
		for (; rom[offset] !== 0xFF; offset += 20) {
			rows[rom[offset] + ',' + rom[offset + 1]] = [4, 8, 12, 16].map(at => {
				const p = rom.readUInt32LE(offset + at);
				return p ? p - ROM_BASE : 0;
			});
		}
		return rows;
	}

	const unknown = new Set();
	// Each species once: level range and total chance, most likely first, as
	// [species, min level, max level, chance %(, cosmetic forme)].
	function summarize(slots, rates) {
		const bySpecies = new Map();
		slots.forEach(([min, max, id], i) => {
			if (!id) return; // an empty slot
			const romName = speciesNames[id] || '#' + id;
			const name = resolve('species', romName) || resolve('species', romName.split('-')[0]) || romName;
			if (!calc.SPECIES[9][name]) unknown.add(romName);
			const forme = COSMETIC_FORMES_BY_ID[id];
			const key = name + (forme ? '-' + forme : '');
			const entry = bySpecies.get(key);
			if (entry) {
				entry[1] = Math.min(entry[1], min);
				entry[2] = Math.max(entry[2], max);
				entry[3] += rates[i];
			} else {
				bySpecies.set(key, forme ? [name, min, max, rates[i], forme] : [name, min, max, rates[i]]);
			}
		});
		return [...bySpecies.values()].sort((a, b) => b[3] - a[3]);
	}

	function encounters(timeTable, defaultTable, key) {
		const row = timeTable[key] || defaultTable[key];
		const fallback = defaultTable[key] || [0, 0, 0, 0];
		const result = {};
		METHODS.forEach((method, m) => {
			const info = row[m] || fallback[m];
			if (!info) return;
			const array = pointer(info + 4);
			const slots = [];
			for (let k = 0; k < method.slots; k++) {
				slots.push([rom[array + 4 * k], rom[array + 4 * k + 1], rom.readUInt16LE(array + 4 * k + 2)]);
			}
			if (method.key === 'fishing') {
				for (const [rod, from, to] of RODS) {
					const found = summarize(slots.slice(from, to), method.rates.slice(from, to));
					if (found.length) result[rod] = found;
				}
			} else {
				const found = summarize(slots, method.rates);
				if (found.length) result[method.key] = found;
			}
		});
		return result;
	}

	const defaultTable = readTable(DEFAULT_TABLE);
	const dayTable = readTable(DAY_TABLE);
	const nightTable = readTable(NIGHT_TABLE);
	const keys = [...new Set([...Object.keys(defaultTable), ...Object.keys(dayTable), ...Object.keys(nightTable)])]
		.filter(key => !ORPHANS.includes(key));

	const locations = [];
	for (const key of keys) {
		const [group, num] = key.split(',').map(Number);
		const header = pointer(pointer(MAP_GROUPS + 4 * group) + 4 * num);
		const mapsec = rom[header + 0x14];
		const day = encounters(dayTable, defaultTable, key);
		if (!Object.keys(day).length) continue; // e.g. Lavender Town's empty table
		const night = encounters(nightTable, defaultTable, key);
		const names = pret[pret.group_order[group]] || [];
		locations.push({
			key, group, num, mapsec,
			name: text(pointer(MAPSEC_NAMES + 4 * (mapsec - FIRST_MAPSEC))),
			pret: names[num] || null,
			day, night: JSON.stringify(night) === JSON.stringify(day) ? null : night,
		});
	}

	// Floors and areas: where a location has several maps, name each by its part of pret's map
	// name ("FourIsland_IcefallCave_Entrance" -> "Entrance").
	const byName = {};
	for (const location of locations) (byName[location.name] = byName[location.name] || []).push(location);
	for (const [name, list] of Object.entries(byName)) {
		if (list.length < 2) continue;
		const own = name.replace(/[^A-Za-z0-9]/g, '').toLowerCase();
		list.forEach((location, i) => {
			if (AREA_NAMES[location.key]) {
				location.area = AREA_NAMES[location.key];
				return;
			}
			if (!location.pret) {
				location.area = 'Area ' + (i + 1);
				return;
			}
			const parts = location.pret.split('_').slice(1).filter(part => part.toLowerCase() !== own);
			location.area = parts.length ?
				parts.join(' ').replace(/([a-z])([A-Z0-9])/g, '$1 $2') : 'Main';
		});
	}

	locations.sort((a, b) => a.mapsec - b.mapsec || a.group - b.group || a.num - b.num);
	const out = locations.map(l => Object.assign({name: l.name}, l.area ? {area: l.area} : {},
		{day: l.day}, l.night ? {night: l.night} : {}));
	const js = '/* Wild encounters for every location, read from the Radical Red ROM by\n' +
		' * import/radical-red-encounters.js; do not edit by hand. Each method lists\n' +
		' * [species, min level, max level, chance %], plus a cosmetic forme ("Summer") the calc does not\n' +
		' * have. "night" (17:00-03:59) is given only where it differs from "day" (04:00-16:59). */\n' +
		'var ENCOUNTERS = ' + JSON.stringify(out) + ';\n';
	fs.writeFileSync(OUTPUT, js);
	console.log(out.length + ' locations, ' + Math.round(js.length / 1024) + ' KB; species the calc does not know: ' +
		([...unknown].join(', ') || 'none'));
}

if (process.argv.length < 5) {
	console.error('Usage: node import/radical-red-encounters.js <rom> <exporter dir> <map_groups.json>');
	process.exit(1);
}
main(process.argv[2], process.argv[3], process.argv[4]);
