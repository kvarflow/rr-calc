#!/usr/bin/env node
'use strict';
/*
 * Builds src/js/data/trainers/<mode>.js, the boss order used by the Previous / Next trainer
 * buttons, and a report of where the calc's trainer sets differ from the boss document.
 * With --apply it first corrects src/js/data/sets/<mode>.js: the boss documents are the
 * source of truth, so every documented Pokémon's set takes the document's level (when it
 * is a number), nature, ability, item, moves and EVs, and a Speed IV that reproduces the
 * documented Speed stat. Names the calc cannot read anywhere in the file ("Drain Kiss",
 * "Charzardite X", species "Screamtail") are corrected to the calc's spelling too.
 *
 * Usage (after `node build`, so calc/dist exists):
 *   python3 parse_docs.py "<Default Mode Bosses>.xlsx" normal.json
 *   node build_trainers.js normal normal.json normal-report.md [--apply]
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
const {calc, toKey, resolve, MOVE_NAMES, ITEM_NAMES, ABILITY_NAMES} = require('../rom-names');

const args = process.argv.slice(2);
const APPLY = args.indexOf('--apply') !== -1;
const [mode, docPath, reportPath] = args.filter(a => a !== '--apply');
const ROOT = path.resolve(__dirname, '../..');
const SETS_FILE = path.join(ROOT, 'src/js/data/sets', mode + '.js');
const SPECIES = calc.SPECIES[9];
const STATS = ['hp', 'at', 'df', 'sa', 'sd', 'sp'];

function loadSetdex() {
	return new Function(fs.readFileSync(SETS_FILE, 'utf8') + '; return SETDEX_SV;')();
}

// Writes the sets in the file's existing layout: one line per set.
function writeSetdex(setdex) {
	fs.writeFileSync(SETS_FILE, 'var SETDEX_SV = {\n' + Object.keys(setdex).map(species =>
		'  ' + JSON.stringify(species) + ': {\n' + Object.keys(setdex[species]).map(name =>
			'    ' + JSON.stringify(name) + ': ' + JSON.stringify(setdex[species][name])).join(',\n') + '\n  }'
	).join(',\n') + '\n};\n');
}

const titleCase = s => String(s || '').toLowerCase().replace(/(^|[\s.&(-])(\w)/g, (m, p, c) => p + c.toUpperCase());

// Document species use short forme names: "Geodude-A" (Alola), "Darmanitan-GZ" (Galar-Zen),
// "Charizard-MegaX", "Kyogre-P" (Primal). Picks the calc forme those letters fit best.
function resolveSpecies(name) {
	const exact = resolve('species', name);
	if (exact) return exact;
	const dash = name.indexOf('-');
	const base = dash > 0 && resolve('species', name.slice(0, dash));
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

// Every forme of a species ("Rotom" -> Rotom, Rotom-Fan, Rotom-Frost, ...). Short document
// names can be ambiguous ("Rotom-F", "Ursaluna-BM"), so matching looks at all of them.
function formesOf(species) {
	const base = (SPECIES[species] && SPECIES[species].baseSpecies) || species;
	return Object.keys(SPECIES).filter(n => n === base || n.startsWith(base + '-'));
}

// The trainer a set belongs to, without the " Set 2" suffix the calc adds for repeat fights
// or the "*" it puts in front of some bosses.
const trainerOf = setName => setName.replace(/ Set \d+$/, '').replace(/^\*/, '');

// "(!) IF RIVAL HAS SQUIRTLE" -> "Rival Has Squirtle", "(!) RAIN TEAM" -> "Rain Team".
const variantLabel = (note, index) => note ? titleCase(note.replace(/^(\(!\)\s*)?(if\s+)?/i, '')) : 'Team ' + (index + 1);

// Battle effects are written in capitals ("DOUBLES WITH PARTNER LANCE + PERMANENT RAIN").
// Shown in sentence case per clause, keeping Pokémon and trainer names capitalised.
// Trainer names that are also ordinary words in battle effects ("Max HP", "Misty terrain"):
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

