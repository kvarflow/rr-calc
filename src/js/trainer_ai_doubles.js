/*
 * Double battles: which move each of the trainer's two Pokémon uses, and on which of yours.
 * After Complete Fire Red Upgrade's ChooseMoveOrAction_Doubles (ai_master.c): for each target the
 * AI scores its moves as in a single battle (trainer_ai.js), except that
 *  - points taken off count double (DecreaseViability);
 *  - a damaging move's bonus comes from its "doubles killing score": 4 for each foe it hits, 2 more
 *    for each it knocks out (1 if it is only the strongest move), less when it barely scratches a
 *    foe or hits its own partner, nothing for a foe the partner is already knocking out
 *    (UpdateBestDoubleKillingMoveScore), turned into points by the Pokémon's doubles role
 *    (PredictFightingStyle's doubles classes, gDoublesDamageViabilityMapping).
 * It then picks the target whose best move scored highest; between equals, the one where it
 * knocks out more, the foe that threatens it, or the most damage (ChooseTarget_Doubles).
 *
 * The first of the trainer's two (the earlier one in its team) chooses without knowing its
 * partner's move; the second knows it. The chances are sampled (the same sample every time for
 * the same battle), not enumerated as in single battles.
 *
 * Status moves follow the doubles rules too (trainer_ai.js, where it asks turn.doubles): the
 * doubles roles' bonuses, Trick Room by the sides' average Speed, Fake Out, Protect and the team's
 * guards, Follow Me, Tailwind, speed control, a sleep move on both of yours, and not repeating
 * what its partner has chosen.
 *
 * Not modelled yet: switching out, moves aimed at its own partner (Helping Hand, healing it),
 * Fly and Dig in progress, and the rarer doubles cases (pledges, terrains for a partner's
 * Expanding Force, Lucky Chant). Radical Red's own doubles code has not been checked against
 * CFRU's the way its singles code was.
 */

// PredictFightingStyle's doubles classes, as rows of DOUBLES_DAMAGE_BONUS.
var DOUBLES_CLASS = {ALL_OUT: 0, SETUP: 1, TR_ATTACKER: 2, TR_SETUP: 3, UTILITY: 4, PHAZING: 5, SUPPORT: 6, TOTAL_SUPPORT: 7};
// gDoublesDamageViabilityMapping: the bonus for a killing score of 0-12, by class.
var DOUBLES_DAMAGE_BONUS = [
	[0, 9, 9, 9, 9, 10, 11, 11, 13, 14, 16, 17, 19],
	[0, 4, 4, 4, 4, 9, 11, 11, 12, 13, 15, 16, 19],
	[0, 3, 3, 3, 3, 9, 10, 10, 11, 14, 15, 16, 18],
	[0, 1, 1, 1, 1, 1, 2, 2, 3, 4, 5, 6, 18],
	[0, 1, 1, 1, 1, 1, 1, 1, 2, 3, 8, 9, 18],
	[0, 4, 4, 4, 4, 4, 4, 4, 5, 6, 7, 8, 18],
	[0, 2, 2, 2, 2, 2, 2, 2, 2, 2, 7, 9, 16],
	[0, 2, 2, 2, 2, 2, 2, 2, 2, 2, 7, 9, 16]
];
var DOUBLES_HIT_FOE = 4;
var DOUBLES_KO_FOE = 2;
var DOUBLES_STRONGEST = 1;
var DOUBLES_HIT_PARTNER = 3;
var DOUBLES_DESTINY_BOND = 2;
var DOUBLES_SAMPLES = 240;

function isSpreadMove(move) {
	return (move.target & (MOVE_TARGET_BOTH | MOVE_TARGET_FOES_AND_ALLY)) !== 0;
}

// A move aimed at one Pokémon (not a spread move, nor one for itself, its side or the field).
function isAimedAtOne(move) {
	return !isSpreadMove(move) && !isSelfTargeting(move) && (move.target & MOVE_TARGET_FOES_FIELD) === 0 &&
		!has([E.PROTECT, E.FIELD_EFFECTS, E.TEAM_EFFECTS, E.SET_TERRAIN, E.RAIN_DANCE, E.SUNNY_DAY, E.SANDSTORM, E.HAIL, E.REFLECT, E.LIGHT_SCREEN,
			E.SPIKES, E.FOLLOW_ME], move.effect);
}

function hitsPartnerToo(move) {
	return (move.target & MOVE_TARGET_FOES_AND_ALLY) !== 0;
}

