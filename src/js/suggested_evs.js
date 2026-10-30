/*
 * Suggested EVs for Pokémon 1, as two more columns of the stats table (on small screens, with
 * Base / IVs / EVs open):
 *  - Generic: a usual spread for the Pokémon's role, from its base stats and its moves (a fast
 *    attacker, a bulky attacker or a wall), with the nature that goes with it.
 *  - vs <trainer>: the spread that wins the most one-on-ones against the team of the fight you
 *    are on, worked out with the calculator: Speed to move first, attack to KO in fewer hits, HP
 *    and defences to take more hits, at the fewest EVs, the rest into attack and then bulk.
 * "Use" puts a column's EVs in (a set from your save is unlocked first: EVs can be retrained).
 * The nature, level, IVs, item, ability and moves stay as they are.
 */

var SEV_STATS = ["hp", "at", "df", "sa", "sd", "sp"];
var SEV_CALC_STAT = {hp: "hp", at: "atk", df: "def", sa: "spa", sd: "spd", sp: "spe"};
var SEV_LABELS = {hp: "HP", at: "Attack", df: "Defense", sa: "Sp. Atk", sd: "Sp. Def", sp: "Speed"};
var SEV_MAX_STAT = 252;
var SEV_MAX_TOTAL = 510;
// The EV amounts tried (multiples of 4: the game counts a stat point per 4 EVs).
var SEV_STEPS = [];
for (var sevStep = 0; sevStep <= SEV_MAX_STAT; sevStep += 4) SEV_STEPS.push(sevStep);

// The nature that raises `up` and lowers `down` (calc stat names).
function getNatureName(up, down) {
	for (var name in calc.NATURES) {
		if (calc.NATURES[name][0] === up && calc.NATURES[name][1] === down) return name;
	}
	return "";
}

function emptySpread() {
	return {hp: 0, at: 0, df: 0, sa: 0, sd: 0, sp: 0};
}

// Which attacking stat a Pokémon uses: the side its attacks hit with (by power), else the higher.
function getAttackingStat(pokemon) {
	var power = {Physical: 0, Special: 0};
	pokemon.moves.forEach(function (move) {
		if (move && move.category !== "Status" && move.bp) power[move.category] += move.bp;
	});
	if (power.Physical !== power.Special) return power.Physical > power.Special ? "at" : "sa";
	return pokemon.species.baseStats.atk >= pokemon.species.baseStats.spa ? "at" : "sa";
}

/*
 * Generic: a wall (attack below 85, its HP and defences 10 more on average) maxes its HP and the
 * defence that leaves it weakest; a fast attacker (base Speed 70+) its attack and Speed; a slower
 * one its attack and HP.
 */
function getGenericSpread(pokemon) {
	var base = pokemon.species.baseStats;
	var attack = getAttackingStat(pokemon);
	var other = attack === "at" ? "sa" : "at";
	var weakerDefence = base.hp * base.def <= base.hp * base.spd ? "df" : "sd";
	var strongerDefence = weakerDefence === "df" ? "sd" : "df";
	var spread = emptySpread();
	var role, nature;
	var side = attack === "at" ? "physical" : "special";
	if (base[SEV_CALC_STAT[attack]] < 85 && (base.hp + base.def + base.spd) / 3 >= base[SEV_CALC_STAT[attack]] + 10) {
		role = (weakerDefence === "df" ? "Physical" : "Special") + " wall";
		spread.hp = 252;
		spread[weakerDefence] = 252;
		spread[strongerDefence] = 4;
		nature = getNatureName(SEV_CALC_STAT[weakerDefence], SEV_CALC_STAT[other]);
	} else if (base.spe >= 70) {
		role = "Fast " + side + " attacker";
		spread[attack] = 252;
		spread.sp = 252;
		spread.hp = 4;
		nature = getNatureName("spe", SEV_CALC_STAT[other]) + " or " + getNatureName(SEV_CALC_STAT[attack], SEV_CALC_STAT[other]);
	} else {
		role = "Bulky " + side + " attacker";
		spread.hp = 252;
		spread[attack] = 252;
		spread[weakerDefence] = 4;
		nature = getNatureName(SEV_CALC_STAT[attack], SEV_CALC_STAT[other]);
	}
	return {spread: spread, role: role, nature: nature};
}