// Names that cannot be resolved keep the document's spelling (and show in the report).
function documentedMon(mon) {
	const species = resolveSpecies(mon.species);
	// Abilities may list both formes' ("Damp\nSwift Swim (Mega)", "Intimidate (Both)").
	const abilityLines = String(mon.ability || '').split('\n').filter(a => a.trim()).map(a => {
		const tag = (a.match(/\((\w+)\)\s*$/) || [])[1];
		const name = a.replace(/\s*\(.*\)\s*$/, '').trim();
		return {name: resolve('ability', name, species) || name, tag: tag ? tag.toLowerCase() : null};
	});
	const item = String(mon.item || '').trim();
	return {
		species,
		docSpecies: mon.species,
		level: typeof mon.level === 'number' ? mon.level : null,
		nature: calc.NATURES[mon.nature] ? mon.nature : '',
		abilityLines,
		abilities: abilityLines.map(a => a.name),
		item: /^(no item|-)?$/i.test(item) ? '' : (resolve('item', item) || item),
		moves: mon.moves.map(m => resolve('move', m) || m),
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

// The Speed IVs that reproduce the documented Speed stat (the documents give no IVs).
function speedIvsFitting(doc) {
	if (typeof doc.speed !== 'number' || doc.level === null || !SPECIES[doc.species]) return [];
	const fits = [];
	for (let iv = 0; iv <= 31; iv++) {
		if (speedStat(SPECIES[doc.species].bs.sp, iv, doc.evs.sp || 0, doc.level, doc.nature) === doc.speed) fits.push(iv);
	}
	return fits;
}

const calcSpeedIv = set => set.ivs && set.ivs.sp !== undefined ? set.ivs.sp : 31;

// The document ability that fits the calc's forme: the "(Mega)" line for a Mega or Primal,
// otherwise the first (or "(Both)") line.
function documentedAbility(doc, species) {
	const lines = doc.abilityLines;
	if (/-(Mega|Primal)/.test(species)) {
		return (lines.filter(a => a.tag === 'mega' || a.tag === 'both')[0] || lines[lines.length - 1]).name;
	}
	return (lines.filter(a => a.tag !== 'mega')[0] || lines[0]).name;
}

// Overwrites a set with the documented values.
function applyDocument(doc, set, species) {
	if (doc.level !== null) set.level = doc.level;
	if (doc.nature) set.nature = doc.nature;
	if (doc.abilityLines.length && doc.abilities.indexOf(set.ability) === -1) set.ability = documentedAbility(doc, species);
	if (doc.item) set.item = doc.item;
	else delete set.item;
	set.moves = doc.moves.slice();
	if (Object.keys(doc.evs).length) set.evs = Object.assign({}, doc.evs);
	else delete set.evs;
	const fits = speedIvsFitting(doc);
	if (fits.length && fits.indexOf(calcSpeedIv(set)) === -1) {
		set.ivs = Object.assign({}, set.ivs, {sp: fits.indexOf(31) !== -1 ? 31 : fits[fits.length - 1]});
	}
}

// Corrects names the calc cannot read anywhere in the sets. Returns how many changed.
function fixUnreadableNames(setdex) {
	let fixed = 0;
	Object.keys(setdex).forEach(species => {
		const calcSpecies = SPECIES[species] ? species : resolve('species', species);
		if (calcSpecies && calcSpecies !== species) {
			setdex[calcSpecies] = Object.assign(setdex[calcSpecies] || {}, setdex[species]);
			delete setdex[species];
			fixed++;
		}
	});
	Object.keys(setdex).forEach(species => Object.keys(setdex[species]).forEach(name => {
		const set = setdex[species][name];
		const fix = (kind, value) => {
			const known = kind === 'move' ? MOVE_NAMES : kind === 'item' ? ITEM_NAMES : ABILITY_NAMES;
			if (!value || known.indexOf(value) !== -1) return value;
			const resolved = resolve(kind, value, species);
			if (resolved) fixed++;
			return resolved || value;
		};
		if (set.moves) set.moves = set.moves.map(m => fix('move', m));
		if (set.item) set.item = fix('item', set.item);
		if (set.ability) set.ability = fix('ability', set.ability);
	}));
	return fixed;
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
	if (doc.moves.slice().sort().join() !== calcMoves.join()) add('Moves', doc.moves.join(', '), calcMoves.join(', '));
	const calcEvs = set.evs || {};
	if (STATS.some(s => (doc.evs[s] || 0) !== (calcEvs[s] || 0))) {
		const fmt = evs => STATS.filter(s => evs[s]).map(s => evs[s] + ' ' + s).join(' / ') || 'none';
		add('EVs', fmt(doc.evs), fmt(calcEvs));
	}
	const fits = speedIvsFitting(doc);
	if (fits.length && fits.indexOf(calcSpeedIv(set)) === -1) {
		add('Speed IV', fits.length > 1 ? fits[0] + '-' + fits[fits.length - 1] : fits[0], calcSpeedIv(set));
	}
	const unknown = [].concat(
		(set.moves || []).filter(m => m && m !== '(No Move)' && MOVE_NAMES.indexOf(m) === -1),
		set.item && ITEM_NAMES.indexOf(set.item) === -1 ? [set.item] : [],
		set.ability && ABILITY_NAMES.indexOf(set.ability) === -1 ? [set.ability] : []);
	if (unknown.length) add('Name the calc does not recognise', '', unknown.join(', '));
	return diffs;
}

// Matches every documented team to calc sets. Returns the trainer order plus the report rows.
function matchDocument(documented, setdex) {
	const report = [];
	const properNouns = {};
	Object.keys(SPECIES).concat(documented.map(t => t.name.split(' ').pop())).forEach(n => { properNouns[toKey(n)] = true; });
	const stats = {checked: 0, withDiffs: 0, notFound: 0, applied: 0};

	const trainersOf = m => {
		const names = [];
		formesOf(m.species).forEach(sp => Object.keys(setdex[sp] || {}).forEach(n => {
			if (names.indexOf(trainerOf(n)) === -1) names.push(trainerOf(n));
		}));
		return names;
	};
	// Ties (two trainers with sets for the same species) go to the one the fight is named after.
	const mostCommonTrainer = (mons, fightName) => {
		const votes = {};
		mons.forEach(m => trainersOf(m).forEach(n => { votes[n] = (votes[n] || 0) + 1; }));
		const named = n => toKey(fightName).indexOf(toKey(n.split(' ').pop())) !== -1 ? 1 : 0;
		return Object.keys(votes).sort((a, b) => votes[b] - votes[a] || named(b) - named(a))[0];
	};

	const order = documented.map(t => ({
		name: titleCase(t.name),
		location: titleCase(t.location),
		levelCap: t.levelCap,
		optional: t.optional,
		variants: t.variants.map((v, vi) => {
			const team = v.team.map(documentedMon);
			// "Omni-boosted + 252 HP EVs": EVs given by the battle effect rather than the team block.
			const effectHpEvs = /(\d+) HP EVs/i.exec(v.battleEffect || '');
			if (effectHpEvs) team.forEach(m => { m.evs.hp = parseInt(effectHpEvs[1], 10); });
			// The trainer: the set name (without " Set N") shared by most of the team's species.
			const trainers = [mostCommonTrainer(team, t.name)];
			// Double battles ("Ann & Brooks") store each partner's Pokémon under their own name:
			// the partner is the trainer shared by the Pokémon the first one does not have.
			if (/&/.test(t.name)) {
				const rest = team.filter(m => trainersOf(m).indexOf(trainers[0]) === -1);
				if (rest.length) trainers.push(mostCommonTrainer(rest, t.name));
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
					const shared = m.moves.filter(mv => (s.moves || []).indexOf(mv) !== -1).length;
					return shared * 10 + (s.level === m.level ? 5 : 0) + (s.nature === m.nature ? 2 : 0) +
						((s.item || '') === m.item ? 2 : 0) + (c.species === m.species ? 3 : 0);
				};
				// A team can repeat a species (four Shedinja), but the calc keeps one set per
				// species per trainer, so fall back to reusing that set.
				const best = candidates.sort((a, b) => score(b) - score(a))[0] || reuse[m.species];
				stats.checked++;
				if (!best) {
					stats.notFound++;
					report.push({trainer: label, species: m.docSpecies, set: null, diffs: [{field: 'Not in the calc', documented: m.docSpecies, inCalc: ''}]});
					return null;
				}
				const setId = best.species + ' (' + best.name + ')';
				used[setId] = true;
				reuse[m.species] = best;
				m.species = best.species;
				const set = setdex[best.species][best.name];
				if (APPLY && compare(m, set).length) {
					applyDocument(m, set, best.species);
					stats.applied++;
				}
				const diffs = compare(m, set);
				if (diffs.length) {
					stats.withDiffs++;
					report.push({trainer: label, species: best.species, set: best.name, diffs});
				}
				return setId;
			}).filter(Boolean);
			return {label: variantLabel(v.note, vi), battleEffect: v.battleEffect ? sentenceCase(v.battleEffect, properNouns) : null, sets};
		})
	}));
	return {order, report, stats};
}

