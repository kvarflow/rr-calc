#!/usr/bin/env node
'use strict';
/*
 * Builds src/js/data/trainers/<mode>.js, the boss order used by the Previous / Next trainer
 * buttons, and a report of where the calc's trainer sets differ from the boss document.
 *
 * Usage (after `node build`, so calc/dist exists):
 *   python3 parse_docs.py "<Default Mode Bosses>.xlsx" normal.json
 *   node build_trainers.js normal normal.json normal-report.md
 * and the same with "hardcore" and the Hardcore Mode Bosses document.
 *
 * The documents only cover bosses and give many levels relative to the player ("Highest
 * Lv -3"), so each documented team is matched to the calc's sets by species: first the
 * trainer (set names, ignoring the " Set 2" style suffixes the calc adds when a trainer
 * fights more than once), then, per Pokémon, the trainer's set that best fits its moves,
 * level, nature and item.
 */

const fs = require('fs');
const path = require('path');
const calc = require('../../calc/dist/index.js');

const [mode, docPath, reportPath] = process.argv.slice(2);
const ROOT = path.resolve(__dirname, '../..');
const SPECIES = calc.SPECIES[9];
const MOVE_NAMES = Object.keys(calc.MOVES[9]);
const ITEM_NAMES = calc.ITEMS[9];
const ABILITY_NAMES = calc.ABILITIES[9];

function loadSetdex() {
	const source = fs.readFileSync(path.join(ROOT, 'src/js/data/sets', mode + '.js'), 'utf8');
	return new Function(source + '; return SETDEX_SV;')();
}