// `pokemon` with other EVs, at full HP with no stat stages or status, as a fight starts.
function withEvs(pokemon, spread) {
	var evs = {};
	SEV_STATS.forEach(function (stat) {
		evs[SEV_CALC_STAT[stat]] = spread[stat] || 0;
	});
	return new calc.Pokemon(gen, pokemon.name, {
		level: pokemon.level, ability: pokemon.ability, abilityOn: pokemon.abilityOn, item: pokemon.item,
		gender: pokemon.gender, nature: pokemon.nature, ivs: pokemon.ivs, evs: evs,
		teraType: pokemon.teraType, moves: pokemon.moves.slice(), overrides: pokemon.species
	});
}

function oneStat(stat, ev) {
	var spread = emptySpread();
	spread[stat] = ev;
	return spread;
}

// For each step of SEV_STEPS, f(step index), working it out only where the stat changes.
function tableByStat(pokemon, stat, f) {
	var table = [];
	var lastStat = null;
	var lastValue;
	SEV_STEPS.forEach(function (ev, i) {
		var value = withEvs(pokemon, oneStat(stat, ev)).rawStats[SEV_CALC_STAT[stat]];
		if (value !== lastStat) {
			lastStat = value;
			lastValue = f(i);
		}
		table.push(lastValue);
	});
	return table;
}

function isSevDamaging(move) {
	return move && move.name && move.category !== "Status" && !!move.bp;
}

// Hits to KO from full HP: a Focus Sash or Sturdy holder lives through the first OHKO.
function hitsToKO(hp, damage, target) {
	if (!(damage > 0)) return Infinity;
	var hits = Math.ceil(hp / damage);
	if (hits === 1 && (target.hasItem("Focus Sash") || target.hasAbility("Sturdy"))) hits = 2;
	return hits;
}

function moveFirst(ownSpeed, foeSpeed) {
	if ($("#trickroom").prop("checked")) return ownSpeed < foeSpeed;
	return ownSpeed > foeSpeed;
}

// One foe's outcome against EVs given as step indexes.
function foeOutcome(foe, at) {
	var hp = foe.ownHP[at.hp];
	var taken = Math.min(hitsToKO(hp, foe.physical[at.df], foe.self), hitsToKO(hp, foe.special[at.sd], foe.self),
		hitsToKO(hp, foe.fixed, foe.self));
	var dealt = foe.dealt[at.attack];
	var first = moveFirst(foe.ownSpeed[at.sp], foe.speed);
	return {first: first, dealt: dealt, taken: taken, win: dealt !== Infinity && (first ? dealt <= taken : dealt < taken)};
}

function scoreOutcome(outcome) {
	return (outcome.win ? 100 : 0) + (outcome.taken >= 2 ? 10 : 0) + (outcome.first ? 3 : 0) +
		Math.max(-3, Math.min(3, outcome.taken - outcome.dealt));
}

/*
 * The tables a tailored spread is chosen from, for each foe: the hits Pokémon 1 needs to KO it by
 * attack EVs, the most it takes from the foe's strongest physical and special move (and fixed
 * damage, e.g. Seismic Toss) by Defense and Sp. Def EVs, and Pokémon 1's Speed and HP by EVs.
 */
