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

// A level given relative to the player ("Highest Lv -3", "Highest Lv", "Player Max Level"): how many
// levels below the player's highest-level party Pokémon, or null for a fixed level.
function levelBelowHighest(level) {
	if (typeof level === 'number') return null;
	const text = String(level || '');
	if (/player max level/i.test(text)) return 0;
	const match = /highest\s*lv\.?\s*(?:-\s*(\d+))?/i.exec(text);
	return match ? parseInt(match[1] || '0', 10) : null;
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
		levelBelowHighest: levelBelowHighest(mon.level),
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
		if (speedStat(SPECIES[doc.species].bs.sp, iv, (doc.evs && doc.evs.sp) || 0, doc.level, doc.nature) === doc.speed) fits.push(iv);
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

// The documented ability before Mega Evolving: the first line not marked "(Mega)" ("Levitate"
// of "Levitate / Shadow Tag"); of "Flash Fire or White Smoke", the first.
function preMegaAbility(doc) {
	const line = doc.abilityLines.filter(a => a.tag !== 'mega')[0];
	if (!line) return null;
	if (ABILITY_NAMES.indexOf(line.name) !== -1) return line.name;
	return resolve('ability', line.name.split(/\s+or\s+/)[0]);
}

// Overwrites a set with the documented values.
function applyDocument(doc, set, species) {
	if (doc.level !== null) set.level = doc.level;
	if (doc.nature) set.nature = doc.nature;
	if (doc.abilityLines.length && doc.abilities.indexOf(set.ability) === -1) set.ability = documentedAbility(doc, species);
	if (doc.item) set.item = doc.item;
	else delete set.item;
	set.moves = doc.moves.slice();
	// EVs the document does not give (no EVs column) are left as they are.
	if (doc.evs && Object.keys(doc.evs).length) set.evs = Object.assign({}, doc.evs);
	else if (doc.evs) delete set.evs;
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
	if (doc.evs && STATS.some(s => (doc.evs[s] || 0) !== (calcEvs[s] || 0))) {
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
	// The documented values each set was matched to. Two fights with different values
	// (Lance's two teams) need two sets, or applying the documents would overwrite one
	// with the other.
	const claims = {};
	const valuesKey = m => JSON.stringify([m.level, m.nature, m.abilities, m.item, m.moves.slice().sort(), m.evs]);

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
			if (effectHpEvs) team.forEach(m => { m.evs = Object.assign({}, m.evs, {hp: parseInt(effectHpEvs[1], 10)}); });
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
			// The ability a trainer's Mega has before it Mega Evolves, by team slot.
			const preMega = {};
			const below = [];
			const sets = team.map((m, slot) => {
				const candidates = [];
				formesOf(m.species).forEach(sp => Object.keys(setdex[sp] || {}).forEach(n => {
					if (trainers.indexOf(trainerOf(n)) !== -1 && !used[sp + ' (' + n + ')']) candidates.push({species: sp, name: n});
				}));
				const key = valuesKey(m);
				const score = c => {
					const s = setdex[c.species][c.name];
					const claimed = claims[c.species + ' (' + c.name + ')'];
					const shared = m.moves.filter(mv => (s.moves || []).indexOf(mv) !== -1).length;
					return shared * 10 + (s.level === m.level ? 5 : 0) + (s.nature === m.nature ? 2 : 0) +
						((s.item || '') === m.item ? 2 : 0) + (c.species === m.species ? 3 : 0) -
						(claimed && claimed !== key ? 1000 : 0);
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
				if (/-Mega/.test(best.species)) {
					const ability = preMegaAbility(m);
					if (ability) preMega[slot] = ability;
				}
				used[setId] = true;
				if (!claims[setId]) claims[setId] = key;
				reuse[m.species] = best;
				below.push(m.levelBelowHighest);
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
			const variant = {label: variantLabel(v.note, vi), battleEffect: v.battleEffect ? sentenceCase(v.battleEffect, properNouns) : null, sets};
			if (Object.keys(preMega).length) variant.preMega = preMega;
			if (below.some(n => n !== null)) variant.levelBelowHighest = below;
			return variant;
		})
	}));
	return {order, report, stats};
}