// PredictFightingStyle, doubles.
function doublesClass(side) {
	var attacks = 0;
	var boosts = 0;
	var trickRoom = false;
	var phazing = false;
	var redirection = false;
	var teamSupport = false;
	var pivot = false;
	var protect = false;
	var fakeOut = false;
	side.moves.forEach(function (move) {
		if (!move) return;
		if (move.name === "Trick Room") {
			trickRoom = true;
		} else if (has([E.ATTACK_UP, E.SPEED_UP, E.SPECIAL_ATTACK_UP, E.ACCURACY_UP, E.ATTACK_UP_2, E.SPEED_UP_2, E.SPECIAL_ATTACK_UP_2,
			E.ACCURACY_UP_2, E.DRAGON_DANCE, E.CALM_MIND, E.BULK_UP, E.ATK_ACC_UP], move.effect)) {
			boosts++;
		} else if (move.effect === E.ATK_SPATK_UP) {
			if (!(move.name === "Rototiller" && side.types.indexOf("Grass") === -1) &&
				!(move.name === "Gear Up" && !has(["Plus", "Minus"], side.ability))) boosts++;
		} else if (has([E.ROAR, E.HAZE, E.REMOVE_TARGET_STAT_CHANGES], move.effect)) {
			phazing = true;
		} else if (move.effect === E.FOLLOW_ME) {
			redirection = true;
		} else if (has([E.REFLECT, E.LIGHT_SCREEN, E.HEAL_BELL, E.SAFEGUARD, E.MIST], move.effect) ||
			(move.effect === E.TEAM_EFFECTS && move.name !== "Magnet Rise")) {
			teamSupport = true;
		} else if (move.effect === E.BATON_PASS && move.name !== "Baton Pass") {
			pivot = true;
		} else if (move.effect === E.SUPERPOWER && side.item === "Eject Pack" && move.name !== "Hyperspace Hole") {
			pivot = true;
		} else if (move.name === "Fake Out") {
			fakeOut = true;
		} else if (move.effect === E.PROTECT && !has(["Quick Guard", "Wide Guard", "Crafty Shield", "Mat Block", "Endure"], move.name)) {
			protect = true;
		}
		if (move.split !== SPLIT_STATUS && move.name !== "Nuzzle" && move.name !== "Fake Out") attacks++;
	});
	var slowItem = has(["Room Service", "Iron Ball", "Macho Brace"], side.item);
	if (trickRoom) return attacks <= 1 ? DOUBLES_CLASS.TR_SETUP : DOUBLES_CLASS.TR_ATTACKER;
	if (redirection || (side.ability === "Intimidate" && fakeOut) || (fakeOut && pivot)) return DOUBLES_CLASS.UTILITY;
	if (phazing) return attacks === 3 || (attacks === 2 && protect) ? DOUBLES_CLASS.SETUP : DOUBLES_CLASS.PHAZING;
	if (attacks >= 4 || (attacks === 3 && protect)) return slowItem ? DOUBLES_CLASS.TR_ATTACKER : DOUBLES_CLASS.ALL_OUT;
	if (attacks + boosts >= 3 || (attacks + boosts === 2 && protect)) return slowItem ? DOUBLES_CLASS.TR_ATTACKER : DOUBLES_CLASS.SETUP;
	if (teamSupport) return attacks <= 1 ? DOUBLES_CLASS.TOTAL_SUPPORT : DOUBLES_CLASS.SUPPORT;
	return DOUBLES_CLASS.UTILITY;
}

function isDoublesAttacker(cls) {
	return cls === DOUBLES_CLASS.ALL_OUT || cls === DOUBLES_CLASS.TR_ATTACKER || cls === DOUBLES_CLASS.SETUP;
}

/*
 * One sample of the turn. `d` is the battle (readAIDoublesBattle): d.foes[x] and d.yours[y] say who
 * is out (null: nobody), d.out[x][y] is the trainer's Pokémon x built against yours y (its moves'
 * damage on y), d.inc[y][x] yours y against it.
 */
function DoublesTurn(rng, d) {
	this.rng = rng;
	this.d = d;
	this.turns = {};
	this.killing = {};
	this.chosen = [null, null]; // what each of the trainer's Pokémon has chosen: {index, move, target}
}

DoublesTurn.prototype.alive = function (side) {
	return !!side && side.hp > 0;
};

// The single-battle thinking for the trainer's x against yours y, with your predicted move on it.
DoublesTurn.prototype.turn = function (x, y) {
	var key = x + "/" + y;
	if (this.turns[key]) return this.turns[key];
	var d = this.d;
	var turn = new AITurn(this.rng, {ai: d.out[x][y], player: d.inc[y][x], field: d.field, trickRoom: d.trickRoom,
		flags: d.flags, party: [], justSwitchedIn: false});
	this.turns[key] = turn;
	predictPlayer(turn);
	return turn;
};

DoublesTurn.prototype.damage = function (x, y, i) {
	var d = this.d;
	return finalDamage(this.turn(x, y), d.out[x][y], d.inc[y][x], i, 1);
};

DoublesTurn.prototype.knocksOut = function (x, y, i) {
	var d = this.d;
	return knocksOut(this.turn(x, y), d.out[x][y], d.inc[y][x], i, 1);
};

// Would the trainer's x hurt its own partner with a move that hits everyone around it?
DoublesTurn.prototype.hurtsPartner = function (x, move) {
	var partner = this.d.foes[1 - x];
	if (!this.alive(partner) || partner.ability === "Telepathy") return false;
	if (typeEffectiveness(move.type, partner.types) === 0) return false;
	var absorbs = {Ground: ["Levitate", "Earth Eater"], Fire: ["Flash Fire", "Well-Baked Body"], Water: ["Water Absorb", "Storm Drain", "Dry Skin"],
		Electric: ["Volt Absorb", "Lightning Rod", "Motor Drive"], Grass: ["Sap Sipper"]}[move.type] || [];
	if (has(absorbs, partner.ability) || (move.sound && partner.ability === "Soundproof")) return false;
	return !(move.type === "Ground" && partner.item === "Air Balloon");
};

// A damaging move that still earns its points when it does little: its side effect is likely and wanted.
DoublesTurn.prototype.effectIsWorthIt = function (x, y, move) {
	var d = this.d;
	var atk = d.out[x][y];
	var def = d.inc[y][x];
	var turn = this.turn(x, y);
	var likely = chanceOf(atk, move) >= 50;
	switch (move.effect) {
	case E.FLINCH_HIT:
		return hitsFirst(turn, atk, move, def);
	case E.PARALYZE_HIT:
		return likely && canBeParalyzed(atk, def, d.field);
	case E.BURN_HIT:
		return likely && canBeBurned(atk, def, d.field);
	case E.POISON_HIT:
	case E.BAD_POISON_HIT:
		return likely && canBePoisoned(atk, def, d.field);
	case E.ATTACK_DOWN_HIT:
		return likely && goodIdeaToLower(turn, def, atk, move, "atk");
	case E.DEFENSE_DOWN_HIT:
		return likely && goodIdeaToLower(turn, def, atk, move, "def");
	case E.SPECIAL_ATTACK_DOWN_HIT:
		return likely && goodIdeaToLower(turn, def, atk, move, "spa");
	case E.SPECIAL_DEFENSE_DOWN_HIT:
	case E.SPECIAL_DEFENSE_DOWN_2_HIT:
		return likely && goodIdeaToLower(turn, def, atk, move, "spd");
	case E.SPEED_DOWN_HIT:
		return likely && goodIdeaToLower(turn, def, atk, move, "spe");
	case E.ACCURACY_DOWN_HIT:
		return likely && goodIdeaToLower(turn, def, atk, move, "acc");
	case E.EVASION_DOWN_HIT:
		return likely && goodIdeaToLower(turn, def, atk, move, "eva");
	case E.CONFUSE_HIT:
		return likely && canBeConfused(atk, def, d.field);
	case E.SPEED_UP_1_HIT:
	case E.ATTACK_UP_HIT:
	case E.SPECIAL_ATTACK_UP_HIT:
		return likely;
	}
	return false;
};