function buildFoeTables(pokemon, foes) {
	var field = createField();
	var foeField = field.clone().swap();
	var attack = getAttackingStat(pokemon);
	var ownMoves = pokemon.moves.filter(isSevDamaging);
	var plain = withEvs(pokemon, emptySpread());
	var ownHP = SEV_STEPS.map(function (ev) {
		return withEvs(pokemon, oneStat("hp", ev)).maxHP();
	});
	var ownSpeed = SEV_STEPS.map(function (ev) {
		var probe = withEvs(pokemon, oneStat("sp", ev));
		var result = calc.calculate(gen, probe, withEvs(foes[0], emptySpread()), pokemon.moves[0], field);
		return Math.floor(result.attacker.stats.spe * battleSpeedMultiplier.p1);
	});
	return foes.map(function (foe) {
		var foeMoves = foe.moves.filter(isSevDamaging);
		var best = {Physical: null, Special: null};
		var fixed = 0;
		foeMoves.forEach(function (move) {
			var result = calc.calculate(gen, foe, plain, move, foeField);
			var damage = result.range()[1];
			// Fixed damage (Seismic Toss, Dragon Rage...) is the same whatever the defences.
			var other = calc.calculate(gen, foe, withEvs(pokemon, {hp: 0, at: 0, df: 252, sa: 0, sd: 252, sp: 0}), move, foeField).range()[1];
			if (other === damage) {
				fixed = Math.max(fixed, damage);
			} else if (!best[move.category] || damage > best[move.category].damage) {
				best[move.category] = {move: move, damage: damage};
			}
		});
		var damageTable = function (category, stat) {
			if (!best[category]) return SEV_STEPS.map(function () {
				return 0;
			});
			return tableByStat(pokemon, stat, function (i) {
				return calc.calculate(gen, foe, withEvs(pokemon, oneStat(stat, SEV_STEPS[i])), best[category].move, foeField).range()[1];
			});
		};
		var foeSpeed = calc.calculate(gen, foe, plain, foe.moves[0], foeField).attacker.stats.spe;
		var dealt = ownMoves.length ? tableByStat(pokemon, attack, function (i) {
			var attacker = withEvs(pokemon, oneStat(attack, SEV_STEPS[i]));
			var most = 0;
			ownMoves.forEach(function (move) {
				most = Math.max(most, calc.calculate(gen, attacker, foe, move, field).range()[0]);
			});
			return hitsToKO(foe.maxHP(), most, foe);
		}) : SEV_STEPS.map(function () {
			return Infinity;
		});
		return {
			self: plain, name: foe.name, speed: Math.floor(foeSpeed * battleSpeedMultiplier.p2),
			physical: damageTable("Physical", "df"), special: damageTable("Special", "sd"), fixed: fixed,
			strongest: [best.Physical, best.Special].filter(Boolean).sort(function (a, b) {
				return b.damage - a.damage;
			}).map(function (entry) {
				return entry.move.name;
			})[0] || "",
			dealt: dealt, ownHP: ownHP, ownSpeed: ownSpeed
		};
	});
}

// The step indexes where a table changes: the EVs worth trying for that stat.
function breakpoints(values) {
	var points = [0];
	for (var i = 1; i < values.length; i++) {
		if (values[i] !== values[i - 1]) points.push(i);
	}
	return points;
}

function scoreAt(tables, at) {
	var total = 0;
	tables.forEach(function (foe) {
		total += scoreOutcome(foeOutcome(foe, at));
	});
	return total;
}

function indexOfEv(ev) {
	return Math.max(0, Math.min(SEV_STEPS.length - 1, Math.floor((ev || 0) / 4)));
}

/*
 * The best spread for the tables: Speed and attack only at the EVs where they change something,
 * HP and the defences every 8 EVs; the highest score at the fewest EVs, trimmed 4 at a time, then
 * the EVs left go to attack, Speed, HP and the defences in that order.
 */