/*
 * The rival's team follows your starter, but the documents mostly list only the team he has
 * against a Fire starter ("Rival Has Squirtle"). rival_teams.json holds all three teams of
 * every rival fight, read from the game's trainer data (FireRed's rival trainers come in
 * threes, one per starter); the teams the document leaves out are added from it, each
 * Pokémon matched to the rival's calc set with the same moves, nature and item. Battle
 * effects come from the file too ("battleEffects", read from the game's Hardcore battle
 * scripts), since they differ between his teams.
 */
function addRivalTeams(order, setdex) {
	const fights = JSON.parse(fs.readFileSync(path.join(__dirname, 'rival_teams.json'), 'utf8'))[mode] || [];
	const baseOf = sp => (SPECIES[sp] && SPECIES[sp].baseSpecies) || sp;
	const speciesKey = team => team.map(baseOf).sort().join();
	const sameMove = (a, b) => a === b || (/^Hidden Power/.test(a) && /^Hidden Power/.test(b));
	let added = 0;
	fights.forEach(fight => {
		const known = speciesKey(fight.teams['Rival Has Squirtle'].map(m => m.species));
		const trainer = order.find(t => t.variants.some(v => v.label === 'Rival Has Squirtle' &&
			speciesKey(v.sets.map(id => id.slice(0, id.lastIndexOf(' (')))) === known));
		if (!trainer) throw new Error(`No ${mode} rival fight has the team ${known}`);
		const model = trainer.variants.find(v => v.label === 'Rival Has Squirtle');
		const names = [];
		model.sets.forEach(id => {
			const name = trainerOf(id.slice(id.lastIndexOf(' (') + 2, -1));
			if (names.indexOf(name) === -1) names.push(name);
		});
		Object.keys(fight.teams).forEach(label => {
			if (trainer.variants.some(v => v.label === label)) return;
			const used = {};
			const sets = fight.teams[label].map(m => {
				const candidates = [];
				formesOf(m.species).forEach(sp => Object.keys(setdex[sp] || {}).forEach(n => {
					if (names.indexOf(trainerOf(n)) !== -1 && !used[sp + ' (' + n + ')']) candidates.push({species: sp, name: n});
				}));
				const score = c => {
					const s = setdex[c.species][c.name];
					return m.moves.filter(mv => (s.moves || []).some(sm => sameMove(sm, mv))).length * 10 +
						(s.nature === m.nature ? 2 : 0) + ((s.item || '') === m.item ? 2 : 0);
				};
				const best = candidates.sort((a, b) => score(b) - score(a))[0];
				if (!best || score(best) < 20) throw new Error(`${mode} ${label}: no calc set fits ${JSON.stringify(m)}`);
				const id = best.species + ' (' + best.name + ')';
				used[id] = true;
				return id;
			});
			// Each team can have its own battle effect (in Hardcore, the last Route 22 fight is
			// rain, swamp or magma storm depending on his team); none unless the file gives one.
			const variant = {label, battleEffect: (fight.battleEffects || {})[label] || null, sets};
			// Levels relative to the player, as in the documented team: by species, and the starter
			// (the one species that differs) takes the documented starter's.
			if (model.levelBelowHighest) {
				const left = model.sets.map((id, k) => ({species: baseOf(id.slice(0, id.lastIndexOf(' ('))), below: model.levelBelowHighest[k]}));
				const below = sets.map(id => {
					const k = left.findIndex(x => x.species === baseOf(id.slice(0, id.lastIndexOf(' ('))));
					return k === -1 ? undefined : left.splice(k, 1)[0].below;
				});
				variant.levelBelowHighest = below.map(n => n === undefined ? (left.length ? left.shift().below : null) : n);
			}
			trainer.variants.push(variant);
			added++;
		});
	});
	return added;
}