/*
 * UpdateBestDoubleKillingMoveScore: the move of the trainer's x that does the most to your side
 * when aimed at y, and its score: {index, total}. Worked out again once the partner has chosen.
 */
DoublesTurn.prototype.bestKilling = function (x, y) {
	var key = x + "/" + y + "/" + (this.chosen[1 - x] ? 1 : 0);
	if (this.killing[key]) return this.killing[key];
	var d = this.d;
	var self = this;
	var atk = d.out[x][y];
	var other = 1 - y;
	var targets = [y, other];
	var alive = [this.alive(d.yours[y]), this.alive(d.yours[other])];
	var foesAlive = (alive[0] ? 1 : 0) + (alive[1] ? 1 : 0);
	var partner = d.foes[1 - x];
	var partnerChoice = this.alive(partner) ? this.chosen[1 - x] : null;
	var partnerMove = partnerChoice && !isIncapacitated(partner) ? partnerChoice.move : null;
	var handling = [false, false];

	// 75% of turns the AI minds a foe's Wide Guard.
	var wideGuard = this.rng.pick([0.75, 0.25]) === 0 && [0, 1].some(function (j) {
		var foe = d.yours[targets[j]];
		return alive[j] && hasMoveNamed(foe, ["Wide Guard"]) && !isIncapacitated(foe);
	});

	// What the partner is already taking care of.
	if (partnerMove && foesAlive >= 2) {
		if (!isSpreadMove(partnerMove)) {
			if (partnerChoice.target !== null && this.knocksOut(1 - x, partnerChoice.target, partnerChoice.index)) {
				handling[targets.indexOf(partnerChoice.target)] = true;
			}
		} else {
			[0, 1].forEach(function (j) {
				if (alive[j] && self.knocksOut(1 - x, targets[j], partnerChoice.index)) handling[j] = true;
			});
			// It can't count on a slow spread move having cleared the field.
			if (handling[0] && handling[1] && priorityOf(partner, partnerMove, d.field) <= 0 &&
				(partner.speed < d.yours[0].speed || partner.speed < d.yours[1].speed)) handling[0] = false;
		}
	}

	var scores = [];
	for (var i = 0; i < 4; i++) {
		var move = atk.moves[i];
		scores[i] = 0;
		if (!move) break;
		if (move.split === SPLIT_STATUS || !isUsable(atk, i, d.field)) continue;
		var spread = isSpreadMove(move);
		if (wideGuard && spread) continue;
		for (var j = 0; j < 2; j++) {
			var t = targets[j];
			if (!alive[j] || (j === 1 && !spread) || handling[j]) continue;
			var dmg = this.damage(x, t, i);
			if (dmg <= 0) continue;
			var foe = d.inc[t][x];
			scores[i] += DOUBLES_HIT_FOE;
			if (this.knocksOut(x, t, i)) {
				scores[i] += DOUBLES_KO_FOE;
				if (volatileOf(foe).destinyBond) scores[i] -= DOUBLES_DESTINY_BOND;
			} else if (isStrongest(this.turn(x, t), d.out[x][t], foe, i)) {
				scores[i] += DOUBLES_STRONGEST;
			} else if (!this.effectIsWorthIt(x, t, d.out[x][t].moves[i]) && foesAlive >= 2) {
				// It barely scratches this foe: nearly as if it had not hit it.
				if (dmg < Math.floor(foe.maxHP / 4)) scores[i] -= DOUBLES_HIT_FOE - 1;
				else if (dmg < Math.floor(foe.maxHP / 3)) scores[i] -= DOUBLES_HIT_FOE - 2;
			}
		}
		// Earthquake and the like: not onto its own partner, unless it protects.
		if (hitsPartnerToo(move) && this.hurtsPartner(x, move)) {
			var safe = false;
			if (!isAsleep(partner)) {
				if (partnerMove) {
					safe = partnerMove.effect === E.PROTECT && !has(["Quick Guard", "Crafty Shield"], partnerMove.name) &&
						(partnerMove.name !== "Mat Block" || partner.firstTurn);
				} else if (!partnerChoice) {
					var partnerLast = lastMoveOf(partner);
					safe = hasMoveNamed(partner, ["Wide Guard", "Mat Block"]) &&
						!(partnerLast && partnerLast.effect === E.PROTECT && volatileOf(partner).protectUses >= 1);
				}
			}
			if (!safe) scores[i] -= DOUBLES_HIT_PARTNER;
		}
	}
	var best = 0;
	for (var k = 1; k < 4; k++) {
		if (!atk.moves[k]) break;
		if (scores[k] > scores[best]) {
			best = k;
		} else if (scores[k] === scores[best] && atk.moves[best] && hitsPartnerToo(atk.moves[best]) && !hitsPartnerToo(atk.moves[k]) &&
			(atk.moves[k].target & MOVE_TARGET_BOTH) && this.hurtsPartner(x, atk.moves[best])) {
			// Between equals, the one that only hits your side.
			best = k;
		}
	}
	this.killing[key] = {index: best, total: scores[best]};
	return this.killing[key];
};

// GetDoubleKillingScore: the score of the best move, nothing for the others.
DoublesTurn.prototype.killingScore = function (x, y, i) {
	var best = this.bestKilling(x, y);
	return i === best.index ? Math.max(0, Math.min(12, best.total)) : 0;
};