function chooseTailoredSpread(tables, attack) {
	var speedPoints = [0];
	var attackPoints = [0];
	tables.forEach(function (foe) {
		breakpoints(foe.ownSpeed.map(function (speed) {
			return moveFirst(speed, foe.speed);
		})).forEach(function (i) {
			if (speedPoints.indexOf(i) === -1) speedPoints.push(i);
		});
		breakpoints(foe.dealt).forEach(function (i) {
			if (attackPoints.indexOf(i) === -1) attackPoints.push(i);
		});
	});
	var limit = SEV_MAX_TOTAL / 4 | 0; // in steps of 4 EVs
	var trickRoom = $("#trickroom").prop("checked");
	// What Speed and attack do against each foe, worked out once.
	var first = tables.map(function (foe) {
		return speedPoints.map(function (i) {
			return trickRoom ? foe.ownSpeed[i] < foe.speed : foe.ownSpeed[i] > foe.speed;
		});
	});
	var dealt = tables.map(function (foe) {
		return attackPoints.map(function (i) {
			return foe.dealt[i];
		});
	});
	var taken = [];
	var best = null;
	for (var hp = 0; hp < SEV_STEPS.length; hp += 2) {
		for (var df = 0; df < SEV_STEPS.length && hp + df <= limit; df += 2) {
			for (var sd = 0; sd < SEV_STEPS.length && hp + df + sd <= limit; sd += 2) {
				for (var f = 0; f < tables.length; f++) {
					var foe = tables[f];
					var ownHP = foe.ownHP[hp];
					taken[f] = Math.min(hitsToKO(ownHP, foe.physical[df], foe.self), hitsToKO(ownHP, foe.special[sd], foe.self),
						hitsToKO(ownHP, foe.fixed, foe.self));
				}
				for (var s = 0; s < speedPoints.length; s++) {
					for (var a = 0; a < attackPoints.length; a++) {
						var cost = hp + df + sd + speedPoints[s] + attackPoints[a];
						if (cost > limit) continue;
						var score = 0;
						for (f = 0; f < tables.length; f++) {
							score += scoreOutcome({first: first[f][s], dealt: dealt[f][a], taken: taken[f],
								win: dealt[f][a] !== Infinity && (first[f][s] ? dealt[f][a] <= taken[f] : dealt[f][a] < taken[f])});
						}
						if (!best || score > best.score || (score === best.score && cost < best.cost)) {
							best = {score: score, cost: cost, at: {hp: hp, df: df, sd: sd, sp: speedPoints[s], attack: attackPoints[a]}};
						}
					}
				}
			}
		}
	}
	var at = best.at;
	// Trim what the score does not need.
	["hp", "df", "sd", "sp", "attack"].forEach(function (key) {
		while (at[key] > 0) {
			at[key]--;
			if (scoreAt(tables, at) < best.score) {
				at[key]++;
				break;
			}
		}
	});
	var spread = emptySpread();
	spread.hp = SEV_STEPS[at.hp];
	spread.df = SEV_STEPS[at.df];
	spread.sd = SEV_STEPS[at.sd];
	spread.sp = SEV_STEPS[at.sp];
	spread[attack] = SEV_STEPS[at.attack];
	var left = SEV_MAX_TOTAL - SEV_STATS.reduce(function (sum, stat) {
		return sum + spread[stat];
	}, 0);
	var fillOrder = [attack].concat($("#trickroom").prop("checked") ? [] : ["sp"], ["hp", "df", "sd"]);
	fillOrder.forEach(function (stat) {
		var add = Math.min(SEV_MAX_STAT - spread[stat], left - left % 4);
		spread[stat] += add;
		left -= add;
	});
	return spread;
}

function getSpreadAt(spread, attack) {
	return {hp: indexOfEv(spread.hp), df: indexOfEv(spread.df), sd: indexOfEv(spread.sd), sp: indexOfEv(spread.sp), attack: indexOfEv(spread[attack])};
}

function describeOutcome(foe, outcome) {
	var hits = function (n) {
		return n === Infinity ? "can't" : n === 1 ? "OHKO" : n + " hits";
	};
	return (outcome.win ? "✓ " : "✗ ") + foe.name + ": " + (outcome.first ? "you move first" : "it moves first") +
		"; you KO in " + hits(outcome.dealt) + ", it needs " + hits(outcome.taken) + (foe.strongest ? " (" + foe.strongest + ")" : "");
}