/*
 * Teams the documents leave out, read from the game (rom_teams.json): Bugsy's Route 25 script
 * checks the Thunder Badge and uses another team once you have it, and Pryce's and Jasmine's
 * scripts pick one of three teams at random (only those that differ are listed). A documented
 * team is recognised and kept; each other team gets the trainer's calc sets with the same
 * moves, nature, item and ability, or new sets when there are none. Returns how many sets
 * were added (the caller then writes the sets file).
 */
function addRomTeams(order, setdex) {
	const entries = JSON.parse(fs.readFileSync(path.join(__dirname, 'rom_teams.json'), 'utf8'))[mode] || [];
	const baseOf = sp => (SPECIES[sp] && SPECIES[sp].baseSpecies) || sp;
	// The game stores a Mega's ability before it Mega Evolves, and the calc's IVs reproduce the
	// documents' stats, so those two are not compared.
	const fits = (set, m, species) => set.nature === m.nature && (set.item || '') === m.item &&
		(/-Mega/.test(species) || set.ability === m.ability) &&
		(set.moves || []).slice().sort().join() === m.moves.slice().sort().join() &&
		JSON.stringify(set.evs || {}) === JSON.stringify(m.evs);
	let setsAdded = 0;
	entries.forEach(entry => {
		const trainer = order.find(t => t.name === entry.trainer);
		if (!trainer) throw new Error(`${mode}: no ${entry.trainer} fight`);
		const model = trainer.variants[0];
		const prefix = model.sets[0].slice(model.sets[0].lastIndexOf(' (') + 2, -1).replace(/ Set \d+$/, '');
		// The calc species for a ROM species: the documented team's forme (Aggron-Mega), else the base.
		const speciesFor = name => model.sets.map(id => id.slice(0, id.lastIndexOf(' ('))).find(sp => baseOf(sp) === baseOf(name)) || name;
		const setsFor = team => team.map(m => {
			const found = [];
			formesOf(m.species).forEach(sp => Object.keys(setdex[sp] || {}).forEach(n => {
				if (trainerOf(n) === trainerOf(prefix) && fits(setdex[sp][n], m, sp)) found.push(sp + ' (' + n + ')');
			}));
			return {mon: m, id: found[0] || null};
		});
		const isDocumented = team => {
			const ids = setsFor(team).map(x => x.id);
			return ids.every(Boolean) && trainer.variants.some(v => v.sets.slice().sort().join() === ids.slice().sort().join());
		};
		if (entry.choice === 'replace') {
			// The document repeats another fight's team: the trainer's own calc sets (by species) instead.
			const own = name => {
				const found = [];
				formesOf(name).forEach(sp => Object.keys(setdex[sp] || {}).forEach(n => {
					if (toKey(trainerOf(n)) === toKey(entry.trainer)) found.push(sp + ' (' + n + ')');
				}));
				if (found.length !== 1) throw new Error(`${mode} ${entry.trainer}: ${found.length} sets for ${name}`);
				return found[0];
			};
			model.sets = entry.teams[0].map(m => own(m.species));
			model.trainerIds = entry.trainerIds;
			delete model.preMega;
			return;
		}
		const labels = entry.choice === 'thunderBadge' ? Object.keys(entry.teams) : entry.teams.map((t, k) => ['Team One', 'Team Two', 'Team Three'][k]);
		const teams = entry.choice === 'thunderBadge' ? labels.map(l => entry.teams[l]) : entry.teams;
		teams.forEach((team, k) => {
			if (isDocumented(team)) {
				if (entry.choice === 'thunderBadge') trainer.variants.find(v => v.label === labels[k]).thunderBadge = k === 1;
				return;
			}
			if (trainer.variants.some(v => v.label === labels[k])) labels[k] += ' (game data)';
			const sets = setsFor(team).map(x => {
				if (x.id) return x.id;
				const species = speciesFor(x.mon.species);
				setdex[species] = setdex[species] || {};
				let name = prefix;
				for (let n = 2; setdex[species][name]; n++) name = prefix + ' Set ' + n;
				const set = {nature: x.mon.nature, ability: x.mon.ability, level: setdex[model.sets[0].slice(0, model.sets[0].lastIndexOf(' ('))][model.sets[0].slice(model.sets[0].lastIndexOf(' (') + 2, -1)].level};
				if (x.mon.item) set.item = x.mon.item;
				set.moves = x.mon.moves;
				if (Object.keys(x.mon.evs).length) set.evs = x.mon.evs;
				const ivs = {};
				Object.keys(x.mon.ivs || {}).forEach(stat => {
					if (x.mon.ivs[stat] !== 31) ivs[stat] = x.mon.ivs[stat];
				});
				if (Object.keys(ivs).length) set.ivs = ivs;
				setdex[species][name] = set;
				setsAdded++;
				return species + ' (' + name + ')';
			});
			const variant = {label: labels[k], battleEffect: model.battleEffect, sets};
			// A Mega's ability before it Mega Evolves is the one the game stores.
			const preMega = {};
			sets.forEach((id, slot) => {
				if (/-Mega/.test(id)) preMega[slot] = team[slot].ability;
			});
			if (Object.keys(preMega).length) variant.preMega = preMega;
			if (entry.choice === 'thunderBadge') variant.thunderBadge = k === 1;
			// Johto leaders' levels follow yours, like the documented team's.
			if (model.levelBelowHighest) variant.levelBelowHighest = sets.map(() => model.levelBelowHighest[0]);
			trainer.variants.push(variant);
		});
		if (entry.choice === 'random' && entry.teams.length > 1) trainer.randomTeams = true;
	});
	return setsAdded;
}