// The partner has chosen a damaging move that lands on yours y.
DoublesTurn.prototype.partnerDamages = function (x, y) {
	var partner = this.d.foes[1 - x];
	var choice = this.chosen[1 - x];
	if (!this.alive(partner) || !choice || !choice.move || choice.move.split === SPLIT_STATUS) return null;
	if (volatileOf(partner).confused || volatileOf(partner).infatuated || partner.status === "par") return null;
	return choice.target === y || isSpreadMove(choice.move) ? choice : null;
};

// PartnerWillKOTargetBeforeItCanAttack.
DoublesTurn.prototype.partnerKOsFirst = function (x, y) {
	var choice = this.partnerDamages(x, y);
	if (!choice) return false;
	var d = this.d;
	var p = 1 - x;
	if (!this.knocksOut(p, y, choice.index)) return false;
	return hitsFirst(this.turn(p, y), d.out[p][y], d.out[p][y].moves[choice.index], d.inc[y][p]);
};

// GetTargetsKnockedOut: how many of yours a move takes out, alone or with the partner's hit before it.
DoublesTurn.prototype.targetsKnockedOut = function (x, y, i) {
	var d = this.d;
	var self = this;
	var move = d.out[x][y].moves[i];
	var count = 0;
	var check = function (t) {
		if (!self.alive(d.yours[t])) return;
		if (self.knocksOut(x, t, i)) {
			count++;
			return;
		}
		var choice = self.partnerDamages(x, t);
		if (!choice || move.effect === E.SUPER_FANG) return;
		var p = 1 - x;
		if (!hitsFirst(self.turn(p, t), d.out[p][t], d.out[p][t].moves[choice.index], d.inc[t][p])) return;
		var partnerDamage = self.damage(p, t, choice.index);
		var hp = d.yours[t].hp;
		if (partnerDamage < hp && self.damage(x, t, i) + partnerDamage >= hp) count++;
	};
	check(y);
	if (isSpreadMove(move)) check(1 - y);
	return count;
};

// GetTotalDamageForTargets: the damage as a share of the target's HP (the other's too, for a spread move).
DoublesTurn.prototype.totalDamage = function (x, y, i) {
	var d = this.d;
	var max = d.yours[y].maxHP;
	var percent = Math.floor(this.damage(x, y, i) * 100 / max);
	if (isSpreadMove(d.out[x][y].moves[i]) && this.alive(d.yours[1 - y])) percent += Math.floor(this.damage(x, 1 - y, i) * 100 / max);
	return percent;
};

/*
 * What trainer_ai.js asks about the double battle while the trainer's x scores its moves against
 * yours y (turn.doubles): its doubles role, its partner and what the partner has chosen, and the
 * rules that differ from a single battle.
 */
DoublesTurn.prototype.context = function (x, y) {
	var d = this.d;
	var self = this;
	var me = d.out[x][y];
	var foe = d.inc[y][x];
	var partner = this.alive(d.foes[1 - x]) ? d.foes[1 - x] : null;
	var choice = partner ? this.chosen[1 - x] : null;
	var partnerMove = choice && choice.move ? choice.move : null;
	var otherFoe = this.alive(d.yours[1 - y]) ? d.inc[1 - y][x] : null;
	var cls = doublesClass(d.foes[x]);
	return {
		cls: cls,
		partner: partner,
		// The points a damaging move gets for its doubles killing score.
		bonus: function (i) {
			return DOUBLES_DAMAGE_BONUS[cls][self.killingScore(x, y, i)];
		},
		partnerUses: function (names) {
			return !!partnerMove && has(names, partnerMove.name);
		},
		partnerUsesStatus: function () {
			return !!partnerMove && partnerMove.split === SPLIT_STATUS;
		},
		// The partner has chosen a move of the same effect (with `sameTarget`: on this target, or one
		// that is not aimed at a single Pokémon).
		partnerSameEffect: function (move, sameTarget) {
			if (!partnerMove || partnerMove.effect !== move.effect) return false;
			if (!sameTarget) return true;
			return choice.target === y || isSpreadMove(partnerMove) || isSelfTargeting(partnerMove) ||
				(partnerMove.target & MOVE_TARGET_FOES_FIELD) !== 0;
		},
		// GetPokemonOnSideSpeedAverage: the trainer's side (mine) or yours.
		sideSpeed: function (mine) {
			var sides = mine ? [me, partner] : [foe, otherFoe];
			var alive = sides.filter(Boolean);
			return Math.floor(alive.reduce(function (sum, side) {
				return sum + side.speed;
			}, 0) / alive.length);
		},
		// IncreaseViabilityForSpeedControl: the supporting roles slow down a foe that outspeeds either of them.
		speedControl: function (up) {
			if (d.trickRoom || !(foe.speed >= me.speed || (partner && foe.speed >= partner.speed))) return false;
			if (cls !== DOUBLES_CLASS.UTILITY && cls !== DOUBLES_CLASS.SUPPORT && cls !== DOUBLES_CLASS.TOTAL_SUPPORT) return false;
			up(11);
			return true;
		},
		// The partner has chosen a move that hits everyone around it, this Pokémon included.
		partnerHitsMe: function () {
			return !!partnerMove && hitsPartnerToo(partnerMove) && me.ability !== "Telepathy" && self.hurtsPartner(1 - x, partnerMove);
		},
		partnerKillingScore: function () {
			return partnerMove && choice.target !== null ? self.killingScore(1 - x, choice.target, choice.index) : 0;
		},
		// IncreaseFakeOutViability: by role, a point less when the other of yours is the bigger threat,
		// nothing when its partner is already using Fake Out on this one.
		fakeOutBonus: function (style) {
			var partnerFakesOut = function (t) {
				return !!partnerMove && partnerMove.name === "Fake Out" && choice.target === t;
			};
			if (partnerFakesOut(y)) return 0;
			var decrement = 0;
			if (otherFoe && !partnerFakesOut(1 - y)) {
				var threat = function (t) {
					var count = canKnockOut(self.turn(x, t), d.inc[t][x], d.out[x][t]) ? 1 : 0;
					if (partner && canKnockOut(self.turn(1 - x, t), d.inc[t][1 - x], d.out[1 - x][t])) count++;
					return count;
				};
				if (threat(1 - y) > threat(y) && typeEffectiveness("Normal", foe.types) !== 0) decrement = 1;
			}
			if (style === STYLE.D_TR_ATTACKER && d.trickRoom) return 0;
			return ({11: 15, 12: 15, 13: 17, 14: 17, 15: 19, 16: 19, 17: 17, 18: 17}[style] || 8) - decrement;
		},
		// A sleep move that would put both of yours to sleep.
		spreadSleep: function (move) {
			return !!otherFoe && isSpreadMove(move) && canBeSlept(me, otherFoe, d.field) && !moveBlockedBySubstitute(me, otherFoe, move);
		},
		// Your predicted move against its partner.
		predictedOnPartner: function () {
			if (!partner) return null;
			return self.turn(1 - x, y).predicted(d.inc[y][1 - x]);
		}
	};
};