// The fight's team, or null when there is no fight (One vs One) or nothing to fight.
function getFightTeam() {
	if (typeof TRAINER_ORDER === "undefined" || !TRAINER_ORDER.length || typeof getTrainerVariant !== "function") return null;
	var trainer = TRAINER_ORDER[currentTrainerIndex];
	if (!trainer) return null;
	var variant = getTrainerVariant(trainer);
	var team = [];
	variant.sets.forEach(function (setId) {
		try {
			team.push(createPokemon(setId));
		} catch (e) {
			// A set the calc cannot load is left out.
		}
	});
	return team.length ? {name: trainer.name, key: currentTrainerIndex + ":" + variant.label, team: team} : null;
}

var sevState = {generic: null, tailored: null, tables: null, key: "", fight: null, timer: null};

function getPokemon1() {
	try {
		return createPokemon($("#p1"));
	} catch (e) {
		return null;
	}
}

function getCurrentSpread() {
	var spread = emptySpread();
	SEV_STATS.forEach(function (stat) {
		spread[stat] = ~~$("#p1 ." + stat + " .evs").val();
	});
	return spread;
}

// What the tailored spread depends on: Pokémon 1 apart from its EVs, the fight and the field.
function getTailoredKey(pokemon, fight) {
	return JSON.stringify([pokemon.name, pokemon.level, pokemon.nature, pokemon.ivs, pokemon.item, pokemon.ability,
		pokemon.moves.map(function (move) {
			return move.name;
		}), pokemon.species.baseStats, pokemon.species.types, fight.key, $("#trickroom").prop("checked"),
		$("input:radio[name='weather']:checked").val(), $("input:checkbox[name='terrain']:checked").val(), battleSpeedMultiplier.p1]);
}

function renderSpreadColumn(column, spread) {
	SEV_STATS.forEach(function (stat) {
		var cell = $("#p1 tr." + stat + " .sev-" + column);
		var current = ~~$("#p1 ." + stat + " .evs").val();
		cell.text(spread ? spread[stat] : "")
			.toggleClass("sev-zero", !!spread && !spread[stat])
			.toggleClass("sev-same", !!spread && !!spread[stat] && spread[stat] === current);
	});
	$("#p1 .sev-use-" + column).prop("disabled", !spread);
}

function renderSuggestions() {
	var notes = $("#p1 .sev-notes");
	var generic = sevState.generic;
	renderSpreadColumn("generic", generic && generic.spread);
	notes.find(".sev-generic-note").text(generic ? "Generic: " + generic.role + ". Nature: " + generic.nature + "." : "");
	var fight = sevState.fight;
	$("#p1 .sev-fight-head").attr("title", fight ? "Against " + fight.name + "'s team" : "")
		.children(".sev-head-long").text(fight ? "vs " + fight.name.split(" ").pop() : "Fight");
	renderSpreadColumn("fight", sevState.tailored);
	var why = notes.find(".sev-fight-note");
	if (!fight) {
		why.text("No fight to suit EVs to here.");
		return;
	}
	if (!sevState.tailored) {
		why.text(sevState.timer ? "Working out EVs for " + fight.name + "…" : "");
		return;
	}
	var pokemon = getPokemon1();
	var attack = pokemon ? getAttackingStat(pokemon) : "at";
	var tables = sevState.tables;
	var outcomes = tables.map(function (foe) {
		return foeOutcome(foe, getSpreadAt(sevState.tailored, attack));
	});
	var now = tables.map(function (foe) {
		return foeOutcome(foe, getSpreadAt(getCurrentSpread(), attack));
	});
	var wins = function (list) {
		return list.filter(function (outcome) {
			return outcome.win;
		}).length;
	};
	why.empty().append(
		$("<summary></summary>").text("vs " + fight.name + ": wins " + wins(outcomes) + " of " + tables.length +
			" one-on-ones (your EVs now: " + wins(now) + ")"),
		$("<ul></ul>").append(tables.map(function (foe, i) {
			return $("<li></li>").text(describeOutcome(foe, outcomes[i])).toggleClass("sev-lose", !outcomes[i].win);
		})),
		$('<p class="sev-small"></p>').text("Each Pokémon on its own from full HP: your weakest roll against its strongest " +
			"move's highest, no crits or priority. Your nature, level, item, ability and moves as set above.")
	);
}