/*
 * Fights you can do before or after a gym. The Hardcore document gives their cap as "before/after"
 * ("28/36": Nugget Bridge, the Dig House and the S.S. Anne, before or after Misty). The gym is the
 * last required fight with the first cap. Hardcore writes them to parallel_fights.json; both modes
 * mark those fights (the Default document has no such caps) with the gym and the cap after it.
 */
const fightKey = t => [t.name, t.location].map(x => toKey(x).replace(/(.)\1+/g, '$1')).join('|');

function writeParallelFights(documented) {
	const fights = [];
	documented.forEach(t => {
		const caps = /^(\d+)\/(\d+)$/.exec(String(t.levelCap || ''));
		if (!caps) return;
		const gate = documented.filter(g => !g.optional && String(g.levelCap) === caps[1]).pop();
		if (gate) fights.push({key: fightKey({name: titleCase(t.name), location: titleCase(t.location)}), gate: titleCase(gate.name)});
	});
	fs.writeFileSync(path.join(__dirname, 'parallel_fights.json'), JSON.stringify(fights, null, 1) + '\n');
}

function markParallelFights(order) {
	const fights = JSON.parse(fs.readFileSync(path.join(__dirname, 'parallel_fights.json'), 'utf8'));
	const cap = t => parseInt(t.levelCap, 10) || 0;
	let marked = 0;
	order.forEach(t => {
		const fight = fights.find(f => f.key === fightKey(t));
		if (!fight) return;
		const at = order.map(g => g.name).lastIndexOf(fight.gate);
		const gate = order[at];
		if (!gate) throw new Error(`${mode}: no ${fight.gate} for ${t.name}`);
		const after = order.slice(at + 1).find(g => !g.optional && cap(g) > cap(gate));
		t.parallel = {gate: fight.gate, capAfter: after ? cap(after) : cap(gate)};
		marked++;
	});
	return marked;
}

/*
 * The game's trainer ids for each team (trainer_ids.json, matched against the ROM's trainer data
 * by rr-rom's analysis/progression/trainer_ids.js), so a .sav's trainer flags say which fights
 * you have won. A double battle has both trainers' ids.
 */
// The Default document repeats Bird Keeper Robert's block (no location, same team): kept so the
// fights after it keep their place, but marked so navigation and progress skip it.
function markDuplicates(order) {
	let marked = 0;
	order.forEach((t, i) => {
		const prev = order[i - 1];
		if (prev && !t.location && t.name === prev.name && JSON.stringify(t.variants.map(v => v.sets)) === JSON.stringify(prev.variants.map(v => v.sets))) {
			t.duplicate = true;
			marked++;
		}
	});
	return marked;
}