function writeReport(setdex, report, stats, trainerCount, namesFixed) {
	const {checked, withDiffs, notFound, applied} = stats;
	const lines = ['# ' + titleCase(mode) + ' Mode: calc sets vs. the boss document', '',
		(APPLY ? `Applied the document to ${applied} sets and corrected ${namesFixed} unreadable names. ` : '') +
		`${trainerCount} trainers, ${checked} Pokémon checked: ${checked - withDiffs - notFound} match, ` +
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
}

function build() {
	const setdex = loadSetdex();
	const namesFixed = APPLY ? fixUnreadableNames(setdex) : 0;
	const documented = JSON.parse(fs.readFileSync(docPath, 'utf8'));
	const {order, report, stats} = matchDocument(documented, setdex);
	if (APPLY) writeSetdex(setdex);

	const outFile = path.join(ROOT, 'src/js/data/trainers', mode + '.js');
	fs.mkdirSync(path.dirname(outFile), {recursive: true});
	fs.writeFileSync(outFile,
		'/* Generated by import/radical-red-trainers/build_trainers.js from the ' + mode + ' boss document; do not edit by hand.\n' +
		' * Boss fights in game order. Each team lists calc set ids ("Species (Set Name)"). */\n' +
		'var TRAINER_ORDER = ' + JSON.stringify(order, null, 1) + ';\n');
	writeReport(setdex, report, stats, order.length, namesFixed);
	console.log(`${mode}: ${order.length} trainers, ${stats.checked} Pokémon: ${stats.checked - stats.withDiffs - stats.notFound} match, ` +
		`${stats.withDiffs} differ, ${stats.notFound} not found` + (APPLY ? `; applied ${stats.applied} sets, fixed ${namesFixed} names` : ''));
}

build();