// The best move of the trainer's x against yours y, and its points (a tie is broken at random).
DoublesTurn.prototype.bestMoveAgainst = function (x, y) {
	var d = this.d;
	var self = this;
	var turn = this.turn(x, y);
	turn.doubles = this.context(x, y);
	var scores = runScripts(turn, d.out[x][y], d.inc[y][x], d.flags, true);
	turn.doubles = null;
	var moves = d.out[x][y].moves;
	var best = scores[0] & 0xFF;
	var ties = [0];
	for (var i = 1; i < 4; i++) {
		if (!moves[i]) continue;
		if (best === scores[i]) {
			ties.push(i);
		} else if (best < scores[i]) {
			best = scores[i] & 0xFF;
			ties = [i];
		}
	}
	var index = ties.length === 1 ? ties[0] : ties[this.rng.pick(ties.map(function () {
		return 1 / ties.length;
	}))];
	return {index: moves[index] ? index : null, points: best};
};

/*
 * ChooseMoveOrAction_Doubles and ChooseTarget_Doubles for the trainer's x: {index, target} (the
 * move's place and which of yours it is aimed at), or null when it has nothing to do.
 */
DoublesTurn.prototype.choose = function (x) {
	var d = this.d;
	var self = this;
	var me = d.foes[x];
	if (!this.alive(me) || isIncapacitated(me)) return null;
	var forced = forcedMoveIndex(me);
	var picks = [0, 1].map(function (y) {
		return self.alive(d.yours[y]) ? self.bestMoveAgainst(x, y) : {index: null, points: -1};
	});
	if (forced !== undefined) {
		if (forced === null) return null;
		picks.forEach(function (pick) {
			if (pick.points >= 0) pick.index = forced;
		});
	}
	var moveFor = function (y) {
		return picks[y].index === null ? null : d.out[x][y].moves[picks[y].index];
	};
	var cls = doublesClass(me);
	var attacker = isDoublesAttacker(cls);
	var smart = (d.flags & AI_POSITIVES) !== 0;
	var tryKO = d.flags <= AI_NEGATIVES || attacker;
	var tryMost = !smart || (attacker && this.rng.pick([0.25, 0.75]) === 0);
	var tryDanger = smart && attacker;

	var most = picks[0].points;
	var viable = [0];
	var usingDefault = true;
	var bestTarget = 0;
	var bestKOs = 0;
	var bestDamage = 0;
	var statusOption = false;
	var first = moveFor(0);
	if (first) {
		if (first.split !== SPLIT_STATUS) {
			if (tryKO) bestKOs = this.targetsKnockedOut(x, 0, picks[0].index);
			if (tryMost || tryDanger) bestDamage = this.totalDamage(x, 0, picks[0].index);
		} else {
			statusOption = true;
		}
	}
	var uselessStatus = function (y) {
		var move = moveFor(y);
		return !!move && move.split === SPLIT_STATUS && !isSpreadMove(move) && !isSelfTargeting(move) && self.partnerKOsFirst(x, y);
	};
	(function () {
		var y = 1;
		var move = moveFor(y);
		var wastedStatus = !!move && move.split === SPLIT_STATUS && move.name !== "Quash" && self.partnerKOsFirst(x, y);
		if (picks[y].points === most) {
			statusOption = statusOption || (!!move && move.split === SPLIT_STATUS);
			if (move && move.split !== SPLIT_STATUS) {
				var kos = tryKO ? self.targetsKnockedOut(x, y, picks[y].index) : 0;
				var damage = tryMost || tryDanger ? self.totalDamage(x, y, picks[y].index) : 0;
				// "add": as good a target; "skip": worse; "replace": better.
				var mostDamageRule = function () {
					if (!tryMost) return "add";
					return damage < bestDamage ? "skip" : damage === bestDamage ? "add" : "replace";
				};
				var dangerRule = function () {
					var thisCan = canKnockOut(self.turn(x, y), d.inc[y][x], d.out[x][y]);
					var bestCan = canKnockOut(self.turn(x, bestTarget), d.inc[bestTarget][x], d.out[x][bestTarget]);
					if (!smart) return "add";
					if (!thisCan && bestCan) return "skip";
					if (thisCan && bestCan) {
						var thisMega = /-Mega|-Primal/.test(d.yours[y].name);
						var bestMega = /-Mega|-Primal/.test(d.yours[bestTarget].name);
						if (!thisMega && bestMega) return "skip";
						return thisMega === bestMega ? "add" : "replace";
					}
					return !thisCan && !bestCan ? mostDamageRule() : "replace";
				};
				var verdict;
				if (!tryKO) verdict = tryDanger && damage >= 50 && bestDamage >= 50 ? dangerRule() : mostDamageRule();
				else if (kos < bestKOs) verdict = "skip";
				else if (kos > bestKOs) verdict = "replace";
				else if (kos > 0) verdict = tryDanger ? dangerRule() : "add";
				else verdict = tryDanger && damage >= 50 && bestDamage >= 50 ? dangerRule() : mostDamageRule();
				if (verdict === "skip") return;
				if (verdict === "replace") {
					// Status moves stay options; the damaging choices give way to this one.
					viable = statusOption ? viable.filter(function (t) {
						var m = moveFor(t);
						return !m || m.split === SPLIT_STATUS;
					}).concat([y]) : [y];
					bestTarget = y;
					bestKOs = kos;
					bestDamage = damage;
					usingDefault = false;
					return;
				}
			} else if (wastedStatus) {
				// No status move onto a foe the partner knocks out first, unless the default is as useless.
				if (!usingDefault || !uselessStatus(viable[0])) return;
			}
			viable.push(y);
			usingDefault = false;
		} else if (picks[y].points > most) {
			if (most >= 0 && wastedStatus && (!usingDefault || !uselessStatus(viable[0]))) return;
			viable = [y];
			most = picks[y].points;
			usingDefault = false;
		}
	})();
	var target = viable.length === 1 ? viable[0] : viable[this.rng.pick(viable.map(function () {
		return 1 / viable.length;
	}))];
	if (picks[target].index === null) return null;
	return {index: picks[target].index, move: moveFor(target), target: target, points: picks[target].points};
};