function addTrainerIds(order) {
	const ids = JSON.parse(fs.readFileSync(path.join(__dirname, 'trainer_ids.json'), 'utf8'))[mode] || [];
	let added = 0;
	order.forEach((t, i) => t.variants.forEach(v => {
		const found = ids[i] && ids[i][v.label];
		if (found) {
			v.trainerIds = found;
			added++;
		}
	}));
	return added;
}

// Corrections checked against the game's trainer data (rom_teams.json "fixes"): a team Pokémon's
// ability before it Mega Evolves, its level below your highest, or its set's EVs.
function applyRomFixes(order, setdex) {
	const fixes = (JSON.parse(fs.readFileSync(path.join(__dirname, 'rom_teams.json'), 'utf8')).fixes || {})[mode] || [];
	let applied = 0;
	fixes.forEach(fix => {
		// The fight (two rival fights share Route 22) whose team has that Pokémon.
		const variant = [].concat(...order.filter(t => t.name === fix.trainer && (!fix.location || t.location === fix.location))
			.map(t => t.variants)).find(v => (!fix.label || v.label === fix.label) &&
			(fix.species === '*' || v.sets.some(id => id.slice(0, id.lastIndexOf(' (')) === fix.species)));
		if (!variant) throw new Error(`${mode}: no ${fix.trainer} ${fix.label || ''} with ${fix.species} to fix`);
		variant.sets.forEach((id, slot) => {
			const species = id.slice(0, id.lastIndexOf(' ('));
			if (fix.species !== '*' && species !== fix.species) return;
			if (fix.preMega) variant.preMega = Object.assign({}, variant.preMega, {[slot]: fix.preMega});
			if (typeof fix.levelBelowHighest === 'number') {
				variant.levelBelowHighest = variant.levelBelowHighest || variant.sets.map(() => null);
				variant.levelBelowHighest[slot] = fix.levelBelowHighest;
			}
			if (fix.evs) setdex[species][id.slice(id.lastIndexOf(' (') + 2, -1)].evs = fix.evs;
			applied++;
		});
	});
	return applied;
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
	const rivalTeams = addRivalTeams(order, setdex);
	const romSets = addRomTeams(order, setdex);
	if (mode === 'hardcore') writeParallelFights(documented);
	const parallel = markParallelFights(order);
	const withIds = addTrainerIds(order);
	const duplicates = markDuplicates(order);
	const romFixes = applyRomFixes(order, setdex);
	if (APPLY || romSets || romFixes) writeSetdex(setdex);

	const outFile = path.join(ROOT, 'src/js/data/trainers', mode + '.js');
	fs.mkdirSync(path.dirname(outFile), {recursive: true});
	fs.writeFileSync(outFile,
		'/* Generated by import/radical-red-trainers/build_trainers.js from the ' + mode + ' boss document; do not edit by hand.\n' +
		' * Boss fights in game order. Each team lists calc set ids ("Species (Set Name)"). The rival\'s\n' +
		' * teams for each starter come from rival_teams.json (the game\'s trainer data). */\n' +
		'var TRAINER_ORDER = ' + JSON.stringify(order, null, 1) + ';\n');
	writeReport(setdex, report, stats, order.length, namesFixed);
	console.log(`${mode}: ${order.length} trainers, ${stats.checked} Pokémon: ${stats.checked - stats.withDiffs - stats.notFound} match, ` +
		`${stats.withDiffs} differ, ${stats.notFound} not found; ${rivalTeams} rival teams added; ${romSets} sets added for game-data teams; ${parallel} parallel fights; ${withIds} teams with trainer ids; ${romFixes} fixes from the game; ${duplicates} duplicate fights marked` + (APPLY ? `; applied ${stats.applied} sets, fixed ${namesFixed} names` : ''));
}

build();