const toKey = s => calc.toID(String(s).normalize('NFD').replace(/[̀-ͯ]/g, ''));
const titleCase = s => String(s || '').toLowerCase().replace(/(^|[\s.&(-])(\w)/g, (m, p, c) => p + c.toUpperCase());

// Resolves a document name to the calc's spelling. Words ending in "." are abbreviations
// ("Disarm. Voice", "Terrain Extend."); otherwise names are compared letters-and-digits only.
function resolveName(name, names) {
	if (!name) return '';
	name = String(name).trim().replace(/^HP (\w+)$/, 'Hidden Power $1');
	const exact = names.find(n => toKey(n) === toKey(name));
	if (exact) return exact;
	const words = name.split(/\s+/);
	const matches = names.filter(n => {
		const nameWords = n.split(/\s+/);
		return nameWords.length === words.length && words.every((w, i) =>
			w.endsWith('.') ? toKey(nameWords[i]).startsWith(toKey(w)) : toKey(nameWords[i]) === toKey(w));
	});
	return matches.length === 1 ? matches[0] : name;
}

// Document species use short forme names: "Geodude-A" (Alola), "Darmanitan-GZ" (Galar-Zen),
// "Charizard-MegaX", "Kyogre-P" (Primal). Picks the calc forme those letters fit best.
const speciesByKey = {};
Object.keys(SPECIES).forEach(n => { speciesByKey[toKey(n)] = n; });
function resolveSpecies(name) {
	if (speciesByKey[toKey(name)]) return speciesByKey[toKey(name)];
	const dash = name.indexOf('-');
	const base = dash > 0 && speciesByKey[toKey(name.slice(0, dash))];
	if (!base) return null;
	const abbr = toKey(name.slice(dash + 1));
	const fit = forme => {
		const parts = forme.slice(base.length + 1).split('-').map(toKey);
		const joined = parts.join('');
		if (joined === abbr) return 0;
		if (parts.map(p => p[0]).join('') === abbr) return 1;
		if (joined.startsWith(abbr)) return 2;
		if (joined.includes(abbr)) return 3;
		return null;
	};
	const best = Object.keys(SPECIES).filter(n => n.startsWith(base + '-'))
		.map(n => ({name: n, score: fit(n)})).filter(c => c.score !== null)
		.sort((a, b) => a.score - b.score || a.name.length - b.name.length)[0];
	return best ? best.name : base; // e.g. "Landorus-I(ncarnate)" is the base forme
}

// The trainer a set belongs to, without the " Set 2" suffix the calc adds for repeat fights
// or the "*" it puts in front of some bosses.
// Battle effects are written in capitals ("DOUBLES WITH PARTNER LANCE + PERMANENT RAIN").
// Shown in sentence case per clause, keeping Pokémon and trainer names capitalised.
// Trainer names that are also ordinary words in battle effects ("Max HP", "Misty terrain").
const NOT_PROPER_NOUNS = ['max', 'misty'];
const ACRONYMS = {hp: 'HP', evs: 'EVs', ivs: 'IVs', pokemon: 'Pokémon'};

function sentenceCase(text, properNouns) {
	return String(text).replace(/-\n/g, '-').replace(/\s*\n\s*/g, ' ').toLowerCase()
		.replace(/[a-z][a-z'.-]*/g, w => {
			if (ACRONYMS[w]) return ACRONYMS[w];
			const proper = properNouns[toKey(w)] && NOT_PROPER_NOUNS.indexOf(w) === -1;
			return proper ? w.charAt(0).toUpperCase() + w.slice(1) : w;
		})
		.replace(/(^|[+.]\s*)([a-z])/g, (m, p, c) => p + c.toUpperCase());
}

// "(!) IF RIVAL HAS SQUIRTLE" -> "Rival Has Squirtle", "(!) RAIN TEAM" -> "Rain Team".
const variantLabel = (note, index) => note ? titleCase(note.replace(/^(\(!\)\s*)?(if\s+)?/i, '')) : 'Team ' + (index + 1);

const trainerOf = setName => setName.replace(/ Set \d+$/, '').replace(/^\*/, '');

// Every forme of a species ("Rotom" -> Rotom, Rotom-Fan, Rotom-Frost, ...). Short document
// names can be ambiguous ("Rotom-F", "Ursaluna-BM"), so matching looks at all of them.
function formesOf(species) {
	const base = (SPECIES[species] && SPECIES[species].baseSpecies) || species;
	return Object.keys(SPECIES).filter(n => n === base || n.startsWith(base + '-'));
}
const sameMoves = (a, b) => a.filter(m => b.indexOf(m) !== -1).length;

function documentedMon(mon) {
	return {
		species: resolveSpecies(mon.species),
		docSpecies: mon.species,
		level: typeof mon.level === 'number' ? mon.level : null,
		nature: mon.nature || '',
		// Mega Pokémon list both abilities ("Damp\nSwift Swim (Mega)"); any listed one is accepted.
		abilities: String(mon.ability || '').split('\n').map(a => resolveName(a.replace(/\s*\(.*\)\s*$/, ''), ABILITY_NAMES)).filter(Boolean),
		item: /^(no item|-)?$/i.test(String(mon.item || '').trim()) ? '' : resolveName(mon.item, ITEM_NAMES),
		moves: mon.moves.map(m => resolveName(m, MOVE_NAMES)).sort(),
		evs: mon.evs,
		speed: mon.speed
	};
}

function speedStat(base, iv, ev, level, nature) {
	let speed = Math.floor((2 * base + iv + Math.floor(ev / 4)) * level / 100) + 5;
	const n = calc.NATURES[nature];
	if (n && n[0] === 'spe' && n[1] !== 'spe') speed = Math.floor(speed * 1.1);
	if (n && n[1] === 'spe' && n[0] !== 'spe') speed = Math.floor(speed * 0.9);
	return speed;
}

// Differences between a documented Pokémon and the calc set chosen for it.
function compare(doc, set) {
	const diffs = [];
	const add = (field, documented, inCalc) => diffs.push({field, documented, inCalc});
	if (doc.level !== null && set.level !== doc.level) add('Level', doc.level, set.level);
	if (doc.nature && set.nature !== doc.nature) add('Nature', doc.nature, set.nature);
	if (doc.abilities.length && doc.abilities.indexOf(set.ability) === -1) add('Ability', doc.abilities.join(' / '), set.ability);
	if (doc.item !== (set.item || '')) add('Item', doc.item || '(none)', set.item || '(none)');
	const calcMoves = (set.moves || []).filter(m => m && m !== '(No Move)').sort();
	if (doc.moves.join() !== calcMoves.join()) add('Moves', doc.moves.join(', '), calcMoves.join(', '));
	const calcEvs = set.evs || {};
	if (['hp', 'at', 'df', 'sa', 'sd', 'sp'].some(s => (doc.evs[s] || 0) !== (calcEvs[s] || 0))) {
		const fmt = evs => ['hp', 'at', 'df', 'sa', 'sd', 'sp'].filter(s => evs[s]).map(s => evs[s] + ' ' + s).join(' / ') || 'none';
		add('EVs', fmt(doc.evs), fmt(calcEvs));
	}
	// The documents give no IVs, but the in-game Speed stat pins down the Speed IV.
	if (typeof doc.speed === 'number' && doc.level !== null && SPECIES[doc.species]) {
		const fits = [];
		for (let iv = 0; iv <= 31; iv++) {
			if (speedStat(SPECIES[doc.species].bs.sp, iv, doc.evs.sp || 0, doc.level, doc.nature) === doc.speed) fits.push(iv);
		}
		const calcIv = set.ivs && set.ivs.sp !== undefined ? set.ivs.sp : 31;
		if (fits.length && fits.indexOf(calcIv) === -1) {
			add('Speed IV', fits.length > 1 ? fits[0] + '-' + fits[fits.length - 1] : fits[0], calcIv);
		}
	}
	const unknown = [].concat(
		(set.moves || []).filter(m => m && m !== '(No Move)' && MOVE_NAMES.indexOf(m) === -1),
		set.item && ITEM_NAMES.indexOf(set.item) === -1 ? [set.item] : [],
		set.ability && ABILITY_NAMES.indexOf(set.ability) === -1 ? [set.ability] : []);
	if (unknown.length) add('Name the calc does not recognise', '', unknown.join(', '));
	return diffs;
}

function build() {
	const setdex = loadSetdex();
	const documented = JSON.parse(fs.readFileSync(docPath, 'utf8'));
	const report = [];
	const properNouns = {};
	Object.keys(SPECIES).concat(documented.map(t => t.name.split(' ').pop())).forEach(n => { properNouns[toKey(n)] = true; });
	let checked = 0, withDiffs = 0, notFound = 0;

	const order = documented.map(t => ({
		name: titleCase(t.name),
		location: titleCase(t.location),
		levelCap: t.levelCap,
		optional: t.optional,
		variants: t.variants.map((v, vi) => {
			const team = v.team.map(documentedMon);
			// The trainer: the set name (without " Set N") shared by most of the team's species.
			const trainersOf = m => {
				const names = [];
				formesOf(m.species).forEach(sp => Object.keys(setdex[sp] || {}).forEach(n => {
					if (names.indexOf(trainerOf(n)) === -1) names.push(trainerOf(n));
				}));
				return names;
			};
			const mostCommonTrainer = mons => {
				const votes = {};
				mons.forEach(m => trainersOf(m).forEach(n => { votes[n] = (votes[n] || 0) + 1; }));
				return Object.keys(votes).sort((a, b) => votes[b] - votes[a])[0];
			};
			const trainers = [mostCommonTrainer(team)];
			// Double battles ("Ann & Brooks") store each partner's Pokémon under their own name:
			// the partner is the trainer shared by the Pokémon the first one does not have.
			if (/&/.test(t.name)) {
				const rest = team.filter(m => trainersOf(m).indexOf(trainers[0]) === -1);
				if (rest.length) trainers.push(mostCommonTrainer(rest));
			}
			const used = {};
			const reuse = {};
			const label = titleCase(t.name) + (t.variants.length > 1 ? ' (' + variantLabel(v.note, vi) + ')' : '');
			const sets = team.map(m => {
				const candidates = [];
				formesOf(m.species).forEach(sp => Object.keys(setdex[sp] || {}).forEach(n => {
					if (trainers.indexOf(trainerOf(n)) !== -1 && !used[sp + ' (' + n + ')']) candidates.push({species: sp, name: n});
				}));
				const score = c => {
					const s = setdex[c.species][c.name];
					return sameMoves(m.moves, s.moves || []) * 10 + (s.level === m.level ? 5 : 0) +
						(s.nature === m.nature ? 2 : 0) + ((s.item || '') === m.item ? 2 : 0) + (c.species === m.species ? 3 : 0);
				};
				// A team can repeat a species (four Shedinja), but the calc keeps one set per
				// species per trainer, so fall back to reusing that set.
				const best = candidates.sort((a, b) => score(b) - score(a))[0] || reuse[m.species];
				checked++;
				if (!best) {
					notFound++;
					report.push({trainer: label, species: m.docSpecies, set: null, diffs: [{field: 'Not in the calc', documented: m.docSpecies, inCalc: ''}]});
					return null;
				}
				const setId = best.species + ' (' + best.name + ')';
				used[setId] = true;
				reuse[m.species] = best;
				m.species = best.species;
				const diffs = compare(m, setdex[best.species][best.name]);
				if (diffs.length) {
					withDiffs++;
					report.push({trainer: label, species: best.species, set: best.name, diffs});
				}
				return setId;
			}).filter(Boolean);
			return {label: variantLabel(v.note, vi), battleEffect: v.battleEffect ? sentenceCase(v.battleEffect, properNouns) : null, sets};
		})
	}));

	const outFile = path.join(ROOT, 'src/js/data/trainers', mode + '.js');
	fs.mkdirSync(path.dirname(outFile), {recursive: true});
	fs.writeFileSync(outFile,
		'/* Generated by import/radical-red-trainers/build_trainers.js from the ' + mode + ' boss document; do not edit by hand.\n' +
		' * Boss fights in game order. Each team lists calc set ids ("Species (Set Name)"). */\n' +
		'var TRAINER_ORDER = ' + JSON.stringify(order, null, 1) + ';\n');

	const lines = ['# ' + titleCase(mode) + ' Mode: calc sets vs. the boss document', '',
		`${order.length} trainers, ${checked} Pokémon checked: ${checked - withDiffs - notFound} match, ` +
		`${withDiffs} differ, ${notFound} not found in the calc.`, '',
		'| Trainer | Pokémon (calc set) | Field | Document | Calc |', '|---|---|---|---|---|'];
	report.forEach(r => r.diffs.forEach(d => lines.push(
		`| ${r.trainer} | ${r.species}${r.set ? ' (' + r.set + ')' : ''} | ${d.field} | ${d.documented} | ${d.inCalc} |`)));
	const unknownSpecies = Object.keys(setdex).filter(sp => !SPECIES[sp]);
	if (unknownSpecies.length) {
		lines.push('', '## Sets filed under a species the calc does not recognise', '',
			'These sets cannot be selected or calculated:', '');
		unknownSpecies.forEach(sp => lines.push(`- ${sp}: ${Object.keys(setdex[sp]).join(', ')}`));
	}
	fs.writeFileSync(reportPath, lines.join('\n') + '\n');
	console.log(`${mode}: ${order.length} trainers, ${checked} Pokémon: ${checked - withDiffs - notFound} match, ${withDiffs} differ, ${notFound} not found`);
}

build();