function computeTailored() {
	sevState.timer = null;
	var pokemon = getPokemon1();
	var fight = sevState.fight;
	if (!pokemon || !fight) return;
	try {
		var tables = buildFoeTables(pokemon, fight.team);
		sevState.tables = tables;
		sevState.tailored = chooseTailoredSpread(tables, getAttackingStat(pokemon));
	} catch (e) {
		sevState.tailored = null;
		sevState.tables = null;
	}
	renderSuggestions();
}

function areSuggestionsShown() {
	return !$("html").hasClass("small-screen") || $("#p1").hasClass("ss-stats-full");
}

function updateSuggestions() {
	if (!$("#p1 .sev-notes").length) return;
	var pokemon = getPokemon1();
	sevState.generic = pokemon ? getGenericSpread(pokemon) : null;
	sevState.fight = getFightTeam();
	if (!pokemon || !sevState.fight) {
		sevState.tailored = null;
		sevState.key = "";
	} else if (areSuggestionsShown()) {
		var key = getTailoredKey(pokemon, sevState.fight);
		if (key !== sevState.key) {
			sevState.key = key;
			sevState.tailored = null;
			clearTimeout(sevState.timer);
			// After the page has drawn: the search takes a moment.
			sevState.timer = setTimeout(computeTailored, 300);
		}
	}
	renderSuggestions();
}

function useSpread(spread) {
	if (!spread) return;
	var panel = $("#p1");
	if (panel.hasClass("save-locked") && typeof setSaveLock === "function") setSaveLock(panel, false);
	SEV_STATS.forEach(function (stat) {
		panel.find("." + stat + " .evs").val(spread[stat]).change();
	});
}

function buildSuggestionColumns() {
	var panel = $("#p1");
	var table = panel.find("tr.hp").closest("table");
	if (!table.length) return;
	table.addClass("sev-table");
	var evsHead = table.find("thead th").filter(function () {
		return $(this).text() === "EVs";
	});
	evsHead.after('<th scope="col" class="sev-col" title="A usual spread for its role"><span class="sev-head sev-head-long">Generic</span><span class="sev-head sev-head-short">Gen.</span></th>' +
		'<th scope="col" class="sev-col sev-fight-head"><span class="sev-head sev-head-long">Fight</span>' +
		'<span class="sev-head sev-head-short">Fight</span></th>');
	SEV_STATS.forEach(function (stat) {
		table.find("tr." + stat + " td:has(> .evs)").after('<td class="sev-col sev-generic"></td><td class="sev-col sev-fight"></td>');
	});
	var foot = $("<tfoot><tr></tr></tfoot>");
	var row = foot.find("tr");
	row.append("<th></th>");
	table.find("tr.hp > td").each(function () {
		var cell = $("<td></td>").attr("class", $(this).attr("class"));
		if ($(this).hasClass("sev-generic")) {
			cell.append($('<button type="button" class="sev-use sev-use-generic" title="Put in the generic EVs">Use</button>').click(function () {
				useSpread(sevState.generic && sevState.generic.spread);
			}));
		} else if ($(this).hasClass("sev-fight")) {
			cell.append($('<button type="button" class="sev-use sev-use-fight" title="Put in the EVs for this fight">Use</button>').click(function () {
				useSpread(sevState.tailored);
			}));
		}
		row.append(cell);
	});
	table.append(foot);
	$('<div class="sev-notes"><p class="sev-generic-note"></p><details class="sev-fight-note"></details></div>').insertAfter(table);
}

$(document).ready(function () {
	if (!$("#p1 tr.hp .evs").length || gen < 3) return;
	buildSuggestionColumns();
	$(document).on("calc:done trainer:shown", updateSuggestions);
	$(document).on("click", ".ss-stats-toggle", function () {
		setTimeout(updateSuggestions, 0);
	});
	updateSuggestions();
});