// A small seeded generator, so the same battle always shows the same chances.
function seededPicker(seed) {
	var state = seed >>> 0;
	var next = function () {
		state = (state + 0x6D2B79F5) >>> 0;
		var t = state;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
	return {
		pick: function (probabilities) {
			var roll = next();
			for (var i = 0; i < probabilities.length; i++) {
				roll -= probabilities[i];
				if (roll < 0) return i;
			}
			return probabilities.length - 1;
		}
	};
}

/*
 * The chances for both of the trainer's Pokémon: [{shares: [[to yours 0, to yours 1] for each
 * move], none: the chance it does nothing}], for d.foes[0] and d.foes[1].
 */
function predictAIDoubles(d) {
	var result = [0, 1].map(function () {
		return {shares: [[0, 0], [0, 0], [0, 0], [0, 0]], none: 0};
	});
	// The earlier Pokémon in the trainer's team chooses first.
	var order = d.foes[1] && d.foes[0] && d.foes[1].slot < d.foes[0].slot ? [1, 0] : [0, 1];
	var rng = seededPicker(0x52524443);
	for (var n = 0; n < DOUBLES_SAMPLES; n++) {
		var turn = new DoublesTurn(rng, d);
		order.forEach(function (x) {
			if (!d.foes[x]) return;
			var choice = turn.choose(x);
			turn.chosen[x] = choice || {index: null, move: null, target: null};
			if (choice) result[x].shares[choice.index][choice.target] += 1 / DOUBLES_SAMPLES;
			else result[x].none += 1 / DOUBLES_SAMPLES;
		});
	}
	return result;
}

/* ---------------------------------------------------------------------------------------------
 * The page: who is out beside the two Pokémon in the panels, and the Doubles dialog.
 */
// The second Pokémon on each side, for the fight they were chosen in: yours (a set id from your
// team) and the trainer's (a place in its team), each with its HP as a percentage.
var doublesPartners = {fight: null, yours: "", yoursHP: 100, foe: null, foeHP: 100};

function isDoublesFight() {
	return typeof currentBattleEffect === "string" && /Doubles/i.test(currentBattleEffect) &&
		typeof TRAINER_ORDER !== "undefined" && !!TRAINER_ORDER[currentTrainerIndex];
}

function getDoublesPartners() {
	if (doublesPartners.fight !== currentTrainerIndex) doublesPartners = {fight: currentTrainerIndex, yours: "", yoursHP: 100, foe: null, foeHP: 100};
	return doublesPartners;
}

// The trainer's Pokémon that can be out beside the one in Pokémon 2: [{slot, setId}].
function getDoublesFoeOptions() {
	var kos = typeof getKOSlots === "function" ? getKOSlots(currentTrainerIndex) : [];
	return getTrainerVariant(TRAINER_ORDER[currentTrainerIndex]).sets.map(function (setId, slot) {
		return {slot: slot, setId: setId};
	}).filter(function (option) {
		return option.slot !== activeTrainerSlot && kos.indexOf(option.slot) === -1;
	});
}

// Your team's other Pokémon (set ids), without the one in Pokémon 1 or the fainted.
function getDoublesYourOptions() {
	if (typeof resolveBoxLayout !== "function") return [];
	var current = $("#p1 input.set-selector").val();
	var record = typeof readRunRecord === "function" ? readRunRecord() : null;
	return resolveBoxLayout(readCustomSets(), readBoxLayout()).team.filter(function (setId) {
		return setId !== current && !(record && getRunMon(setId, record).fainted);
	});
}

// The partners in play: the ones chosen, else the next of each team.
function resolveDoublesPartners() {
	var chosen = getDoublesPartners();
	var foes = getDoublesFoeOptions();
	var yours = getDoublesYourOptions();
	var foe = foes.filter(function (option) {
		return option.slot === chosen.foe;
	})[0] || (chosen.foe === "none" ? null : foes[0]) || null;
	var mine = yours.indexOf(chosen.yours) !== -1 ? chosen.yours : chosen.yours === "none" ? "" : yours[0] || "";
	return {foe: foe, yours: mine, foeHP: chosen.foeHP, yoursHP: chosen.yoursHP};
}

function createDoublesPartner(setId, hpPercent) {
	var pokemon = createPokemon(setId);
	if (hpPercent < 100) pokemon.originalCurHP = Math.max(1, Math.floor(pokemon.maxHP() * hpPercent / 100));
	return pokemon;
}

// A Pokémon's speed in battle without a panel to read it from: its item and paralysis.
function doublesPartnerSpeed(pokemon) {
	var speed = pokemon.stats.spe;
	if (pokemon.item === "Choice Scarf") speed = Math.floor(speed * 1.5);
	if (pokemon.item === "Iron Ball") speed = Math.floor(speed / 2);
	if (pokemon.status === "par" && pokemon.ability !== "Quick Feet") speed = Math.floor(speed / 2);
	return speed;
}

/*
 * The double battle as the AI sees it: the two Pokémon in the panels and each side's partner.
 * null when it is not a double battle, or only one Pokémon is left on each side (the AI then
 * plays it as a single battle).
 */
function readAIDoublesBattle() {
	if (!isDoublesFight() || !damageResults || !damageResults[1][0]) return null;
	var partners = resolveDoublesPartners();
	if (!partners.foe && !partners.yours) return null;
	var aiField = damageResults[1][0].field;
	var playerField = damageResults[0][0].field;
	var focus = {p1: $("#focusEnergyL").prop("checked"), p2: $("#focusEnergyR").prop("checked")};
	var foeMons = [damageResults[1][0].attacker, partners.foe ? createDoublesPartner(partners.foe.setId, partners.foeHP) : null];
	var yourMons = [damageResults[0][0].attacker, partners.yours ? createDoublesPartner(partners.yours, partners.yoursHP) : null];
	var foeLeft = countFoeMonsLeft();
	var yoursLeft = countYourMonsLeft();
	var sideStates = {foe: readSideState("R"), yours: readSideState("L")};
	var d = {foes: [null, null], yours: [null, null], out: [[null, null], [null, null]], inc: [[null, null], [null, null]],
		results: [[null, null], [null, null]], field: aiField, trickRoom: $("#trickroom").prop("checked"), flags: getAIFlags(),
		foeSlots: [activeTrainerSlot, partners.foe ? partners.foe.slot : null], yourSets: [$("#p1 input.set-selector").val(), partners.yours]};
	var build = function (key, pokemon, results, foe, options) {
		var side = buildAISide(key, pokemon, results, foe, $.extend({
			critChance: function (move) {
				return typeof getCritChance === "function" ? getCritChance(pokemon, foe, move, options.focusEnergy) || 0 : 0;
			},
			critDamage: function (i) {
				return maxCritRoll(results[i]);
			}
		}, options));
		side.isPlayer = key.charAt(0) === "y";
		return side;
	};
	for (var x = 0; x < 2; x++) {
		for (var y = 0; y < 2; y++) {
			var foe = foeMons[x];
			var mine = yourMons[y];
			if (!foe || !mine) continue;
			var out = [];
			var inc = [];
			for (var m = 0; m < 4; m++) {
				out[m] = x === 0 && y === 0 ? damageResults[1][m] : calc.calculate(gen, foe, mine, foe.moves[m], aiField);
				inc[m] = x === 0 && y === 0 ? damageResults[0][m] : calc.calculate(gen, mine, foe, mine.moves[m], playerField);
			}
			d.results[x][y] = out;
			d.out[x][y] = build("f" + x, foe, out, mine, {
				speed: x === 0 ? getBattleSpeed(foe, "p2") : doublesPartnerSpeed(foe), monsLeft: foeLeft,
				firstTurn: foe.curHP() === foe.maxHP(), sideState: sideStates.foe, focusEnergy: x === 0 && focus.p2,
				vol: x === 0 && typeof getBattleVolatile === "function" ? getBattleVolatile("p2") : null
			});
			d.out[x][y].slot = d.foeSlots[x];
			d.inc[y][x] = build("y" + y, mine, inc, foe, {
				speed: y === 0 ? getBattleSpeed(mine, "p1") : doublesPartnerSpeed(mine), monsLeft: yoursLeft,
				firstTurn: mine.curHP() === mine.maxHP(), sideState: sideStates.yours, focusEnergy: y === 0 && focus.p1,
				vol: y === 0 && typeof getBattleVolatile === "function" ? getBattleVolatile("p1") : null
			});
			d.foes[x] = d.foes[x] || d.out[x][y];
			d.yours[y] = d.yours[y] || d.inc[y][x];
		}
	}
	return d;
}

// The doubles prediction for the battle on the page (kept until the next calculation).
var doublesPrediction = null;

function getDoublesPrediction() {
	if (doublesPrediction) return doublesPrediction;
	var d = null;
	try {
		d = readAIDoublesBattle();
	} catch (e) {
		d = null;
	}
	doublesPrediction = d ? {battle: d, foes: predictAIDoubles(d)} : {battle: null, foes: null};
	return doublesPrediction;
}

$(document).on("calc:done", function () {
	doublesPrediction = null;
	if ($(".dbl-backdrop").length) drawDoublesDialog();
});

function shortSetName(setId) {
	return (setId || "").replace(/ \(.*/, "");
}

function recalculateDoubles() {
	doublesPrediction = null;
	if (typeof performCalculations === "function") performCalculations();
}

// One of the trainer's two: its moves, the damage to each of yours and how often it goes for each.
function buildDoublesFoeTable(prediction, x) {
	var d = prediction.battle;
	var side = d.foes[x];
	var shares = prediction.foes[x].shares;
	var best = 0;
	shares.forEach(function (pair, i) {
		var both = side.moves[i] && !isAimedAtOne(side.moves[i]) && d.yours[0] && d.yours[1];
		best = both ? Math.max(best, pair[0] + pair[1]) : Math.max(best, pair[0], pair[1]);
	});
	var table = $('<table class="dbl-table"></table>');
	var head = $("<tr></tr>").append($("<th></th>").text(shortMonName(side)));
	[0, 1].forEach(function (y) {
		if (d.yours[y]) head.append($('<th class="dbl-target"></th>').text("→ " + shortSetName(d.yourSets[y])));
	});
	table.append(head);
	side.moves.forEach(function (move, i) {
		if (!move) return;
		var row = $("<tr></tr>").append($('<td class="dbl-move"></td>').text(move.name + (isSpreadMove(move) ? " ⤳" : ""))
			.attr("title", isSpreadMove(move) ? "Hits both of yours" + (hitsPartnerToo(move) ? " and its partner" : "") : null));
		// A spread move hits both of yours, and a move like Trick Room or Protect has no target: one chance
		// (with the damage to each for an attack).
		var spread = !isAimedAtOne(move) && d.yours[0] && d.yours[1];
		var total = shares[i][0] + shares[i][1];
		[0, 1].forEach(function (y) {
			if (!d.yours[y]) return;
			var result = d.results[x][y][i];
			var range = result.range();
			var max = d.yours[y].maxHP;
			var share = spread ? total : shares[i][y];
			var cell = $('<td class="dbl-cell"></td>').toggleClass("dbl-likely", share > 0 && share >= best)
				.toggleClass("dbl-ko", range[1] >= d.yours[y].hp && move.split !== SPLIT_STATUS);
			cell.append($('<span class="dbl-share"></span>').text(spread && y === 1 ? (isSpreadMove(move) ? "\u2190" : "") : formatAIShare(share))
				.attr("title", spread && isSpreadMove(move) ? "It hits both of yours" : null));
			if (move.split !== SPLIT_STATUS) {
				cell.append($('<span class="dbl-damage"></span>').text((Math.round(range[0] * 1000 / max) / 10) + "\u2013" + (Math.round(range[1] * 1000 / max) / 10) + "%"));
			}
			row.append(cell);
		});
		table.append(row);
	});
	if (prediction.foes[x].none > 0.005) {
		table.append($("<tr></tr>").append($('<td class="dbl-move"></td>').text("Does nothing"),
			$('<td class="dbl-cell"></td>').attr("colspan", 2).text(formatAIShare(prediction.foes[x].none))));
	}
	return table;
}

function drawDoublesDialog() {
	var body = $(".dbl-dialog");
	if (!body.length) return;
	var scroll = body.scrollTop();
	var chosen = getDoublesPartners();
	var partners = resolveDoublesPartners();
	var prediction = getDoublesPrediction();
	var percent = function (key) {
		return $('<input type="number" class="dbl-hp" min="1" max="100" aria-label="HP %" />').val(chosen[key]).change(function () {
			chosen[key] = Math.max(1, Math.min(100, +$(this).val() || 100));
			recalculateDoubles();
		});
	};
	var foeSelect = $('<select class="dbl-select" aria-label="The trainer\'s other Pokémon"></select>');
	getDoublesFoeOptions().forEach(function (option) {
		foeSelect.append($("<option></option>").val(option.slot).text(shortSetName(option.setId)));
	});
	foeSelect.append('<option value="none">Nobody</option>').val(partners.foe ? partners.foe.slot : "none").change(function () {
		chosen.foe = $(this).val() === "none" ? "none" : +$(this).val();
		chosen.foeHP = 100;
		recalculateDoubles();
	});
	var yourSelect = $('<select class="dbl-select" aria-label="Your other Pokémon"></select>');
	getDoublesYourOptions().forEach(function (setId) {
		yourSelect.append($("<option></option>").val(setId).text(shortSetName(setId)));
	});
	yourSelect.append('<option value="none">Nobody</option>').val(partners.yours || "none").change(function () {
		chosen.yours = $(this).val();
		chosen.yoursHP = 100;
		recalculateDoubles();
	});
	body.empty().append($('<h3 id="dbl-title">Double battle</h3>'),
		$('<p class="bh-help"></p>').text("The two Pokémon in the calculator are out, with these beside them. For each of the trainer's two: " +
			"how often it uses each move on each of yours, and the damage. Its first Pokémon chooses before its second, which knows what the first is doing."),
		$('<div class="dbl-partners"></div>').append(
			$('<label class="dbl-partner"></label>').append("Beside " + shortMonName(prediction.battle ? prediction.battle.foes[0] : {name: "the foe"}) + ": ", foeSelect, " ", percent("foeHP"), "% HP"),
			$('<label class="dbl-partner"></label>').append("Beside your " + shortSetName($("#p1 input.set-selector").val()) + ": ", yourSelect, " ", percent("yoursHP"), "% HP")));
	if (!prediction.battle) {
		body.append($('<p class="bh-help"></p>').text(isDoublesFight() ? "One Pokémon is left on each side: the trainer plays it as a single battle (see Battle)." :
			"This fight is not a double battle."));
	} else {
		[0, 1].forEach(function (x) {
			if (prediction.battle.foes[x]) body.append(buildDoublesFoeTable(prediction, x));
		});
		body.append($('<p class="bh-help"></p>').text("Not predicted yet: switching out, and moves it aims at its own partner (Helping Hand, healing it). " +
			"To set a partner's HP, status or stat changes exactly, load it into the calculator instead."));
	}
	body.append($('<div class="box-dialog-buttons"></div>').append($('<button type="button">Done</button>').click(function () {
		$(".dbl-backdrop").remove();
		$(document).off("keydown.doubles");
	})));
	body.scrollTop(scroll);
}

function showDoublesDialog() {
	$(".dbl-backdrop").remove();
	var dialog = $('<div class="box-dialog-backdrop dbl-backdrop"><div class="box-dialog bh-dialog dbl-dialog" role="dialog" aria-modal="true" aria-labelledby="dbl-title"></div></div>');
	dialog.click(function (ev) {
		if (ev.target === dialog[0]) dialog.remove();
	});
	$(document).off("keydown.doubles").on("keydown.doubles", function (ev) {
		if (ev.key === "Escape") dialog.remove();
	});
	$("body").append(dialog);
	drawDoublesDialog();
}

// The Doubles button, beside Turn, in a double battle.
function buildDoublesButton() {
	return $('<button type="button" class="bh-button dbl-button">Doubles</button>')
		.attr("title", "Both Pokémon on each side: who the trainer's two go for, and with what")
		.click(showDoublesDialog);
}
