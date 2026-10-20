/*
 * The trainer's likely move on the Battle tab, after Radical Red's battle AI: Complete Fire Red
 * Upgrade's move-choice AI (src/Battle_AI: ai_master.c, ai_negatives.c, ai_positives.c,
 * ai_util.c, ai_advanced.c), which Radical Red is built on, for single battles.
 *
 * Each of the foe's moves starts at a score of 100. "Negatives" (AI flag 1, every trainer) takes
 * points off moves that would fail or waste the turn; "Positives" (flag 4, the bosses) adds points
 * for KOs, the strongest move, setting up when it is safe and so on, by the Pokémon's fighting
 * style (worked out from its moves). The highest score is used, ties at random. Before scoring,
 * the AI predicts your move the same way (always with the smart flags), and the AI's own rolls
 * (a coin for a 50% crit, four "simulated" random numbers, tie breaks) are enumerated exactly, so
 * the percentages are the chance of each move given what the calculator knows.
 *
 * Damage is the AI's single number: the calculator's highest roll x 0.93. The game's move data
 * (effects, accuracy, secondary chances) comes from the ROM (data/trainer_ai.js).
 *
 * Checked against Radical Red's own AI, decompiled from the ROM: it is CFRU's, with a few
 * differences from CFRU master, each marked "Radical Red" below (fighting styles, the setup
 * sweeper's status bonus, recovery at full HP, Taunt). The damage bonuses (KO first +9, slower KO,
 * desperate +9, strongest +2), the slower-KO table and the 0.93 damage roll match.
 *
 * What the calculator cannot know is assumed: no moves used yet this battle (so no Protect or
 * Destiny Bond last turn, no Choice lock), the foe's Pokémon has just come in when it is at full
 * HP (Fake Out), the foe can switch when it has another Pokémon left, and neither side holds a
 * Substitute. The AI's switching and item use are not modelled.
 */

// CFRU's move effects (include/constants/battle_move_effects.h), by number.
var AI_EFFECT_NAMES = ("HIT SLEEP POISON_HIT ABSORB BURN_HIT FREEZE_HIT PARALYZE_HIT EXPLOSION DREAM_EATER MIRROR_MOVE " +
	"ATTACK_UP DEFENSE_UP SPEED_UP SPECIAL_ATTACK_UP SPECIAL_DEFENSE_UP ACCURACY_UP EVASION_UP ALWAYS_HIT ATTACK_DOWN " +
	"DEFENSE_DOWN SPEED_DOWN SPECIAL_ATTACK_DOWN SPECIAL_DEFENSE_DOWN ACCURACY_DOWN EVASION_DOWN HAZE BIDE RAMPAGE ROAR " +
	"MULTI_HIT CONVERSION FLINCH_HIT RESTORE_HP TOXIC PAY_DAY LIGHT_SCREEN TRI_ATTACK REST OHKO RAZOR_WIND SUPER_FANG " +
	"DRAGON_RAGE TRAP HIGH_CRITICAL DOUBLE_HIT RECOIL_IF_MISS MIST FOCUS_ENERGY RECOIL CONFUSE ATTACK_UP_2 DEFENSE_UP_2 " +
	"SPEED_UP_2 SPECIAL_ATTACK_UP_2 SPECIAL_DEFENSE_UP_2 ACCURACY_UP_2 EVASION_UP_2 TRANSFORM ATTACK_DOWN_2 " +
	"DEFENSE_DOWN_2 SPEED_DOWN_2 SPECIAL_ATTACK_DOWN_2 SPECIAL_DEFENSE_DOWN_2 ACCURACY_DOWN_2 EVASION_DOWN_2 REFLECT " +
	"POISON PARALYZE ATTACK_DOWN_HIT DEFENSE_DOWN_HIT SPEED_DOWN_HIT SPECIAL_ATTACK_DOWN_HIT SPECIAL_DEFENSE_DOWN_HIT " +
	"ACCURACY_DOWN_HIT EVASION_DOWN_HIT SKY_ATTACK CONFUSE_HIT SPECIAL_DEFENSE_DOWN_2_HIT BLANK_78 SUBSTITUTE RECHARGE " +
	"RAGE MIMIC METRONOME LEECH_SEED SPLASH DISABLE LEVEL_DAMAGE PSYWAVE COUNTER ENCORE PAIN_SPLIT SNORE CONVERSION_2 " +
	"LOCK_ON SKETCH SPEED_UP_1_HIT SLEEP_TALK DESTINY_BOND FLAIL SPITE FALSE_SWIPE HEAL_BELL QUICK_ATTACK TRIPLE_KICK " +
	"THIEF MEAN_LOOK NIGHTMARE MINIMIZE CURSE SPECIAL_ATTACK_UP_HIT PROTECT SPIKES FORESIGHT PERISH_SONG SANDSTORM " +
	"BLANK_116 ROLLOUT SWAGGER FURY_CUTTER ATTRACT BLANK_121 PRESENT BLANK_123 SAFEGUARD BURN_UP MAGNITUDE BATON_PASS " +
	"PURSUIT RAPID_SPIN SONICBOOM BLANK_83 MORNING_SUN BLANK_133 BLANK_134 DEFENSE_UP_2_HIT RAIN_DANCE SUNNY_DAY " +
	"DEFENSE_UP_HIT ATTACK_UP_HIT ALL_STATS_UP_HIT HIGHER_OFFENSES_DEFENSES_UP_HIT BELLY_DRUM PSYCH_UP MIRROR_COAT " +
	"SKULL_BASH TWISTER EARTHQUAKE FUTURE_SIGHT GUST SPLINTER SOLARBEAM THUNDER TELEPORT BEAT_UP SEMI_INVULNERABLE " +
	"DEFENSE_CURL SPRINGTIDE_STORM FAKE_OUT UPROAR STOCKPILE SPIT_UP SWALLOW BLANK_A3 HAIL TORMENT FLATTER WILL_O_WISP " +
	"MEMENTO BLANK_169 FOCUS_PUNCH SMELLINGSALT FOLLOW_ME NATURE_POWER CHARGE TAUNT HELPING_HAND TRICK ROLE_PLAY WISH " +
	"ASSIST INGRAIN SUPERPOWER MAGIC_COAT RECYCLE BLANK_185 BRICK_BREAK YAWN KNOCK_OFF ENDEAVOR BLANK_190 SKILL_SWAP " +
	"IMPRISON REFRESH GRUDGE SNATCH BLANK_196 SECRET_POWER ATK_SPATK_UP ATK_ACC_UP DEF_SPD_UP MUD_SPORT VENOM_DRENCH " +
	"PLAY_NICE OVERHEAT TICKLE COSMIC_POWER EXTREME_EVOBOOST BULK_UP BAD_POISON_HIT WATER_SPORT CALM_MIND DRAGON_DANCE " +
	"STAT_SWAP_SPLIT BLANK_214 BLANK_215 BLANK_216 BLANK_217 ME_FIRST EAT_BERRY NATURAL_GIFT SMACK_DOWN " +
	"REMOVE_TARGET_STAT_CHANGES RELIC_SONG BLANK_224 BLANK_225 SET_TERRAIN PLEDGE FIELD_EFFECTS FLING FEINT " +
	"ATTACK_BLOCKERS TYPE_CHANGES HEAL_TARGET TOPSY_TURVY_ELECTRIFY FAIRY_LOCK_HAPPY_HOUR INSTRUCT_AFTER_YOU_QUASH " +
	"SUCKER_PUNCH IGNORE_REDIRECTION TEAM_EFFECTS CAMOUFLAGE FLAMEBURST LAST_RESORT DAMAGE_SET_TERRAIN TEATIME " +
	"POLTERGEIST SKY_DROP").split(" ");
var E = {};
AI_EFFECT_NAMES.forEach(function (name, id) {
	E[name] = id;
});

var AI_NEGATIVES = 1;
var AI_SEMI_SMART = 2;
var AI_POSITIVES = 4;
var AI_SMART_FLAGS = 7;

// Fighting styles (ai_advanced.c), singles.
var STYLE = {NONE: 0, KILL: 1, SETUP_STATS: 2, SETUP_STATUS: 3, SETUP_SCREENS: 4, STALL: 5, BATON_PASS: 6,
	CLERIC: 7, SUPPORT_SCREENS: 8, PHAZING: 9, HAZARDS: 10};
var MOVE_TARGET_USER = 0x10;
var MOVE_TARGET_FOES_FIELD = 0x40;
var FLAG_CONTACT = 0x1;
var FLAG_MAGIC_COAT = 0x4;
var FLAG_TRIAGE = 0x40;
var SPLIT_PHYSICAL = 0;
var SPLIT_SPECIAL = 1;
var SPLIT_STATUS = 2;

var MOLD_BREAKERS = ["Mold Breaker", "Teravolt", "Turboblaze"];
var CONTACT_PUNISHERS = ["Effect Spore", "Poison Point", "Static", "Flame Body", "Cute Charm", "Aftermath", "Gooey",
	"Tangling Hair", "Rough Skin", "Iron Barbs", "Pickpocket", "Mummy", "Wandering Spirit", "Cotton Down", "Perish Body"];
var POWDER_MOVES = ["Spore", "Sleep Powder", "Stun Spore", "Poison Powder", "Rage Powder", "Cotton Spore", "Powder", "Magic Powder"];
var GRAVITY_BANNED = ["Fly", "Bounce", "Sky Drop", "High Jump Kick", "Jump Kick", "Splash", "Magnet Rise", "Telekinesis", "Flying Press"];
var CHARGE_MOVES = ["Razor Wind", "Sky Attack", "Skull Bash", "Meteor Beam", "Freeze Shock", "Ice Burn", "Geomancy", "Solar Beam",
	"Solar Blade", "Fly", "Dig", "Dive", "Bounce", "Phantom Force", "Shadow Force", "Sky Drop", "Electro Shot"];
var HEX_MOVES = ["Hex", "Infernal Parade", "Bitter Malice", "Barb Barrage"];
var HAZING_MOVES = ["Haze", "Clear Smog"];
var STAT_DROP_SELF_EFFECTS = [E.SUPERPOWER, E.OVERHEAT];
var FIXED_DAMAGE_EFFECTS = [E.LEVEL_DAMAGE, E.SUPER_FANG, E.DRAGON_RAGE, E.SONICBOOM, E.PSYWAVE, E.ENDEAVOR, E.PAIN_SPLIT];
var SET_STATUS_EFFECTS = [E.SLEEP, E.TOXIC, E.POISON, E.PARALYZE, E.WILL_O_WISP, E.YAWN];
var STAT_LOWER_EFFECTS = [E.ATTACK_DOWN, E.DEFENSE_DOWN, E.SPEED_DOWN, E.SPECIAL_ATTACK_DOWN, E.SPECIAL_DEFENSE_DOWN,
	E.ACCURACY_DOWN, E.EVASION_DOWN, E.ATTACK_DOWN_2, E.DEFENSE_DOWN_2, E.SPEED_DOWN_2, E.SPECIAL_ATTACK_DOWN_2,
	E.SPECIAL_DEFENSE_DOWN_2, E.ACCURACY_DOWN_2, E.EVASION_DOWN_2, E.TICKLE, E.PLAY_NICE, E.VENOM_DRENCH];
// The moves that make a set "boosting" for its fighting style, as Radical Red's own code lists them:
// unlike CFRU master, attacks that raise the user's Attack count (Power-Up Punch, Metal Claw,
// Meteor Mash, Fell Stinger), and the effects no Radical Red boosting move uses are left out.
var BOOSTING_EFFECTS = [E.ATTACK_UP, E.DEFENSE_UP, E.SPEED_UP, E.SPECIAL_ATTACK_UP, E.SPECIAL_DEFENSE_UP, E.ACCURACY_UP,
	E.EVASION_UP, E.ATTACK_UP_2, E.DEFENSE_UP_2, E.SPEED_UP_2, E.SPECIAL_ATTACK_UP_2, E.SPECIAL_DEFENSE_UP_2,
	E.ACCURACY_UP_2, E.EVASION_UP_2, E.ATTACK_UP_HIT, E.COSMIC_POWER, E.BULK_UP, E.CALM_MIND, E.DRAGON_DANCE];
var ABSORBING = {Electric: ["Volt Absorb", "Motor Drive", "Lightning Rod"], Water: ["Water Absorb", "Dry Skin", "Storm Drain"],
	Fire: ["Flash Fire"], Grass: ["Sap Sipper"]};
var STAT_INDEX = {atk: 0, def: 1, spe: 2, spa: 3, spd: 4, acc: 5, eva: 6};

function has(list, value) {
	return list.indexOf(value) !== -1;
}

// The game's data for a move ([effect, accuracy, chance, target, priority, flags, split, power]).
function getAIMoveData(move) {
	var name = (move.originalName || move.name || "").replace(/^Hidden Power .*/, "Hidden Power");
	var row = typeof TRAINER_AI_MOVES !== "undefined" && TRAINER_AI_MOVES[name.toLowerCase().replace(/[^a-z0-9]/g, "")];
	var split = move.category === "Status" ? SPLIT_STATUS : move.category === "Special" ? SPLIT_SPECIAL : SPLIT_PHYSICAL;
	if (!row) row = [E.HIT, 100, 0, 0, move.priority || 0, (move.flags && move.flags.contact) ? FLAG_CONTACT : 0, split, move.bp];
	return {effect: row[0], accuracy: row[1], chance: row[2], target: row[3], priority: row[4], flags: row[5],
		split: row[6], power: row[7]};
}

/* ---------------------------------------------------------------------------------------------
 * Enumerating the AI's chances. A decision is a program that asks `pick(probabilities)` at its
 * random points; running it once per combination of answers (an odometer over the choices made,
 * deeper choices restarting whenever an earlier one changes) gives the exact distribution.
 */
function enumerateChances(decide, limit) {
	var path = [];
	var total = [0, 0, 0, 0];
	var runs = 0;
	for (;;) {
		var depth = 0;
		var weight = 1;
		var sizes = [];
		var rng = {
			pick: function (probabilities) {
				if (depth === path.length) path.push(0);
				var index = path[depth];
				sizes[depth] = probabilities.length;
				weight *= probabilities[index];
				depth++;
				return index;
			}
		};
		var shares = decide(rng);
		for (var i = 0; i < 4; i++) total[i] += weight * shares[i];
		path.length = depth;
		while (path.length && path[path.length - 1] + 1 >= sizes[path.length - 1]) path.pop();
		if (!path.length || ++runs >= limit) break;
		path[path.length - 1]++;
	}
	var sum = total[0] + total[1] + total[2] + total[3];
	return total.map(function (p) {
		return sum ? p / sum : 0;
	});
}

// A battle turn being thought through: random values are drawn lazily and kept for the turn.
function AITurn(rng, battle) {
	this.rng = rng;
	this.battle = battle;
	this.coins = {}; // kept for the whole turn
	this.cache = {}; // per thinking phase (your prediction, then the AI's choice)
	this.prediction = {}; // side key -> move index, or null (switch or nothing)
	this.predictedSwitch = {};
	this.flags = battle.flags;
}

AITurn.prototype.coin = function (key, chance) {
	if (chance <= 0) return false;
	if (chance >= 1) return true;
	if (!(key in this.coins)) this.coins[key] = this.rng.pick([chance, 1 - chance]) === 0;
	return this.coins[key];
};

// simulatedRNG[k] (AIRandom() % 100): only below 25, below 75 and its parity are ever read, so
// one value stands for each of the six cells.
var SIMULATED_RNG_CELLS = [0, 1, 26, 25, 76, 75];
var SIMULATED_RNG_CHANCES = [0.13, 0.12, 0.25, 0.25, 0.12, 0.13];
AITurn.prototype.simulatedRNG = function (k) {
	var key = "rng" + (this.phase || "") + k;
	if (!(key in this.coins)) this.coins[key] = SIMULATED_RNG_CELLS[this.rng.pick(SIMULATED_RNG_CHANCES)];
	return this.coins[key];
};

AITurn.prototype.memo = function (key, compute) {
	if (!(key in this.cache)) this.cache[key] = compute.call(this);
	return this.cache[key];
};

AITurn.prototype.predicted = function (side) {
	var index = this.prediction[side.key];
	return index === undefined || index === null ? null : side.moves[index];
};

/* ---------------------------------------------------------------------------------------------
 * Facts about one side.
 */
function sideHasAbility(side, names) {
	return has(names, side.ability);
}

function ignoresAbilities(atk) {
	return has(MOLD_BREAKERS, atk.ability);
}

function defAbility(atk, def) {
	return ignoresAbilities(atk) ? "" : def.ability;
}

// The calculator calls Radical Red's hail "Snow" (it only chips as "Hail").
function isHail(field) {
	return field.weather === "Hail" || field.weather === "Snow";
}

function isGrounded(side, field) {
	if (field.isGravity || side.item === "Iron Ball") return true;
	return !(side.types.indexOf("Flying") !== -1 || side.ability === "Levitate" || side.item === "Air Balloon");
}

function hasMoveWhere(side, test) {
	return side.moves.some(function (move) {
		return move && test(move);
	});
}

function hasPhysical(side) {
	return hasMoveWhere(side, function (m) {
		return m.split === SPLIT_PHYSICAL && m.power > 0;
	});
}

// A physical move that uses its own Attack (not Foul Play or Body Press).
function hasRealPhysical(side) {
	return hasMoveWhere(side, function (m) {
		return m.split === SPLIT_PHYSICAL && m.power > 0 && m.name !== "Foul Play" && m.name !== "Body Press";
	});
}

function hasSpecial(side) {
	return hasMoveWhere(side, function (m) {
		return m.split === SPLIT_SPECIAL && m.power > 0;
	});
}

function hasMoveNamed(side, names) {
	return hasMoveWhere(side, function (m) {
		return has(names, m.name);
	});
}

function hasEffect(side, effects) {
	return hasMoveWhere(side, function (m) {
		return has(effects, m.effect);
	});
}

function hasProtectMove(side) {
	return hasMoveWhere(side, function (m) {
		return m.effect === E.PROTECT && !has(["Quick Guard", "Wide Guard", "Crafty Shield", "Mat Block"], m.name);
	});
}

function isDamaging(move) {
	return !!move && move.split !== SPLIT_STATUS && move.power > 0;
}

function stage(side, stat) {
	return 6 + (side.boosts[stat] || 0);
}

function healthPercent(side) {
	return Math.floor(side.hp * 100 / side.maxHP);
}

function isAsleep(side) {
	return side.status === "slp" && side.ability !== "Comatose";
}

// Asleep (for more than this turn), frozen: it cannot act this turn.
function isIncapacitated(side) {
	return isAsleep(side) || side.status === "frz";
}

function canBeChoiceLocked(side) {
	return /^Choice /.test(side.item) || side.ability === "Gorilla Tactics";
}

function isUsable(side, i, field) {
	var move = side.moves[i];
	if (!move) return false;
	if (move.split === SPLIT_STATUS && side.item === "Assault Vest") return false;
	if (field.isGravity && has(GRAVITY_BANNED, move.name)) return false;
	return true;
}

function isSelfTargeting(move) {
	return (move.target & MOVE_TARGET_USER) !== 0;
}

function isStatusAffected(def) {
	return !!def.status;
}

function needsCharge(atk, move, field) {
	if (!has(CHARGE_MOVES, move.name) || atk.item === "Power Herb") return false;
	if ((move.name === "Solar Beam" || move.name === "Solar Blade") && /Sun/.test(field.weather || "")) return false;
	if (move.name === "Electro Shot" && /Rain/.test(field.weather || "")) return false;
	return true;
}

// End-of-turn damage the side will take (GetSecondaryEffectDamage).
function secondaryDamage(side, field) {
	if (side.ability === "Magic Guard") return 0;
	var max = side.maxHP;
	var chip = 0;
	var weather = field.weather || "";
	var goggles = side.item === "Safety Goggles" || side.ability === "Overcoat";
	if (weather === "Sand" && !goggles && !side.types.some(function (t) {
		return has(["Rock", "Ground", "Steel"], t);
	}) && !has(["Sand Veil", "Sand Rush", "Sand Force"], side.ability)) chip += Math.max(1, Math.floor(max / 16));
	if (weather === "Hail" && !goggles && side.types.indexOf("Ice") === -1 && !has(["Ice Body", "Snow Cloak"], side.ability)) {
		chip += Math.max(1, Math.floor(max / 16));
	}
	if (side.status === "psn" && side.ability !== "Poison Heal") chip += Math.max(1, Math.floor(max / 8));
	if (side.status === "tox" && side.ability !== "Poison Heal") chip += Math.max(1, Math.floor(max / 16));
	if (side.status === "brn") chip += Math.max(1, Math.floor(max / (side.ability === "Heatproof" ? 32 : 16)));
	if (side.seeded) chip += Math.max(1, Math.floor(max / 8));
	if (side.saltCured) chip += Math.max(1, Math.floor(max / (side.types.indexOf("Water") !== -1 || side.types.indexOf("Steel") !== -1 ? 4 : 8)));
	return chip;
}

function passiveRecovery(side, field) {
	var max = side.maxHP;
	var heal = 0;
	if (side.item === "Leftovers" || (side.item === "Black Sludge" && side.types.indexOf("Poison") !== -1)) heal += Math.floor(max / 16);
	if (/Rain/.test(field.weather || "") && side.ability === "Rain Dish") heal += Math.floor(max / 16);
	if (/Rain/.test(field.weather || "") && side.ability === "Dry Skin") heal += Math.floor(max / 8);
	if (isHail(field) && side.ability === "Ice Body") heal += Math.floor(max / 16);
	if (/^(psn|tox)$/.test(side.status) && side.ability === "Poison Heal") heal += Math.floor(max / 8);
	if (field.terrain === "Grassy" && isGrounded(side, field)) heal += Math.floor(max / 16);
	return secondaryDamage(side, field) >= heal ? 0 : heal;
}

// WillFaintFromSecondaryDamage, with the game's 8-bit HP wrap kept.
function willFaintFromChip(side, field) {
	var hp = Math.min(side.hp + passiveRecovery(side, field), side.maxHP) & 0xFF;
	var chip = secondaryDamage(side, field);
	return chip > 0 && chip >= hp;
}

/* ---------------------------------------------------------------------------------------------
 * Speed, priority and accuracy.
 */
function priorityOf(side, move, field) {
	if (!move || side.hp <= 0) return 0;
	var priority = move.priority;
	if (side.ability === "Prankster" && move.split === SPLIT_STATUS) priority++;
	if (side.ability === "Gale Wings" && move.type === "Flying" && side.hp === side.maxHP) priority++;
	if (side.ability === "Triage" && (move.flags & FLAG_TRIAGE)) priority += 3;
	if (move.name === "Grassy Glide" && field.terrain === "Grassy" && isGrounded(side, field)) priority++;
	return priority;
}

function bracketOf(side) {
	if (side.item === "Lagging Tail" || side.item === "Full Incense") return -2;
	if (side.ability === "Stall") return -1;
	if (side.item === "Custap Berry" && side.hp <= side.maxHP / (side.ability === "Gluttony" ? 2 : 4)) return 1;
	return 0;
}

// MoveWouldHitBeforeOtherMove: speed ties go against the attacker.
function hitsBefore(atk, move, def, defMove, battle) {
	var field = battle.field;
	if (!defMove) {
		if (priorityOf(atk, move, field) > 0) return true;
	} else {
		var pa = priorityOf(atk, move, field);
		var pd = priorityOf(def, defMove, field);
		if (pa > pd) return true;
		if (pd > pa) return false;
	}
	if (bracketOf(atk) > bracketOf(def)) return true;
	var sa = atk.speed;
	var sd = def.speed;
	if (battle.trickRoom) {
		sa = def.speed;
		sd = atk.speed;
	}
	return sa > sd;
}

function hitsFirst(turn, atk, move, def) {
	return hitsBefore(atk, move, def, turn.predicted(def), turn.battle);
}

function moveWillHit(atk, def, move, field) {
	if (atk.ability === "No Guard" || def.ability === "No Guard") return true;
	if (move.accuracy === 0) return true;
	if (move.effect === E.THUNDER && /Rain/.test(field.weather || "")) return true;
	if (move.name === "Toxic" && atk.types.indexOf("Poison") !== -1) return true;
	return false;
}

function accuracyOf(atk, def, move, field) {
	if (move.accuracy === 0) return 0xFFFF;
	var acc = move.accuracy;
	if (move.effect === E.THUNDER && /Sun/.test(field.weather || "")) acc = 50;
	var defAbil = defAbility(atk, def);
	if (defAbil === "Wonder Skin" && move.split === SPLIT_STATUS) acc = Math.min(acc, 50);
	if (atk.ability === "Compound Eyes") acc = acc * 13 / 10;
	if (atk.ability === "Hustle" && move.split === SPLIT_PHYSICAL) acc = acc * 8 / 10;
	if (atk.ability === "Victory Star") acc = acc * 11 / 10;
	if ((defAbil === "Sand Veil" && field.weather === "Sand") || (defAbil === "Snow Cloak" && isHail(field))) acc = acc * 8 / 10;
	if (atk.item === "Wide Lens") acc = acc * 11 / 10;
	if (def.item === "Bright Powder" || def.item === "Lax Incense") acc = acc * 9 / 10;
	if (field.isGravity) acc = acc * 5 / 3;
	return Math.floor(acc);
}

// CalcAIAccuracy: recharge moves count as 49, rampages a point lower.
function aiAccuracy(atk, def, move, field) {
	var acc = accuracyOf(atk, def, move, field);
	if (move.effect === E.RECHARGE) return 49;
	if (move.effect === E.RAMPAGE || move.effect === E.ROLLOUT) return acc - 1;
	if (move.name === "Final Gambit") return acc - 5;
	return acc;
}

/* ---------------------------------------------------------------------------------------------
 * Damage, KOs and the strongest move.
 */
function isSuckerPunchOkay(turn, atk, move, def) {
	var predicted = turn.predicted(def);
	if (!predicted || predicted.split === SPLIT_STATUS) return false;
	return hitsFirst(turn, atk, move, def);
}

// The AI's damage for one use of the move (AI_CalcDmg through CalcFinalAIMoveDamage, 1 hit).
function moveDamage(turn, atk, def, i) {
	return turn.memo("dmg" + atk.key + i, function () {
		var move = atk.moves[i];
		var field = turn.battle.field;
		if (!move || move.split === SPLIT_STATUS || move.power === 0) return 0;
		if (move.effect === E.FAKE_OUT && !atk.firstTurn) return 0;
		if (move.effect === E.SUCKER_PUNCH && !isSuckerPunchOkay(turn, atk, move, def)) return 0;
		if (move.effect === E.BURN_UP && atk.types.indexOf("Fire") === -1) return 0;
		if (field.terrain === "Psychic" && priorityOf(atk, move, field) > 0 && isGrounded(def, field)) return 0;
		if (has(["Dazzling", "Queenly Majesty", "Armor Tail"], defAbility(atk, def)) && priorityOf(atk, move, field) > 0) return 0;
		if (move.effect === E.COUNTER || move.effect === E.MIRROR_COAT) return counterDamage(turn, atk, def, move);
		var damage;
		if (has(FIXED_DAMAGE_EFFECTS, move.effect)) {
			damage = move.maxDamage;
			if (move.effect === E.ENDEAVOR) damage = Math.max(0, def.hp - atk.hp);
		} else {
			var crit = move.critChance >= 1 || (move.critChance >= 0.5 && turn.coin("crit" + atk.key + i, 0.5));
			damage = Math.floor((crit ? move.maxCritDamage : move.maxDamage) * 93 / 100);
			if (move.hits <= 1 && def.hp === def.maxHP && (def.item === "Focus Sash" ||
				(defAbility(atk, def) === "Sturdy") || move.effect === E.FALSE_SWIPE)) {
				damage = Math.min(damage, def.hp - 1);
			} else if (move.effect === E.FALSE_SWIPE) {
				damage = Math.min(damage, def.hp - 1);
			}
		}
		return Math.min(damage, def.hp);
	});
}

// Counter and Mirror Coat: twice the foe's strongest (or predicted) move of the right kind.
function counterDamage(turn, atk, def, move) {
	if (turn.counting) return 0;
	turn.counting = true;
	var strongest = strongestMove(turn, def, atk);
	var basis = def.moves[strongest];
	var damage = 0;
	var split = move.effect === E.COUNTER && move.name !== "Metal Burst" ? SPLIT_PHYSICAL : SPLIT_SPECIAL;
	if (basis && basis.split !== SPLIT_STATUS && !needsCharge(def, basis, turn.battle.field)) {
		var hit = moveDamage(turn, def, atk, strongest);
		if (move.name === "Metal Burst") damage = Math.floor(hit * 3 / 2);
		else if (basis.split === split) damage = hit * 2;
	}
	turn.counting = false;
	return Math.min(damage, def.hp);
}

// CalcFinalAIMoveDamage for numHits uses on consecutive turns, with end-of-turn chip between.
function finalDamage(turn, atk, def, i, numHits) {
	var d = moveDamage(turn, atk, def, i);
	if (!d || numHits <= 0) return 0;
	if (numHits === 1) return d;
	var later = has(["Multiscale", "Shadow Shield"], defAbility(atk, def)) && def.hp === def.maxHP ? d * 2 : d;
	return Math.min(d + later * (numHits - 1) + secondaryDamage(def, turn.battle.field) * (numHits - 1), def.hp);
}

function knocksOut(turn, atk, def, i, numHits) {
	var move = atk.moves[i];
	if (!move || def.hp <= 0) return false;
	var field = turn.battle.field;
	if (def.ability === "Disguise" && !ignoresAbilities(atk) && def.abilityOn) numHits--;
	if (needsCharge(atk, move, field)) numHits--;
	if (move.effect === E.EXPLOSION) numHits = Math.min(numHits, 1);
	if (move.effect === E.RECHARGE) numHits--;
	if (numHits <= 0) return false;
	if (move.effect === E.FUTURE_SIGHT && numHits <= 2) return false;
	return finalDamage(turn, atk, def, i, numHits) >= def.hp;
}

function badIdeaToMakeContact(atk, def) {
	if (atk.ability === "Long Reach" || atk.item === "Protective Pads") return false;
	if (def.item === "Rocky Helmet") return true;
	var ability = defAbility(atk, def);
	if (ability === "Effect Spore" && (atk.types.indexOf("Grass") !== -1 || atk.ability === "Overcoat" || atk.item === "Safety Goggles")) return false;
	return has(CONTACT_PUNISHERS, ability);
}

function isRecoilMove(move) {
	return move.effect === E.RECOIL || move.effect === E.RECOIL_IF_MISS || !!move.recoil;
}

function isMultiHit(move) {
	return move.effect === E.MULTI_HIT || move.effect === E.DOUBLE_HIT || move.effect === E.TRIPLE_KICK || move.hits > 1;
}

// The player's side is the human: PickMoveHumanLikelyToChoose's order of preference.
function shouldUseHumanLikelyMove(atk, def) {
	return atk.isPlayer || def.monsLeft <= 1;
}

function humanLikelyPreference(atk, def, a, b) {
	var tests = [
		function (m) {
			return m.chance >= 50 && (m.drain || has([E.ATTACK_UP_HIT, E.SPECIAL_ATTACK_UP_HIT, E.SPEED_UP_1_HIT, E.DEFENSE_UP_HIT,
				E.ALL_STATS_UP_HIT], m.effect));
		},
		function (m) {
			return m.effectiveness > 1;
		},
		function (m) {
			return m.effectiveness >= 1;
		},
		function (m) {
			return atk.types.indexOf(m.type) !== -1;
		}
	];
	for (var t = 0; t < tests.length; t++) {
		var ta = tests[t](a);
		var tb = tests[t](b);
		if (ta !== tb) return ta ? 1 : -1;
	}
	if (a.bp !== b.bp) return a.bp > b.bp ? 1 : -1;
	return 0;
}

// The tie break between two equally damaging moves: does `challenger` take over from `current`?
function winsDamageTie(turn, atk, def, challenger, current, key) {
	var field = turn.battle.field;
	var a = atk.moves[challenger];
	var b = atk.moves[current];
	if (b.effect === E.FUTURE_SIGHT) return true;
	var pa = priorityOf(atk, a, field);
	var pb = priorityOf(atk, b, field);
	if (pa > pb && a.effect !== E.FUTURE_SIGHT) return true;
	if (pa !== pb) return false;
	var accA = moveWillHit(atk, def, a, field) ? 100 : aiAccuracy(atk, def, a, field);
	var accB = moveWillHit(atk, def, b, field) ? 100 : aiAccuracy(atk, def, b, field);
	if (accA > accB && accB < 100) return true;
	if (!(accA === accB || accA >= 100)) return false;
	if (canBeChoiceLocked(atk)) return a.bp > b.bp;
	var prefer = function (test) {
		var ta = test(a);
		var tb = test(b);
		return ta === tb ? 0 : ta ? 1 : -1;
	};
	var verdict = 0;
	if (badIdeaToMakeContact(atk, def)) {
		verdict = prefer(function (m) {
			return !(m.flags & FLAG_CONTACT);
		}) || ((a.flags & FLAG_CONTACT) && (b.flags & FLAG_CONTACT) ? prefer(function (m) {
			return !isMultiHit(m);
		}) : 0);
	}
	if (!verdict && atk.ability !== "Magic Guard") verdict = prefer(function (m) {
		return !isRecoilMove(m);
	});
	if (!verdict && atk.ability !== "Contrary") verdict = prefer(function (m) {
		return !has(STAT_DROP_SELF_EFFECTS, m.effect);
	});
	if (!verdict && shouldUseHumanLikelyMove(atk, def)) verdict = humanLikelyPreference(atk, def, a, b);
	if (verdict) return verdict > 0;
	return turn.coin(key, 0.5);
}

function isEffectivePursuit(atk, def, move) {
	return move.effect === E.PURSUIT && def.monsLeft > 1 && !atk.isPlayer;
}

function isOHKOUsable(atk, def, move, field) {
	if (move.effect !== E.OHKO) return true;
	if (!moveWillHit(atk, def, move, field)) return false;
	if (atk.level < def.level || defAbility(atk, def) === "Sturdy") return false;
	return !(move.name === "Sheer Cold" && def.types.indexOf("Ice") !== -1);
}

// CalcStrongestMove: the highest AI damage number (1 hit, capped at the target's HP).
function strongestMove(turn, atk, def) {
	return turn.memo("strongest" + atk.key, function () {
		var field = turn.battle.field;
		var strongest = 0;
		var best = 0;
		for (var i = 0; i < 4; i++) {
			var move = atk.moves[i];
			if (!move) break;
			if (!isUsable(atk, i, field) || move.power === 0 || !isOHKOUsable(atk, def, move, field)) continue;
			var damage = moveDamage(turn, atk, def, i);
			if (damage > best) {
				strongest = i;
				best = damage;
			} else if (damage === best && damage > 0 && move.effect !== E.COUNTER && move.effect !== E.MIRROR_COAT &&
				move.effect !== E.FUTURE_SIGHT && !isEffectivePursuit(atk, def, atk.moves[strongest])) {
				if (isEffectivePursuit(atk, def, move) ||
					winsDamageTie(turn, atk, def, i, strongest, "strong" + atk.key + i + "-" + strongest)) strongest = i;
			}
		}
		return strongest;
	});
}

function isStrongest(turn, atk, def, i) {
	return strongestMove(turn, atk, def) === i;
}

// CalcStrongestMoveGoesFirst: the most damaging of the moves that would hit first, or -1.
function strongestGoesFirst(turn, atk, def) {
	return turn.memo("strongestFirst" + atk.key, function () {
		var field = turn.battle.field;
		var strongest = -1;
		var best = 0;
		for (var i = 0; i < 4; i++) {
			var move = atk.moves[i];
			if (!move || !isUsable(atk, i, field) || needsCharge(atk, move, field) || move.effect === E.FUTURE_SIGHT) continue;
			if (!hitsFirst(turn, atk, move, def)) continue;
			var damage = moveDamage(turn, atk, def, i);
			if (damage > best) {
				strongest = i;
				best = damage;
			} else if (damage === best && damage > 0 && strongest !== -1) {
				if (winsDamageTie(turn, atk, def, i, strongest, "first" + atk.key + i + "-" + strongest)) strongest = i;
			}
		}
		return strongest;
	});
}

function canKnockOut(turn, atk, def) {
	if (atk.hp <= 0 || def.hp <= 0 || isIncapacitated(atk)) return false;
	return knocksOut(turn, atk, def, strongestMove(turn, atk, def), 1);
}

function can2HKO(turn, atk, def) {
	if (atk.hp <= 0 || def.hp <= 0) return false;
	return canKnockOut(turn, atk, def) || knocksOut(turn, atk, def, strongestMove(turn, atk, def), 2);
}

function canKnockOutWithChip(turn, atk, def) {
	return canKnockOut(turn, atk, def) ||
		moveDamage(turn, atk, def, strongestMove(turn, atk, def)) + secondaryDamage(def, turn.battle.field) >= def.hp;
}

function anotherMoveKnocksOut(turn, atk, def, skip) {
	if (isIncapacitated(atk)) return false;
	for (var i = 0; i < 4; i++) {
		if (i !== skip && atk.moves[i] && isUsable(atk, i, turn.battle.field) && knocksOut(turn, atk, def, i, 1)) return true;
	}
	return false;
}

// MoveKnocksOutPossiblyGoesFirstWithBestAccuracy: one of the most accurate moves that KO.
function knocksOutWithBestAccuracy(turn, atk, def, i, checkFirst) {
	var field = turn.battle.field;
	var playerIsAttacker = shouldUseHumanLikelyMove(atk, def);
	var kos = [];
	for (var j = 0; j < 4; j++) {
		var move = atk.moves[j];
		if (!move || !isUsable(atk, j, field) || !knocksOut(turn, atk, def, j, 1)) continue;
		if (checkFirst && (!hitsFirst(turn, atk, move, def) || move.effect === E.FUTURE_SIGHT)) continue;
		kos.push(j);
	}
	if (kos.indexOf(i) === -1) return false;
	var perfect = kos.filter(function (j) {
		return moveWillHit(atk, def, atk.moves[j], field) && !playerIsAttacker;
	});
	var set;
	if (perfect.length) {
		set = perfect;
	} else {
		set = [];
		var bestAcc = -1;
		kos.forEach(function (j) {
			var move = atk.moves[j];
			var acc = playerIsAttacker && moveWillHit(atk, def, move, field) ? 100 : aiAccuracy(atk, def, move, field);
			if (!set.length || (acc > bestAcc && bestAcc < 100)) {
				set = [j];
				bestAcc = acc;
			} else if (acc === bestAcc || acc >= 100) {
				var pursuitSet = set.some(function (k) {
					return isEffectivePursuit(atk, def, atk.moves[k]);
				});
				if (isEffectivePursuit(atk, def, move)) set = [j];
				else if (!pursuitSet && priorityOf(atk, move, field) > priorityOf(atk, atk.moves[set[0]], field)) set = [j];
				else set.push(j);
			}
		});
	}
	if (set.indexOf(i) === -1) return false;
	var mine = atk.moves[i];
	if (badIdeaToMakeContact(atk, def) && (mine.flags & FLAG_CONTACT) && set.some(function (j) {
		return !(atk.moves[j].flags & FLAG_CONTACT);
	})) return false;
	if ((mine.flags & FLAG_CONTACT) && isMultiHit(mine) && set.some(function (j) {
		return !isMultiHit(atk.moves[j]);
	})) return false;
	return true;
}

/* ---------------------------------------------------------------------------------------------
 * Fighting styles.
 */
function fightingStyle(side, foe, battle) {
	var style = STYLE.NONE;
	var attacks = 0;
	var hazards = 0;
	var screens = 0;
	var statusMoves = 0;
	var boosting = false;
	var veil = false;
	var phazing = false;
	var leechSeed = false;
	var protect = false;
	for (var i = 0; i < 4; i++) {
		var move = side.moves[i];
		if (!move) continue;
		if (move.name === "Baton Pass" && side.monsLeft > 1) {
			style = STYLE.BATON_PASS;
		} else {
			switch (move.effect) {
			case E.ROAR:
				phazing = true;
				break;
			case E.HAZE:
			case E.REMOVE_TARGET_STAT_CHANGES:
				style = STYLE.PHAZING;
				break;
			case E.WISH:
			case E.HEAL_BELL:
				style = STYLE.CLERIC;
				break;
			case E.REFLECT:
				if (move.name === "Aurora Veil") veil = !side.sideState.auroraVeil;
				else screens++;
				break;
			case E.LIGHT_SCREEN:
				screens++;
				break;
			case E.LEECH_SEED:
				leechSeed = true;
				break;
			case E.PROTECT:
				protect = true;
				break;
			case E.TRAP:
			case E.MEAN_LOOK:
				style = STYLE.STALL;
				break;
			default:
				if (/^Choice /.test(side.item) || side.ability === "Gorilla Tactics" || side.item === "Assault Vest") style = STYLE.KILL;
			}
		}
		if (style !== STYLE.NONE) break;
		if (move.split !== SPLIT_STATUS) attacks++;
		if (has(BOOSTING_EFFECTS, move.effect)) {
			boosting = true;
		} else if (move.effect === E.SPIKES) {
			var foeSide = foe.sideState;
			if ((move.name === "Stealth Rock" && !foeSide.sr) || (move.name === "Toxic Spikes" && foeSide.toxicSpikes < 2) ||
				(move.name === "Sticky Web" && !foeSide.stickyWeb) || (move.name === "Spikes" && foeSide.spikes < 3)) hazards++;
		} else if (move.split === SPLIT_STATUS) {
			statusMoves++;
		}
	}
	if (style !== STYLE.NONE) return style;
	// Radical Red: any screen makes a support screener (CFRU master needs two, and makes a set with
	// two attacks a setup screener).
	if (screens >= 1 || veil) return STYLE.SUPPORT_SCREENS;
	if (hazards >= 1) return phazing ? STYLE.PHAZING : STYLE.HAZARDS;
	if (attacks >= 3) return boosting ? STYLE.SETUP_STATS : statusMoves > 0 ? STYLE.SETUP_STATUS : STYLE.KILL;
	if (leechSeed && protect) return STYLE.STALL;
	if (attacks >= 2 && (boosting || statusMoves > 0 || phazing)) return boosting ? STYLE.SETUP_STATS : STYLE.SETUP_STATUS;
	return STYLE.STALL;
}

function styleOf(turn, side) {
	return turn.memo("style" + side.key, function () {
		return fightingStyle(side, side === turn.battle.ai ? turn.battle.player : turn.battle.ai, turn.battle);
	});
}

function isSweeper(style) {
	return style === STYLE.KILL || style === STYLE.SETUP_STATS || style === STYLE.SETUP_STATUS;
}

function isTeamSupport(style) {
	return style === STYLE.BATON_PASS || style === STYLE.CLERIC || style === STYLE.SUPPORT_SCREENS || style === STYLE.PHAZING;
}

function isDamager(style) {
	return isSweeper(style) || style === STYLE.SETUP_SCREENS;
}

function isGoodToTaunt(style) {
	return has([STYLE.STALL, STYLE.SETUP_SCREENS, STYLE.BATON_PASS, STYLE.CLERIC, STYLE.SUPPORT_SCREENS, STYLE.HAZARDS], style);
}

// INCREASE_STATUS_VIABILITY(boost): what a status move's "+boost" is worth to this style.
function statusBonus(turn, atk, def, boost) {
	switch (styleOf(turn, atk)) {
	case STYLE.KILL:
		return 0;
	case STYLE.SETUP_STATS:
		// Radical Red adds the boost (CFRU master: a flat 3).
		return can2HKO(turn, def, atk) ? 0 : 3 + boost;
	case STYLE.SETUP_STATUS:
	case STYLE.PHAZING:
		return 4 + boost;
	case STYLE.STALL:
	case STYLE.CLERIC:
		return 3 + boost;
	case STYLE.BATON_PASS:
		return boost >= 3 ? 1 : 0;
	case STYLE.SUPPORT_SCREENS:
	case STYLE.SETUP_SCREENS:
		return 2 + boost;
	case STYLE.HAZARDS:
		return 3;
	}
	return 0;
}

/* ---------------------------------------------------------------------------------------------
 * Status and stat helpers.
 */
function canBeSlept(atk, def, field) {
	var ability = defAbility(atk, def);
	if (def.status || has(["Insomnia", "Vital Spirit", "Sweet Veil", "Comatose", "Purifying Salt"], ability)) return false;
	if (ability === "Leaf Guard" && /Sun/.test(field.weather || "")) return false;
	if ((field.terrain === "Electric" || field.terrain === "Misty") && isGrounded(def, field)) return false;
	return !(ability === "Flower Veil" && def.types.indexOf("Grass") !== -1);
}

function canBeStatused(atk, def, field) {
	var ability = defAbility(atk, def);
	if (def.status || has(["Comatose", "Purifying Salt"], ability)) return false;
	if (ability === "Leaf Guard" && /Sun/.test(field.weather || "")) return false;
	if (field.terrain === "Misty" && isGrounded(def, field)) return false;
	return !(ability === "Flower Veil" && def.types.indexOf("Grass") !== -1);
}

function canBeParalyzed(atk, def, field) {
	return canBeStatused(atk, def, field) && def.types.indexOf("Electric") === -1 && defAbility(atk, def) !== "Limber";
}

function canBeBurned(atk, def, field) {
	return canBeStatused(atk, def, field) && def.types.indexOf("Fire") === -1 &&
		!has(["Water Veil", "Water Bubble", "Thermal Exchange"], defAbility(atk, def));
}

function canBePoisoned(atk, def, field) {
	if (!canBeStatused(atk, def, field) || has(["Immunity", "Pastel Veil"], defAbility(atk, def))) return false;
	if (atk.ability === "Corrosion") return true;
	return def.types.indexOf("Poison") === -1 && def.types.indexOf("Steel") === -1;
}

function canBeConfused(atk, def, field) {
	return defAbility(atk, def) !== "Own Tempo" && !(field.terrain === "Misty" && isGrounded(def, field));
}

// Status a foe would rather have, or shrug off (BadIdeaTo...).
function badIdeaToStatus(atk, def, kind, field) {
	var ability = defAbility(atk, def);
	if (has(["Shed Skin", "Quick Feet", "Synchronize", "Guts"], ability)) return true;
	if (ability === "Marvel Scale" && hasPhysical(atk)) return true;
	if (ability === "Natural Cure" && def.monsLeft > 1) return true;
	if (ability === "Hydration" && /Rain/.test(field.weather || "")) return true;
	if (hasMoveNamed(def, ["Facade", "Psycho Shift"]) && kind !== "slp") return true;
	if (kind === "slp") return ability === "Early Bird";
	if (kind === "psn") {
		if (ability === "Poison Heal" || ability === "Toxic Boost") return true;
		if (ability === "Magic Guard" && !hasMoveNamed(atk, HEX_MOVES.concat(["Venoshock"]))) return true;
	}
	if (kind === "par" && hasMoveNamed(def, ["Rest"])) return true;
	if (kind === "brn") {
		if (ability === "Flare Boost") return true;
		if (ability === "Magic Guard" && !hasMoveNamed(atk, HEX_MOVES)) return true;
	}
	return false;
}

function canStatBeLowered(atk, def, stat) {
	var ability = defAbility(atk, def);
	if (has(["Clear Body", "White Smoke", "Full Metal Body", "Mirror Armor"], ability)) return false;
	if ((stat === "atk" && ability === "Hyper Cutter") || (stat === "def" && ability === "Big Pecks") ||
		(stat === "acc" && ability === "Keen Eye")) return false;
	return stage(def, stat) > 0;
}

function canStatBeRaised(side, stat) {
	return stage(side, stat) < 12;
}

// The likely kind of move this side uses (BankLikelyToUseMoveSplit).
function likelySplit(turn, side) {
	var sweeper = isSweeper(styleOf(turn, side));
	if (hasPhysical(side)) return sweeper && side.stats.atk > side.stats.spa ? SPLIT_PHYSICAL : SPLIT_STATUS;
	if (hasSpecial(side)) return sweeper && side.stats.spa > side.stats.atk ? SPLIT_SPECIAL : SPLIT_STATUS;
	return SPLIT_STATUS;
}

function badIdeaToRaiseStat(turn, atk, def, stat) {
	var predicted = turn.predicted(def);
	var field = turn.battle.field;
	if (predicted && (has(HAZING_MOVES, predicted.name) || predicted.effect === E.ROAR)) return true;
	if (def.isPlayer && hasMoveNamed(def, HAZING_MOVES)) return true;
	if (predicted && (predicted.effect === E.SLEEP || predicted.effect === E.YAWN) &&
		(moveWillHit(def, atk, predicted, field) || accuracyOf(def, atk, predicted, field) >= 80) && def.speed < atk.speed) return true;
	if (def.ability === "Unaware" && !willFaintFromChip(def, field)) return true;
	if (stat === "spe" && turn.battle.trickRoom) return true;
	return false;
}

function goodIdeaToRaise(turn, atk, def, stat) {
	if (badIdeaToRaiseStat(turn, atk, def, stat)) return 0;
	switch (stat) {
	case "atk":
		return hasRealPhysical(atk) ? 1 : 0;
	case "spa":
		return hasSpecial(atk) ? 1 : 0;
	case "def":
		if (likelySplit(turn, def) === SPLIT_PHYSICAL) return 1;
		return hasMoveNamed(atk, ["Body Press"]) ? 2 : 0;
	case "spd":
		return likelySplit(turn, def) === SPLIT_SPECIAL ? 1 : 0;
	case "spe":
		return atk.speed <= def.speed ? 1 : 0;
	case "acc":
		return hasMoveWhere(atk, function (m) {
			return m.accuracy && m.accuracy < 90;
		}) ? 1 : 0;
	}
	return 1;
}

function goodIdeaToLower(turn, def, atk, move, stat) {
	var field = turn.battle.field;
	if (!hitsFirst(turn, atk, move, def) && canKnockOut(turn, atk, def)) return false;
	if (stat === "atk" && willFaintFromChip(def, field)) return false;
	if (!canStatBeLowered(atk, def, stat) || defAbility(atk, def) === "Contrary") return false;
	if (stat !== "spe" && stat !== "acc" && has(["Defiant", "Competitive"], defAbility(atk, def))) return false;
	switch (stat) {
	case "atk":
		return stage(def, "atk") > 4 && hasRealPhysical(def);
	case "def":
		return stage(def, "def") > 4 && hasPhysical(atk);
	case "spa":
		return stage(def, "spa") > 4 && hasSpecial(def);
	case "spd":
		return stage(def, "spd") > 4 && hasSpecial(atk);
	case "spe":
		return atk.speed <= def.speed;
	}
	return true;
}

// ShouldTryToSetUpStat: worth a turn to set this stat up now?
function shouldTrySetUp(turn, atk, def, move, stat, limit) {
	var field = turn.battle.field;
	if (def.ability === "Unaware" && !hasMoveNamed(atk, ["Stored Power", "Power Trip"]) &&
		!(stat === "def" && hasMoveNamed(atk, ["Body Press"]))) return false;
	if (willFaintFromChip(atk, field)) return false;
	if (hitsFirst(turn, atk, move, def)) {
		if (canKnockOutWithChip(turn, def, atk)) return false;
	} else {
		var predicted = turn.predicted(def);
		if (predicted && predicted.effect === E.SEMI_INVULNERABLE) return true;
		if (stat === "spe" && stage(atk, "spe") < limit && !(predicted && knocksOut(turn, def, atk, def.moves.indexOf(predicted), 1))) {
			var boost = has([E.SPEED_UP_2, E.DRAGON_DANCE], move.effect) && move.name !== "Dragon Dance" ? 2 : 1;
			if (atk.ability === "Simple") boost *= 2;
			if (Math.floor(atk.speed * (2 + boost) / 2) >= def.speed) return true;
		}
		if (can2HKO(turn, def, atk)) {
			var strongest = def.moves[strongestMove(turn, def, atk)];
			return !canKnockOut(turn, def, atk) && !!strongest &&
				((stat === "def" && strongest.split === SPLIT_PHYSICAL) || (stat === "spd" && strongest.split === SPLIT_SPECIAL));
		}
	}
	if (stage(atk, stat) >= limit) return false;
	if ((stat === "atk" || stat === "spa") && def.hp === def.maxHP && (def.item === "Focus Sash" ||
		(def.ability === "Sturdy" && !ignoresAbilities(atk))) && !isIncapacitated(def)) {
		var split = stat === "atk" ? SPLIT_PHYSICAL : SPLIT_SPECIAL;
		if (!hasMoveWhere(atk, function (m) {
			return m.split === split && isMultiHit(m);
		})) return false;
	}
	return true;
}

// IncreaseStatViability: what setting `stat` up is worth to this style.
function statBonus(turn, atk, def, move, stat, limit, boost) {
	var foeStyle = styleOf(turn, def);
	if (limit < 12 && (((stat === "atk" || stat === "spa") && (foeStyle === STYLE.STALL || isTeamSupport(foeStyle))) ||
		turn.predictedSwitch[def.key])) limit = 12;
	switch (styleOf(turn, atk)) {
	case STYLE.KILL:
		if (shouldTrySetUp(turn, atk, def, move, stat, limit)) return 3 + boost;
		return isDamaging(move) && (stat === "atk" || stat === "spa") ? 1 : 0;
	case STYLE.SETUP_STATS:
		return shouldTrySetUp(turn, atk, def, move, stat, limit) ? 3 + boost : 0;
	case STYLE.PHAZING:
		if (hasEffect(atk, [E.HAZE])) return 0;
		return shouldTrySetUp(turn, atk, def, move, stat, limit) ? statusBonus(turn, atk, def, 1) : 0;
	case STYLE.BATON_PASS:
		if (stat === "eva") return shouldTrySetUp(turn, atk, def, move, stat, 12) ? 6 : 0;
		if (stat === "def" || stat === "spd") return shouldTrySetUp(turn, atk, def, move, stat, 10) ? 4 : 0;
		return shouldTrySetUp(turn, atk, def, move, stat, 10) ? 5 : 0;
	default:
		return shouldTrySetUp(turn, atk, def, move, stat, limit) ? statusBonus(turn, atk, def, 1) : 0;
	}
}

/* ---------------------------------------------------------------------------------------------
 * AIScript_Negatives: points off moves that fail or waste the turn.
 */
function scoreNegatives(turn, atk, def, i, score) {
	var move = atk.moves[i];
	var field = turn.battle.field;
	var flags = turn.flags;
	var goodAI = flags > 1;
	var ability = defAbility(atk, def);
	var predicted = turn.predicted(def);
	var effect = move.effect;
	var damaging = isDamaging(move);
	var down = function (amount) {
		score = Math.max(0, score - amount);
		return score;
	};
	var up = function (amount) {
		score = Math.min(255, score + amount);
	};

	if (!isSelfTargeting(move)) {
		if (flags === 1 && turn.coin("tryToKill", 0.5) && hasMoveWhere(atk, isDamaging) && damaging) {
			if (knocksOutWithBestAccuracy(turn, atk, def, i, true)) up(7);
			else if (isStrongest(turn, atk, def, i)) up(2);
		}
		if (field.isGravity && has(GRAVITY_BANNED, move.name)) return 0;
		if (has(POWDER_MOVES, move.name) && (def.types.indexOf("Grass") !== -1 || def.ability === "Overcoat" ||
			def.item === "Safety Goggles")) down(10);
		if (ability) {
			if (ABSORBING[move.type] && has(ABSORBING[move.type], ability)) {
				down(20);
				return score;
			}
			if ((ability === "Soundproof" && move.sound) || (ability === "Bulletproof" && move.bullet)) {
				down(10);
				return score;
			}
			if (has(["Dazzling", "Queenly Majesty", "Armor Tail"], ability) && priorityOf(atk, move, field) > 0) {
				down(10);
				return score;
			}
			if (ability === "Magic Bounce" && (move.flags & FLAG_MAGIC_COAT)) {
				down(20);
				return score;
			}
			if (has(STAT_LOWER_EFFECTS, effect) || move.name === "Parting Shot") {
				if (ability === "Contrary" || ability === "Mirror Armor") down(20);
				else if (has(["Clear Body", "Full Metal Body", "White Smoke"], ability)) down(10);
				else if ((ability === "Hyper Cutter" && (effect === E.ATTACK_DOWN || effect === E.ATTACK_DOWN_2)) ||
					(ability === "Keen Eye" && (effect === E.ACCURACY_DOWN || effect === E.ACCURACY_DOWN_2)) ||
					(ability === "Big Pecks" && (effect === E.DEFENSE_DOWN || effect === E.DEFENSE_DOWN_2))) down(10);
				else if (has(["Defiant", "Competitive"], ability) && move.split === SPLIT_STATUS &&
					canStatBeRaised(def, ability === "Defiant" ? "atk" : "spa") && (hasPhysical(def) || hasSpecial(def))) {
					down(8);
					return score;
				}
			}
			if (has(SET_STATUS_EFFECTS, effect) && (ability === "Comatose" || (ability === "Leaf Guard" && /Sun/.test(field.weather || "")))) down(10);
			if ((effect === E.SLEEP || effect === E.YAWN) && ability === "Sweet Veil") down(10);
		}
		if (atk.ability === "Prankster" && move.split === SPLIT_STATUS && !(move.target & MOVE_TARGET_FOES_FIELD) &&
			def.types.indexOf("Dark") !== -1) {
			down(10);
			return score;
		}
		if (isGrounded(def, field)) {
			if (field.terrain === "Electric" && (effect === E.SLEEP || effect === E.YAWN)) {
				down(10);
				return score;
			}
			if (field.terrain === "Misty" && (has(SET_STATUS_EFFECTS, effect) || effect === E.CONFUSE || effect === E.SWAGGER ||
				effect === E.FLATTER)) {
				down(10);
				return score;
			}
			if (field.terrain === "Psychic" && priorityOf(atk, move, field) > 0) {
				down(10);
				return score;
			}
		}
	}
	if (move.sound && atk.throatChopped) return 0;

	var standardDamage = function () {
		if (damaging && move.effectiveness === 0) down(15);
		return score;
	};
	var statusChecks = function (canApply) {
		if (!canApply) down(10);
		return score;
	};
	var selfBoost = function (stats) {
		var locked = goodAI && canBeChoiceLocked(atk);
		if (locked || atk.ability === "Contrary") return down(10);
		if (!stats.some(function (stat) {
			return canStatBeRaised(atk, stat) && (stat !== "atk" || hasRealPhysical(atk)) && (stat !== "spa" || hasSpecial(atk));
		})) down(10);
		return score;
	};

	switch (effect) {
	case E.SLEEP:
		if (move.effectiveness === 0 || (move.name === "Dark Void" && atk.name !== "Darkrai")) down(10);
		return statusChecks(canBeSlept(atk, def, field));
	case E.YAWN:
		return statusChecks(canBeSlept(atk, def, field));
	case E.PARALYZE:
		if (!canBeParalyzed(atk, def, field)) return down(10);
		if (move.name !== "Glare" && move.effectiveness === 0) down(10);
		return score;
	case E.WILL_O_WISP:
		return statusChecks(canBeBurned(atk, def, field));
	case E.POISON:
	case E.TOXIC:
		if (move.effectiveness === 0 && atk.ability !== "Corrosion") return down(10);
		return statusChecks(canBePoisoned(atk, def, field));
	case E.CONFUSE:
	case E.SWAGGER:
	case E.FLATTER:
		return statusChecks(canBeConfused(atk, def, field));
	case E.ATTACK_UP:
	case E.ATTACK_UP_2:
		if (move.name === "Hone Claws") return selfBoost(["atk", "acc"]);
		return selfBoost(["atk"]);
	case E.DEFENSE_UP:
	case E.DEFENSE_UP_2:
	case E.DEFENSE_CURL:
		return selfBoost(["def"]);
	case E.SPEED_UP:
	case E.SPEED_UP_2:
		if (turn.battle.trickRoom) return down(10);
		return selfBoost(["spe"]);
	case E.SPECIAL_ATTACK_UP:
	case E.SPECIAL_ATTACK_UP_2:
		return selfBoost(["spa"]);
	case E.SPECIAL_DEFENSE_UP:
	case E.SPECIAL_DEFENSE_UP_2:
		return selfBoost(["spd"]);
	case E.ACCURACY_UP:
	case E.ACCURACY_UP_2:
		selfBoost(["acc"]);
		if (goodAI && score > 0 && !hasMoveWhere(atk, function (m) {
			return m.accuracy && m.accuracy < 100;
		})) down(1);
		return score;
	case E.EVASION_UP:
	case E.EVASION_UP_2:
	case E.MINIMIZE:
		return selfBoost(["eva"]);
	case E.ATK_SPATK_UP:
		return selfBoost(["atk", "spa"]);
	case E.ATK_ACC_UP:
		return selfBoost(["atk", "acc"]);
	case E.DEF_SPD_UP:
	case E.COSMIC_POWER:
		return selfBoost(["def", "spd"]);
	case E.BULK_UP:
		return selfBoost(["atk", "def"]);
	case E.CALM_MIND:
		if ((move.name === "Quiver Dance" || move.name === "Geomancy") && turn.battle.trickRoom) return down(10);
		return selfBoost(move.name === "Quiver Dance" ? ["spa", "spd", "spe"] : ["spa", "spd"]);
	case E.DRAGON_DANCE:
		if (turn.battle.trickRoom) return down(10);
		return selfBoost(move.name === "Shell Smash" ? ["atk", "spa", "spe"] : ["atk", "spe"]);
	case E.EXTREME_EVOBOOST:
		return selfBoost(["atk", "def", "spa", "spd", "spe"]);
	case E.BELLY_DRUM:
		if (atk.ability === "Contrary" || healthPercent(atk) <= 50) down(10);
		return score;
	case E.CURSE:
		if (atk.types.indexOf("Ghost") !== -1) {
			if (healthPercent(atk) <= 50) down(6);
		} else if (!canStatBeRaised(atk, "atk") && !canStatBeRaised(atk, "def")) {
			down(10);
		}
		return score;
	case E.ATTACK_DOWN:
	case E.ATTACK_DOWN_2:
		if (!canStatBeLowered(atk, def, "atk") || !hasRealPhysical(def)) down(10);
		return score;
	case E.DEFENSE_DOWN:
	case E.DEFENSE_DOWN_2:
		return statusChecks(canStatBeLowered(atk, def, "def"));
	case E.SPEED_DOWN:
	case E.SPEED_DOWN_2:
		return statusChecks(canStatBeLowered(atk, def, "spe"));
	case E.SPECIAL_ATTACK_DOWN:
	case E.SPECIAL_ATTACK_DOWN_2:
		if (!canStatBeLowered(atk, def, "spa") || !hasSpecial(def)) down(10);
		return score;
	case E.SPECIAL_DEFENSE_DOWN:
	case E.SPECIAL_DEFENSE_DOWN_2:
		return statusChecks(canStatBeLowered(atk, def, "spd"));
	case E.ACCURACY_DOWN:
	case E.ACCURACY_DOWN_2:
		return statusChecks(canStatBeLowered(atk, def, "acc"));
	case E.EVASION_DOWN:
	case E.EVASION_DOWN_2:
		return statusChecks(canStatBeLowered(atk, def, "eva"));
	case E.TICKLE:
		if (!canStatBeLowered(atk, def, "atk") && (!canStatBeLowered(atk, def, "def") || !hasPhysical(def))) down(10);
		return score;
	case E.REFLECT:
		if (move.name === "Aurora Veil") {
			if (atk.sideState.auroraVeil || !isHail(field)) down(10);
			return score;
		}
		if (atk.sideState.reflect) down(10);
		return score;
	case E.LIGHT_SCREEN:
		if (atk.sideState.lightScreen) down(10);
		return score;
	case E.SPIKES:
		if (def.monsLeft <= 1) return down(10);
		if ((move.name === "Stealth Rock" && def.sideState.sr) || (move.name === "Sticky Web" && def.sideState.stickyWeb) ||
			(move.name === "Spikes" && def.sideState.spikes >= 3) || (move.name === "Toxic Spikes" && def.sideState.toxicSpikes >= 2)) down(10);
		else if (goodAI && ((move.name === "Spikes" && def.sideState.spikes >= 1) || (move.name === "Toxic Spikes" &&
			def.sideState.toxicSpikes === 1)) && hasMoveNamed(def, ["Rapid Spin", "Defog", "Mortal Spin", "Tidy Up"])) down(10);
		return score;
	case E.SANDSTORM:
		if (field.weather === "Sand") down(10);
		return score;
	case E.RAIN_DANCE:
		if (/Rain/.test(field.weather || "")) down(10);
		return score;
	case E.SUNNY_DAY:
		if (/Sun/.test(field.weather || "")) down(10);
		return score;
	case E.HAIL:
		if (isHail(field)) down(10);
		return score;
	case E.SET_TERRAIN:
		if (field.terrain && move.name.indexOf(field.terrain) === 0) down(10);
		return score;
	case E.RESTORE_HP:
	case E.MORNING_SUN:
	case E.SWALLOW:
		// Radical Red has no "heal at full HP to stall a foe taking chip damage" rule (CFRU master's -1).
		if (atk.hp === atk.maxHP) down(10);
		else if (healthPercent(atk) >= 90) down(9);
		return score;
	case E.REST:
		if (atk.hp === atk.maxHP || atk.status === "slp" || has(["Insomnia", "Vital Spirit", "Sweet Veil", "Comatose"], atk.ability) ||
			((field.terrain === "Electric" || field.terrain === "Misty") && isGrounded(atk, field))) down(10);
		if (atk.hp === atk.maxHP) down(10);
		else if (healthPercent(atk) >= 90) down(9);
		return score;
	case E.PROTECT:
		if (has(["Quick Guard", "Wide Guard", "Crafty Shield"], move.name)) return down(10);
		if (move.name === "Mat Block" && !atk.firstTurn) return down(10);
		if (move.name === "Endure" && (atk.hp === 1 || secondaryDamage(atk, field) > 0)) down(10);
		return score;
	case E.SUBSTITUTE:
		if (healthPercent(atk) <= 25) return down(10);
		if (def.ability === "Infiltrator" || hasMoveWhere(def, function (m) {
			return m.sound;
		})) down(8);
		return score;
	case E.TAUNT:
		if (def.ability === "Oblivious") down(10);
		return score;
	case E.ENCORE:
		if (def.item === "Mental Herb") return down(10);
		// No move used yet this battle: going first there is nothing to encore.
		if (hitsFirst(turn, atk, move, def) || !predicted) down(10);
		return score;
	case E.FIELD_EFFECTS:
		if (move.name === "Trick Room") {
			if (turn.battle.trickRoom ? atk.speed < def.speed : atk.speed > def.speed) down(10);
		} else if (move.name === "Gravity" && field.isGravity) {
			down(10);
		}
		return score;
	case E.TEAM_EFFECTS:
		if (move.name === "Tailwind" && (atk.sideState.tailwind || turn.battle.trickRoom)) down(10);
		return score;
	case E.FAKE_OUT:
		if (!atk.firstTurn) return down(10);
		if (canBeChoiceLocked(atk) && (def.monsLeft >= 2 || !knocksOut(turn, atk, def, i, 1)) && atk.monsLeft <= 1) down(10);
		return standardDamage();
	case E.BATON_PASS:
		if (move.name === "Baton Pass") {
			if (atk.monsLeft <= 1) return down(10);
			if (!Object.keys(atk.boosts).some(function (stat) {
				return atk.boosts[stat] > 0;
			})) down(6);
			return score;
		}
		if (move.name === "Parting Shot") {
			if (atk.monsLeft <= 1) return down(10);
			// As the game does it: a foe whose Attack and Sp. Atk can both drop.
			if (canStatBeLowered(atk, def, "atk") && canStatBeLowered(atk, def, "spa")) down(10);
			return score;
		}
		return standardDamage();
	case E.TELEPORT:
		if (atk.monsLeft <= 1) down(10);
		return score;
	case E.EXPLOSION:
		if ([atk, def].some(function (side) {
			return side.ability === "Damp";
		}) && !ignoresAbilities(atk)) return down(10);
		var explosionKOs = knocksOut(turn, atk, def, i, 1);
		if (def.monsLeft <= 1 && explosionKOs) return standardDamage();
		if (explosionKOs ? def.monsLeft >= 2 && anotherMoveKnocksOut(turn, atk, def, i) : true) down(4);
		return standardDamage();
	case E.SUCKER_PUNCH:
		if (!hasMoveWhere(def, isDamaging)) return down(10);
		if (!isSuckerPunchOkay(turn, atk, move, def)) return down(9);
		return standardDamage();
	case E.FOCUS_PUNCH:
		if (predicted && isDamaging(predicted)) return down(10);
		return standardDamage();
	case E.LEECH_SEED:
		if (def.types.indexOf("Grass") !== -1 || def.seeded || ability === "Liquid Ooze") down(10);
		return score;
	case E.HAZE:
		if (goodAI && usefulStatChanges(def, 1) + usefulStatChanges(atk, -1) < usefulStatChanges(def, -1) + usefulStatChanges(atk, 1)) down(10);
		else if (!goodAI && Object.keys(atk.boosts).some(function (stat) {
			return atk.boosts[stat] > 0;
		})) down(10);
		return score;
	case E.ROAR:
		if (willFaintFromChip(def, field) || def.seeded || (/^(psn|tox)$/.test(def.status) && secondaryDamage(def, field) >= def.maxHP / 4)) {
			return down(10);
		}
		if (move.name === "Dragon Tail" || move.name === "Circle Throw") return standardDamage();
		if (def.monsLeft <= 1 || ability === "Suction Cups") down(10);
		return score;
	case E.KNOCK_OFF:
		return standardDamage();
	case E.DREAM_EATER:
		if (!isAsleep(def) && def.ability !== "Comatose") return down(10);
		return standardDamage();
	case E.RECHARGE:
		if (knocksOut(turn, atk, def, i, 1) && anotherMoveKnocksOut(turn, atk, def, i) && atk.ability !== "Truant") down(9);
		return standardDamage();
	case E.OHKO:
		if (defAbility(atk, def) === "Sturdy" || atk.level < def.level || (move.name === "Sheer Cold" && def.types.indexOf("Ice") !== -1)) {
			return down(10);
		}
		return standardDamage();
	case E.RECOIL_IF_MISS:
		if (accuracyOf(atk, def, move, field) < 75 && atk.ability !== "Magic Guard") down(6);
		return standardDamage();
	case E.FOCUS_ENERGY:
		if (atk.focusEnergy) down(10);
		return score;
	case E.COUNTER:
	case E.MIRROR_COAT:
		if (!predicted || predicted.split === SPLIT_STATUS) return down(10);
		if (move.name === "Metal Burst" && hitsFirst(turn, atk, move, def)) return down(10);
		return standardDamage();
	case E.ENDEAVOR:
	case E.PAIN_SPLIT:
		if (atk.hp > (atk.hp + def.hp) / 2) return down(10);
		return standardDamage();
	case E.SNORE:
	case E.SLEEP_TALK:
		if (!isAsleep(atk) && atk.ability !== "Comatose") return down(10);
		return standardDamage();
	case E.FALSE_SWIPE:
		if (knocksOut(turn, atk, def, i, 1) && anotherMoveKnocksOut(turn, atk, def, i)) down(10);
		return standardDamage();
	case E.PERISH_SONG:
		if ((atk.monsLeft <= 1 && atk.ability !== "Soundproof" && def.monsLeft >= 2) || def.ability === "Soundproof") down(10);
		return score;
	case E.MEMENTO:
		if (atk.monsLeft <= 1) return down(10);
		return move.name === "Final Gambit" ? standardDamage() : score;
	case E.HELPING_HAND:
	case E.FOLLOW_ME:
	case E.INSTRUCT_AFTER_YOU_QUASH:
		down(10);
		return score;
	case E.SEMI_INVULNERABLE:
	case E.SOLARBEAM:
	case E.SKULL_BASH:
	case E.SKY_ATTACK:
	case E.RAZOR_WIND:
		if (needsCharge(atk, move, field)) {
			if (willFaintFromChip(atk, field)) return down(10);
			if (goodAI && !isIncapacitated(def) && def.status !== "par") {
				if (hasProtectMove(def) && !willFaintFromChip(def, field)) down(8);
				else if (atk.speed > def.speed ? canKnockOut(turn, def, atk) && predicted : can2HKO(turn, def, atk) && predicted) {
					down(atk.speed > def.speed ? 4 : 8);
				}
			}
		}
		return standardDamage();
	case E.RECOIL:
		if (atk.ability !== "Magic Guard" && atk.ability !== "Rock Head" && move.recoil && def.monsLeft > 1) {
			var recoil = Math.floor(moveDamage(turn, atk, def, i) * move.recoil[0] / move.recoil[1]);
			if (recoil >= atk.hp && (!knocksOut(turn, atk, def, i, 1) || anotherMoveKnocksOut(turn, atk, def, i))) down(4);
		}
		return standardDamage();
	}
	return standardDamage();
}

// CountUsefulStatChanges: raised (sign 1) or lowered (sign -1) stages of the stats the side uses.
function usefulStatChanges(side, sign) {
	var total = 0;
	var all = hasMoveNamed(side, ["Stored Power", "Power Trip"]);
	Object.keys(side.boosts).forEach(function (stat) {
		var change = side.boosts[stat] * sign;
		if (change <= 0) return;
		if (all || (stat === "atk" && hasPhysical(side)) || (stat === "spa" && hasSpecial(side)) ||
			stat === "def" || stat === "spd" || stat === "spe") total += change;
	});
	return total;
}

/* ---------------------------------------------------------------------------------------------
 * AIScript_Positives: points for good moves, then DamageMoveViabilityIncrease for every attack.
 */
function scorePositives(turn, atk, def, i, score) {
	var move = atk.moves[i];
	var field = turn.battle.field;
	var predicted = turn.predicted(def);
	var effect = move.effect;
	var style = styleOf(turn, atk);
	var up = function (amount) {
		score = Math.min(255, score + amount);
	};
	var status = function (boost) {
		up(statusBonus(turn, atk, def, boost));
	};
	var raise = function (stat, limit, boost) {
		if (atk.ability === "Contrary") return false;
		if (!goodIdeaToRaise(turn, atk, def, stat)) return false;
		up(statBonus(turn, atk, def, move, stat, limit, boost));
		return true;
	};
	var substituteBlocks = false; // nobody is assumed to be behind a Substitute
	var strongChance = move.chance >= 75 && !substituteBlocks;

	switch (effect) {
	case E.SLEEP:
	case E.YAWN:
		up(sleepBonus(turn, atk, def, move));
		break;
	case E.PARALYZE:
	case E.PARALYZE_HIT:
		if (effect === E.PARALYZE_HIT && !strongChance) break;
		if (!canBeParalyzed(atk, def, field) || badIdeaToStatus(atk, def, "par", field)) break;
		status((def.speed >= atk.speed && def.speed / 2 < atk.speed) || hasMoveNamed(atk, HEX_MOVES) ||
			hasEffect(atk, [E.FLINCH_HIT]) ? 2 : 1);
		break;
	case E.WILL_O_WISP:
	case E.BURN_HIT:
		if (effect === E.BURN_HIT && !strongChance) break;
		if (!canBeBurned(atk, def, field) || badIdeaToStatus(atk, def, "brn", field)) break;
		if (predicted && predicted.split === SPLIT_PHYSICAL && knocksOut(turn, def, atk, def.moves.indexOf(predicted), 1)) status(3);
		else status(hasMoveNamed(atk, HEX_MOVES) || hasPhysical(def) ? 2 : 1);
		break;
	case E.POISON:
	case E.TOXIC:
	case E.POISON_HIT:
	case E.BAD_POISON_HIT:
		if ((effect === E.POISON_HIT || effect === E.BAD_POISON_HIT) && !strongChance) break;
		if (!canBePoisoned(atk, def, field) || badIdeaToStatus(atk, def, "psn", field)) break;
		status(hasMoveNamed(atk, ["Venoshock", "Barb Barrage", "Venom Drench"]) || atk.ability === "Merciless" ? 2 : 1);
		break;
	case E.CONFUSE:
	case E.CONFUSE_HIT:
		if (effect === E.CONFUSE_HIT && !strongChance) break;
		if (canBeConfused(atk, def, field)) status(def.status === "par" ? 2 : 1);
		break;
	case E.SWAGGER:
	case E.FLATTER:
		if (hasMoveNamed(atk, ["Foul Play", "Psych Up"])) status(2);
		else if (canBeConfused(atk, def, field)) status(def.status === "par" ? 2 : 1);
		break;
	case E.ATTACK_UP:
	case E.ATTACK_UP_2:
		if (move.name === "Hone Claws") {
			if (!raise("atk", 8, 2)) raise("acc", 12, 2);
		} else {
			raise("atk", 8, 2);
		}
		break;
	case E.DEFENSE_UP:
	case E.DEFENSE_UP_2:
		var defense = atk.ability === "Contrary" ? 0 : goodIdeaToRaise(turn, atk, def, "def");
		if (defense === 1) up(statBonus(turn, atk, def, move, "atk", 10, 2));
		else if (defense === 2) up(statBonus(turn, atk, def, move, "def", 8, 1));
		break;
	case E.SPECIAL_ATTACK_UP:
	case E.SPECIAL_ATTACK_UP_2:
		raise("spa", 8, 2);
		break;
	case E.SPECIAL_DEFENSE_UP:
	case E.SPECIAL_DEFENSE_UP_2:
		raise("spd", 10, 1);
		break;
	case E.SPEED_UP:
	case E.SPEED_UP_2:
		raise("spe", 8, 3);
		break;
	case E.ACCURACY_UP:
	case E.ACCURACY_UP_2:
		raise("acc", 12, 2);
		break;
	case E.EVASION_UP:
	case E.EVASION_UP_2:
	case E.MINIMIZE:
		raise("eva", 12, 4);
		break;
	case E.ATK_SPATK_UP:
		if (!(hasPhysical(atk) && raise("atk", 8, 2))) raise("spa", 8, 2);
		break;
	case E.ATK_ACC_UP:
		if (!raise("atk", 8, 2)) raise("acc", 12, 2);
		break;
	case E.DEF_SPD_UP:
	case E.COSMIC_POWER:
		if (!raise("def", 8, 1)) raise("spd", 8, 1);
		break;
	case E.BULK_UP:
		if (!(hasPhysical(atk) && raise("atk", 8, 2))) raise("def", 8, 1);
		break;
	case E.CALM_MIND:
		if (move.name === "Quiver Dance" && raise("spe", 8, 3)) break;
		if (!raise("spa", 8, 2)) raise("spd", 8, 1);
		break;
	case E.DRAGON_DANCE:
		if (raise("spe", 8, 3)) break;
		if (!raise("atk", 8, 2) && move.name === "Shell Smash") raise("spa", 8, 2);
		break;
	case E.EXTREME_EVOBOOST:
		if (predicted && predicted.effect === E.ROAR) break;
		if (!raise("atk", 8, 2) && !raise("spa", 8, 2)) raise("spe", 8, 3);
		break;
	case E.BELLY_DRUM:
		if (hasPhysical(atk) && atk.ability !== "Contrary" && !badIdeaToRaiseStat(turn, atk, def, "atk")) {
			up(statBonus(turn, atk, def, move, "atk", 8, 2));
		}
		break;
	case E.CURSE:
		if (atk.types.indexOf("Ghost") !== -1) status(1);
		else if (atk.ability !== "Contrary" && atk.ability !== "Magic Guard" && !(predicted && predicted.effect === E.ROAR)) {
			if (hasMoveNamed(atk, ["Gyro Ball"])) up(statBonus(turn, atk, def, move, "atk", 12, 4));
			else if (stage(atk, "spe") >= 3) {
				if (stage(atk, "atk") < 8) up(statBonus(turn, atk, def, move, "atk", 8, 2));
				else if (stage(atk, "def") < 8) up(statBonus(turn, atk, def, move, "def", 8, 1));
			}
		}
		break;
	case E.ATTACK_UP_HIT:
	case E.SPECIAL_ATTACK_UP_HIT:
		if (move.chance >= 75) raise(effect === E.ATTACK_UP_HIT ? "atk" : "spa", 8, 2);
		break;
	case E.SPEED_UP_1_HIT:
		if (move.chance >= 75) raise("spe", 8, 3);
		break;
	case E.ATTACK_DOWN:
	case E.ATTACK_DOWN_2:
		if (goodIdeaToLower(turn, def, atk, move, "atk")) status(1);
		break;
	case E.DEFENSE_DOWN:
	case E.DEFENSE_DOWN_2:
		if (goodIdeaToLower(turn, def, atk, move, "def")) status(1);
		break;
	case E.SPEED_DOWN:
	case E.SPEED_DOWN_2:
		if (goodIdeaToLower(turn, def, atk, move, "spe")) status(2);
		break;
	case E.SPECIAL_ATTACK_DOWN:
	case E.SPECIAL_ATTACK_DOWN_2:
	case E.SPECIAL_DEFENSE_DOWN:
	case E.SPECIAL_DEFENSE_DOWN_2:
	case E.ACCURACY_DOWN:
	case E.ACCURACY_DOWN_2:
	case E.PLAY_NICE:
	case E.VENOM_DRENCH:
	case E.TICKLE:
		status(1);
		break;
	case E.EVASION_DOWN:
	case E.EVASION_DOWN_2:
		status(2);
		break;
	case E.SPEED_DOWN_HIT:
		if (move.chance >= 50 && goodIdeaToLower(turn, def, atk, move, "spe")) up(3);
		break;
	case E.REFLECT:
	case E.LIGHT_SCREEN:
		if (shouldSetUpScreens(turn, atk, def, move)) {
			if (style === STYLE.SETUP_SCREENS || style === STYLE.SUPPORT_SCREENS) up(move.name === "Aurora Veil" ? 8 : 7);
			else status(2);
		}
		break;
	case E.SPIKES:
		if (def.monsLeft > 1) up(hazardBonus(turn, atk, def, move));
		break;
	case E.SANDSTORM:
		if (atk.types.some(function (t) {
			return has(["Rock", "Ground", "Steel"], t);
		}) || has(["Sand Veil", "Sand Rush", "Sand Force", "Overcoat", "Magic Guard"], atk.ability) ||
			has(["Safety Goggles", "Smooth Rock"], atk.item) || hasMoveNamed(atk, ["Shore Up", "Weather Ball"])) status(2);
		break;
	case E.RAIN_DANCE:
		if (atk.item !== "Utility Umbrella" && (has(["Swift Swim", "Forecast", "Hydration", "Rain Dish", "Dry Skin"], atk.ability) ||
			hasEffect(atk, [E.THUNDER]) || hasMoveWhere(atk, function (m) {
			return m.type === "Water" && m.split !== SPLIT_STATUS;
		}) || hasMoveNamed(atk, ["Weather Ball"]) || atk.item === "Damp Rock" || hasMoveWhere(def, function (m) {
			return (m.type === "Fire" && m.split !== SPLIT_STATUS) || m.effect === E.MORNING_SUN;
		}))) status(2);
		break;
	case E.SUNNY_DAY:
		if (atk.item !== "Utility Umbrella" && (has(["Chlorophyll", "Flower Gift", "Forecast", "Leaf Guard", "Solar Power",
			"Harvest"], atk.ability) || hasEffect(atk, [E.SOLARBEAM, E.MORNING_SUN]) || hasMoveNamed(atk, ["Weather Ball", "Growth"]) ||
			hasMoveWhere(atk, function (m) {
				return m.type === "Fire" && m.split !== SPLIT_STATUS;
			}) || atk.item === "Heat Rock" || hasMoveWhere(def, function (m) {
			return m.effect === E.THUNDER || (m.type === "Water" && m.split !== SPLIT_STATUS);
		}))) status(2);
		break;
	case E.HAIL:
		if (hasMoveNamed(atk, ["Aurora Veil"]) && (style === STYLE.SETUP_SCREENS || style === STYLE.SUPPORT_SCREENS)) up(8);
		else if (has(["Snow Cloak", "Ice Body", "Forecast", "Slush Rush", "Magic Guard", "Overcoat"], atk.ability) ||
			hasMoveNamed(atk, ["Blizzard", "Aurora Veil", "Weather Ball"]) || atk.item === "Icy Rock" || hasEffect(def, [E.MORNING_SUN])) status(2);
		break;
	case E.SET_TERRAIN:
		status(2);
		break;
	case E.RESTORE_HP:
	case E.MORNING_SUN:
	case E.SWALLOW:
		if (shouldRecover(turn, atk, def, move)) {
			if (style === STYLE.STALL || style === STYLE.PHAZING) up(8);
			else status(3);
		}
		break;
	case E.ABSORB:
		if (shouldRecover(turn, atk, def, move)) {
			if (style === STYLE.STALL) status(2);
			else up(3);
		}
		break;
	case E.WISH:
		if (shouldRecover(turn, atk, def, move)) status(3);
		break;
	case E.REST:
		if (atk.item === "Chesto Berry" || atk.item === "Lum Berry" || hasEffect(atk, [E.SLEEP_TALK, E.SNORE]) ||
			has(["Shed Skin", "Early Bird"], atk.ability) || (atk.ability === "Hydration" && /Rain/.test(field.weather || ""))) {
			if (shouldRecover(turn, atk, def, move)) status(3);
		} else if (secondaryDamage(def, field) > 0 && style === STYLE.STALL) {
			up(8);
		} else if (atk.status && turn.coin("rest", 0.5) && shouldRecover(turn, atk, def, move)) {
			status(3);
		}
		break;
	case E.PROTECT:
		if (has(["Quick Guard", "Wide Guard", "Crafty Shield"], move.name)) break;
		if (move.name === "Endure") {
			if (canKnockOut(turn, def, atk) && ((/Berry$/.test(atk.item) && atk.hp > atk.maxHP / 4) ||
				(hasMoveNamed(atk, ["Flail", "Reversal", "Endeavor"]) && atk.hp > 1))) status(3);
			break;
		}
		if (shouldProtect(turn, atk, def)) up(protectBonus(turn, atk, def));
		break;
	case E.SUBSTITUTE:
		if (shouldUseSubstitute(turn, atk, def, move)) up(substituteBonus(turn, atk, def));
		break;
	case E.TAUNT:
		if (isAsleep(def) && !hasEffect(def, [E.SLEEP_TALK])) break;
		// Radical Red: +8 against any foe with a status move, and no Choice-item check.
		var foeHasStatusMove = hasMoveWhere(def, function (m) {
			return m.split === SPLIT_STATUS;
		});
		if (foeHasStatusMove) up(8);
		if ((predicted && predicted.split === SPLIT_STATUS) || isGoodToTaunt(styleOf(turn, def))) status(3);
		else if (foeHasStatusMove) status(2);
		break;
	case E.ENCORE:
		if (def.item !== "Mental Herb" && !hitsFirst(turn, atk, move, def) && predicted && predicted.split === SPLIT_STATUS) status(3);
		break;
	case E.FIELD_EFFECTS:
		if (move.name === "Trick Room" && !turn.battle.trickRoom && atk.speed < def.speed) status(3);
		break;
	case E.TEAM_EFFECTS:
		if (move.name === "Tailwind") {
			status(has([STYLE.SETUP_SCREENS, STYLE.BATON_PASS, STYLE.CLERIC, STYLE.SUPPORT_SCREENS, STYLE.PHAZING], style) ? 2 : 1);
		}
		break;
	case E.FAKE_OUT:
		if (shouldUseFakeOut(turn, atk, def, move)) up(8);
		break;
	case E.BATON_PASS:
	case E.TELEPORT:
		if (move.name === "Baton Pass") {
			if (style === STYLE.BATON_PASS) up(3);
			break;
		}
		var pivot = shouldPivot(turn, atk, def, i);
		if (pivot === "pivot") up(pivotBonus(style));
		else if (pivot === "dont") {
			score = Math.max(0, score - 9);
			if (isStrongest(turn, atk, def, i)) recalcStrongestIgnoring(turn, atk, def, i);
		}
		break;
	case E.EXPLOSION:
		if (predicted && predicted.effect !== E.PROTECT) {
			if (!anotherMoveKnocksOut(turn, atk, def, i) && (atk.speed >= def.speed ?
				can2HKO(turn, atk, def) && !canKnockOut(turn, def, atk) : can2HKO(turn, atk, def) && !can2HKO(turn, def, atk))) break;
			up(4);
		}
		break;
	case E.LEECH_SEED:
		if (def.types.indexOf("Grass") === -1 && !def.seeded && !hasMoveNamed(def, ["Rapid Spin"]) &&
			!has(["Liquid Ooze", "Magic Guard"], def.ability)) status(3);
		break;
	case E.DESTINY_BOND:
		if (hitsFirst(turn, atk, move, def) ? canKnockOut(turn, def, atk) : can2HKO(turn, def, atk)) status(3);
		break;
	case E.HAZE:
	case E.REMOVE_TARGET_STAT_CHANGES:
		if (shouldPhaze(turn, atk, def, i)) {
			if (style === STYLE.PHAZING) up(8);
			else status(2);
		} else if (effect === E.HAZE && usefulStatChanges(atk, -1) > 0) {
			status(1);
		}
		break;
	case E.ROAR:
		if (shouldPhaze(turn, atk, def, i)) {
			if (style === STYLE.PHAZING) up(canKnockOut(turn, def, atk) && move.priority < 0 ? 1 : 8);
			else status(2);
		}
		break;
	case E.KNOCK_OFF:
		if (def.item && !has(["Iron Ball", "Lagging Tail", "Sticky Barb"], def.item) && def.ability !== "Sticky Hold" &&
			!/ite$/.test(def.item) && !hasMoveNamed(atk, ["Poltergeist"]) && !anotherMoveKnocksOut(turn, atk, def, -1)) up(3);
		break;
	case E.FOCUS_ENERGY:
		status(has(["Super Luck", "Sniper"], atk.ability) || atk.item === "Scope Lens" ? 2 : 1);
		break;
	case E.MEMENTO:
		if (move.name !== "Final Gambit") score = Math.max(0, score - 5);
		break;
	case E.BRICK_BREAK:
		if (def.sideState.reflect || def.sideState.lightScreen || def.sideState.auroraVeil) {
			if (isSweeper(style)) up(3);
			else status(2);
		}
		break;
	case E.SNORE:
	case E.SLEEP_TALK:
		if (isAsleep(atk)) up(10);
		break;
	}
	if (isDamaging(move)) score = damageMoveBonus(turn, atk, def, i, score);
	return Math.min(score, 255);
}

function sleepBonus(turn, atk, def, move) {
	var field = turn.battle.field;
	if (badIdeaToStatus(atk, def, "slp", field) || !canBeSlept(atk, def, field)) return 0;
	if (move.effect === E.YAWN && canKnockOut(turn, atk, def)) return 0;
	var accurate = accuracyOf(atk, def, move, field) >= 80;
	var three = statusBonus(turn, atk, def, 3);
	switch (styleOf(turn, atk)) {
	case STYLE.KILL:
		return 0;
	case STYLE.SETUP_STATS:
	case STYLE.BATON_PASS:
	case STYLE.PHAZING:
		return accurate ? 9 : three;
	case STYLE.SETUP_STATUS:
	case STYLE.SETUP_SCREENS:
	case STYLE.SUPPORT_SCREENS:
	case STYLE.HAZARDS:
		return accurate ? 8 : three;
	case STYLE.CLERIC:
		return accurate ? 7 : three;
	}
	return three;
}

function shouldSetUpScreens(turn, atk, def, move) {
	if (move.name === "Aurora Veil") return isHail(turn.battle.field) && !atk.sideState.auroraVeil &&
		!(atk.sideState.reflect && atk.sideState.lightScreen);
	var physical = move.effect === E.REFLECT;
	var wanted = physical ? hasPhysical(def) : hasSpecial(def);
	if (!wanted) return false;
	if (!hasMoveWhere(def, isDamaging)) return true;
	var predicted = turn.predicted(def);
	var other = physical ? E.LIGHT_SCREEN : E.REFLECT;
	if (hasPhysical(def) && hasSpecial(def) && hasEffect(atk, [other]) && predicted &&
		predicted.split === (physical ? SPLIT_SPECIAL : SPLIT_PHYSICAL)) return false;
	return true;
}

function hazardBonus(turn, atk, def, move) {
	var style = styleOf(turn, atk);
	var worth = def.monsLeft !== 2;
	switch (style) {
	case STYLE.KILL:
		return 0;
	case STYLE.SETUP_STATS:
	case STYLE.SETUP_STATUS:
		return worth ? statusBonus(turn, atk, def, 2) : 0;
	case STYLE.STALL:
	case STYLE.CLERIC:
	case STYLE.SETUP_SCREENS:
	case STYLE.SUPPORT_SCREENS:
		return statusBonus(turn, atk, def, worth ? 2 : 1);
	case STYLE.BATON_PASS:
		return (atk.speed > def.speed ? !canKnockOut(turn, def, atk) && !willFaintFromChip(atk, turn.battle.field) :
			!can2HKO(turn, def, atk)) ? 4 : 0;
	case STYLE.PHAZING:
		return statusBonus(turn, atk, def, def.monsLeft === 2 ? 2 : 3);
	case STYLE.HAZARDS:
		return {"Sticky Web": 7, "Stealth Rock": 6, "Toxic Spikes": 5}[move.name] || 4;
	}
	return 0;
}

function healAmount(atk, def, move, field) {
	var max = atk.maxHP;
	var heal;
	switch (move.effect) {
	case E.REST:
		heal = max;
		break;
	case E.MORNING_SUN:
		if (move.name === "Shore Up") heal = field.weather === "Sand" ? max : max / 2;
		else if (/Sun/.test(field.weather || "")) heal = max;
		else heal = field.weather ? max / 4 : max / 2;
		break;
	case E.ABSORB:
		heal = 0; // the drain is worked out from the damage below
		break;
	default:
		heal = move.name === "Life Dew" || move.name === "Jungle Healing" ? max / 4 : max / 2;
	}
	return Math.min(Math.floor(heal), max - 1);
}

// ShouldRecover: healing keeps the AI out of KO range.
function shouldRecover(turn, atk, def, move) {
	var field = turn.battle.field;
	var heal = healAmount(atk, def, move, field);
	if (move.effect === E.ABSORB) {
		var i = atk.moves.indexOf(move);
		heal = Math.min(Math.floor(moveDamage(turn, atk, def, i) * (move.drain ? move.drain[0] / move.drain[1] : 0.5) *
			(atk.item === "Big Root" ? 1.3 : 1)), atk.maxHP - 1);
	}
	if (hitsFirst(turn, atk, move, def)) {
		if (canKnockOut(turn, def, atk) && !canKnockOutAfterHealing(turn, def, atk, heal)) return true;
		return can2HKO(turn, def, atk) && !isIncapacitated(def) && heal > atk.hp && (turn.simulatedRNG(1) & 1) === 0;
	}
	return !canKnockOut(turn, def, atk) && !isIncapacitated(def) && can2HKO(turn, def, atk) &&
		!canKnockOutAfterHealing(turn, def, atk, heal, true);
}

// CanKnockOutAfterHealing (one hit), from the healed HP (or after a hit first, when dealOneHitFirst).
function canKnockOutAfterHealing(turn, atk, def, heal, dealOneHitFirst) {
	var field = turn.battle.field;
	for (var i = 0; i < 4; i++) {
		if (!atk.moves[i] || !isUsable(atk, i, field)) continue;
		var damage = moveDamage(turn, atk, def, i);
		var hp;
		if (dealOneHitFirst) {
			if (damage >= def.hp) return true;
			hp = Math.min(def.hp - damage + heal + passiveRecovery(def, field) - secondaryDamage(def, field), def.maxHP);
		} else {
			hp = Math.min(def.hp + heal, def.maxHP);
		}
		if (damage >= hp) return true;
	}
	return false;
}

function shouldProtect(turn, atk, def) {
	var field = turn.battle.field;
	if ((willFaintFromChip(atk, field) && !has(["Moxie", "Beast Boost", "Chilling Neigh", "Grim Neigh"], def.ability)) ||
		isIncapacitated(def)) return false;
	if ((atk.item === "Toxic Orb" && !atk.status && (has(["Poison Heal", "Toxic Boost", "Quick Feet", "Magic Guard"], atk.ability) ||
		hasMoveNamed(atk, ["Facade"]))) || (atk.item === "Flame Orb" && !atk.status &&
		(has(["Guts", "Flare Boost", "Magic Guard"], atk.ability) || hasMoveNamed(atk, ["Facade"])))) return true;
	if (atk.ability === "Speed Boost" && atk.speed <= def.speed && stage(atk, "spe") < 12) return true;
	if (atk.ability === "Moody") return true;
	if (willFaintFromChip(def, field)) return true;
	var predicted = turn.predicted(def);
	if (predicted && predicted.effect === E.EXPLOSION) return true;
	var passive = passiveRecovery(atk, field);
	if (canKnockOut(turn, def, atk)) return !canKnockOutAfterHealing(turn, def, atk, passive) || secondaryDamage(def, field) > 0;
	if (can2HKO(turn, def, atk)) return secondaryDamage(def, field) > 0 || !twoHitsAfterHealing(turn, def, atk, passive);
	return false;
}

function twoHitsAfterHealing(turn, atk, def, heal) {
	var field = turn.battle.field;
	for (var i = 0; i < 4; i++) {
		if (!atk.moves[i] || !isUsable(atk, i, field)) continue;
		if (finalDamage(turn, atk, def, i, 2) >= Math.min(def.hp + heal, def.maxHP)) return true;
	}
	return false;
}

function protectBonus(turn, atk, def) {
	switch (styleOf(turn, atk)) {
	case STYLE.STALL:
		return 3;
	case STYLE.KILL:
	case STYLE.BATON_PASS:
		return 0;
	}
	return statusBonus(turn, atk, def, 3);
}

function shouldUseSubstitute(turn, atk, def, move) {
	if (isIncapacitated(def)) return true;
	var predicted = turn.predicted(def);
	if (!predicted) return turn.predictedSwitch[def.key];
	var index = def.moves.indexOf(predicted);
	var damage = moveDamage(turn, def, atk, index);
	if (hitsFirst(turn, atk, move, def)) return damage < atk.maxHP / 4;
	return atk.hp - damage > atk.maxHP / 4;
}

function substituteBonus(turn, atk, def) {
	return {1: 0, 2: 8, 3: statusBonus(turn, atk, def, 2), 5: 5, 6: 4, 7: 4, 4: 3, 8: 3, 9: 5, 10: 3}[styleOf(turn, atk)] || 0;
}

function shouldUseFakeOut(turn, atk, def, move) {
	if (!atk.firstTurn || isAsleep(def) || has(["Inner Focus", "Shield Dust"], defAbility(atk, def))) return false;
	if (!hitsFirst(turn, atk, move, def)) return false;
	if (canBeChoiceLocked(atk) && atk.monsLeft <= 1) return def.monsLeft <= 1 && knocksOut(turn, atk, def, atk.moves.indexOf(move), 1);
	return true;
}

// ShouldPivot, without knowing the AI's party (as if no switch-in stands out).
function shouldPivot(turn, atk, def, i) {
	var move = atk.moves[i];
	if (atk.monsLeft <= 1) return "try";
	if (atk.sideState.sr && atk.item !== "Heavy-Duty Boots" && atk.ability !== "Magic Guard") {
		var effectiveness = atk.rockEffectiveness || 1;
		if (atk.maxHP * effectiveness / 8 >= atk.maxHP / 4) return "dont";
	}
	if (turn.predictedSwitch[def.key]) return "pivot";
	var style = styleOf(turn, atk);
	if (hitsFirst(turn, atk, move, def)) {
		if (!anotherMoveKnocksOut(turn, atk, def, i)) {
			if (canKnockOut(turn, atk, def)) return "try";
			if (isDamager(style) && can2HKO(turn, atk, def)) {
				if (canKnockOut(turn, def, atk)) return "pivot";
			}
			if (def.hp === def.maxHP && (def.item === "Focus Sash" || def.ability === "Sturdy" || def.ability === "Multiscale")) return "pivot";
		}
	} else {
		if (canKnockOut(turn, def, atk)) return "try";
		if (can2HKO(turn, def, atk) && !anotherMoveKnocksOut(turn, atk, def, i) && knocksOut(turn, atk, def, i, 1)) return "try";
		if (canKnockOut(turn, atk, def) && !anotherMoveKnocksOut(turn, atk, def, i)) return "try";
		if (can2HKO(turn, atk, def) && def.hp === def.maxHP && (def.item === "Focus Sash" || def.ability === "Sturdy")) return "pivot";
	}
	return "dont";
}

function pivotBonus(style) {
	return {1: 3, 2: 9, 3: 9, 5: 9, 6: 9, 7: 7, 4: 7, 8: 7, 9: 4, 10: 3}[style] || 3;
}

// RecalcStrongestMoveIgnoringMove: a pivot move the AI won't use stops counting as its strongest.
function recalcStrongestIgnoring(turn, atk, def, ignore) {
	var best = 0;
	var strongest = 0;
	for (var i = 0; i < 4; i++) {
		if (i === ignore || !atk.moves[i] || !isUsable(atk, i, turn.battle.field) || atk.moves[i].power === 0) continue;
		var damage = moveDamage(turn, atk, def, i);
		if (damage > best) {
			best = damage;
			strongest = i;
		}
	}
	turn.cache["strongest" + atk.key] = strongest;
}

function shouldPhaze(turn, atk, def, i) {
	if (anotherMoveKnocksOut(turn, atk, def, i) || canKnockOut(turn, atk, def)) return false;
	if (atk.moves[i].effect === E.ROAR && styleOf(turn, atk) === STYLE.PHAZING && (def.sideState.sr || def.sideState.spikes)) return true;
	return usefulStatChanges(def, 1) > 0;
}

// DamageMoveViabilityIncrease (singles): the KO, desperation and strongest-move bonuses.
function damageMoveBonus(turn, atk, def, i, score) {
	var move = atk.moves[i];
	var field = turn.battle.field;
	var predicted = turn.predicted(def);
	var style = styleOf(turn, atk);
	var switching = turn.predictedSwitch[def.key];
	var suckerPunchRule = function () {
		return !(predicted && predicted.effect === E.SUCKER_PUNCH) || isDamager(style) ||
			(priorityOf(atk, move, field) > 0 && atk.speed > def.speed);
	};
	var up = function (amount) {
		return Math.min(255, score + amount);
	};
	var helpsAccuracy = hasEffect(atk, [E.ACCURACY_UP, E.ACCURACY_UP_2, E.EVASION_DOWN, E.EVASION_DOWN_2, E.LOCK_ON,
		E.ATK_ACC_UP]) || hasMoveNamed(atk, ["Coil", "Defog"]);
	var noProtect = !hasProtectMove(atk);
	var chipSafe = !willFaintFromChip(def, field) || (predicted && (predicted.effect === E.RESTORE_HP ||
		predicted.effect === E.MORNING_SUN)) || has(["Moxie", "Beast Boost", "Chilling Neigh", "Grim Neigh"], atk.ability);

	if (!switching && knocksOutWithBestAccuracy(turn, atk, def, i, true) &&
		(accuracyOf(atk, def, move, field) >= 70 || !helpsAccuracy || canKnockOut(turn, def, atk))) {
		return suckerPunchRule() ? up(9) : score;
	}
	if (!switching && noProtect && !hitsFirst(turn, atk, move, def) && knocksOutWithBestAccuracy(turn, atk, def, i, false) && chipSafe) {
		return up(slowKOBonus(turn, atk, def));
	}
	var predictedIndex = predicted ? def.moves.indexOf(predicted) : -1;
	if (noProtect && predictedIndex !== -1 && knocksOut(turn, def, atk, predictedIndex, 1) &&
		strongestGoesFirst(turn, atk, def) === i &&
		(style !== STYLE.HAZARDS || (turn.simulatedRNG(3) & 1)) &&
		(style !== STYLE.PHAZING || (priorityOf(atk, move, field) > 0 && atk.speed < def.speed)) &&
		(style !== STYLE.STALL || (priorityOf(atk, move, field) > 0 && atk.speed < def.speed)) &&
		!(hasEffect(atk, [E.FAKE_OUT]) && shouldUseFakeOut(turn, atk, def, atk.moves.filter(function (m) {
			return m && m.effect === E.FAKE_OUT;
		})[0]))) {
		if (suckerPunchRule()) return up(9);
		if (!isStrongest(turn, atk, def, i)) return score;
	}
	if (isStrongest(turn, atk, def, i) && (hitsFirst(turn, atk, move, def) || chipSafe)) {
		if (score === 100 && knocksOut(turn, atk, def, i, 1) && !(predicted && (predicted.effect === E.RESTORE_HP ||
			predicted.effect === E.ABSORB))) {
			return up({7: 5, 8: 6, 6: 6, 9: 8, 5: 8, 10: 4}[style] || 2);
		}
		return up(2);
	}
	return score;
}

function slowKOBonus(turn, atk, def) {
	var lastFoe = (canKnockOut(turn, def, atk) || can2HKO(turn, def, atk)) && def.monsLeft <= 1;
	var foe2HKO = can2HKO(turn, def, atk);
	switch (styleOf(turn, atk)) {
	case STYLE.SETUP_STATS:
		return lastFoe ? 8 : 6;
	case STYLE.STALL:
		return lastFoe ? 9 : 8;
	case STYLE.BATON_PASS:
		return lastFoe ? 9 : !foe2HKO ? 3 : 8;
	case STYLE.CLERIC:
		return lastFoe ? 9 : !foe2HKO ? 6 : 7;
	case STYLE.SETUP_SCREENS:
	case STYLE.SUPPORT_SCREENS:
		return lastFoe ? 9 : !foe2HKO ? 6 : 9;
	case STYLE.PHAZING:
		return lastFoe ? 9 : 8;
	case STYLE.HAZARDS:
		return lastFoe ? 9 : !foe2HKO ? 3 : 6;
	}
	return 8;
}

/* ---------------------------------------------------------------------------------------------
 * The decision.
 */
function runScripts(turn, atk, def, flags, signed) {
	var field = turn.battle.field;
	var scores = [];
	for (var i = 0; i < 4; i++) scores[i] = isUsable(atk, i, field) ? 100 : 0;
	var previous = turn.flags;
	turn.flags = flags;
	[AI_NEGATIVES, AI_SEMI_SMART, AI_POSITIVES].forEach(function (bit) {
		if (!(flags & bit)) return;
		// Semi Smart does nothing once Positives runs; on its own it is the damage bonuses only.
		if (bit === AI_SEMI_SMART && (flags & AI_POSITIVES)) return;
		for (var j = 0; j < 4; j++) {
			if (!atk.moves[j] || scores[j] <= 0) {
				scores[j] = 0;
				continue;
			}
			var value = scores[j] & 0xFF;
			if (bit === AI_NEGATIVES) value = scoreNegatives(turn, atk, def, j, value);
			else if (bit === AI_POSITIVES) value = scorePositives(turn, atk, def, j, value);
			else if (isDamaging(atk.moves[j])) value = damageMoveBonus(turn, atk, def, j, value);
			scores[j] = signed && value >= 128 ? value - 256 : value;
		}
	});
	turn.flags = previous;
	return scores;
}

// Your move, as the AI predicts it before choosing its own (always with the smart flags).
function predictPlayer(turn) {
	var battle = turn.battle;
	var player = battle.player;
	var ai = battle.ai;
	turn.phase = "p";
	turn.cache = {};
	turn.prediction[ai.key] = null;
	var index = null;
	if (!(isAsleep(player) && !hasEffect(player, [E.SLEEP_TALK, E.SNORE])) && player.hp > 0) {
		var values = runScripts(turn, player, ai, AI_SMART_FLAGS, false);
		var best = Math.max.apply(null, values);
		if (best < 100) {
			turn.predictedSwitch[player.key] = true;
		} else {
			var ties = [];
			values.forEach(function (value, i) {
				if (value === best && player.moves[i]) ties.push(i);
			});
			index = ties.length === 1 ? ties[0] : ties[turn.rng.pick(ties.map(function () {
				return 1 / ties.length;
			}))];
		}
	}
	turn.prediction[player.key] = index;
	turn.phase = "a";
	turn.cache = {};
}

// ChooseMoveOrAction_Singles: the shares of the four slots after scoring (with the s8 quirk).
function chooseShares(scores, moves) {
	var best = scores[0] & 0xFF;
	var list = [0];
	for (var i = 1; i < 4; i++) {
		if (!moves[i]) continue;
		var s = scores[i];
		if (best === s) {
			list.push(i);
		} else if (best < s) {
			best = s & 0xFF;
			list = [i];
		}
	}
	var shares = [0, 0, 0, 0];
	list.forEach(function (i) {
		shares[i] = 1 / list.length;
	});
	return shares;
}

/*
 * The chance (0-1) the AI picks each of `battle.ai`'s four moves.
 * battle: {ai: side, player: side, field: calc Field (AI's view), trickRoom, flags}
 */
function predictAIMoves(battle) {
	var shares = enumerateChances(function (rng) {
		var turn = new AITurn(rng, battle);
		predictPlayer(turn);
		return chooseShares(runScripts(turn, battle.ai, battle.player, battle.flags, true), battle.ai.moves);
	}, 20000);
	return {shares: shares};
}

/* ---------------------------------------------------------------------------------------------
 * The page: sides from the calculator's results, and the percentages on Battle.
 */
function buildAISide(key, pokemon, results, foe, options) {
	var side = {
		key: key,
		isPlayer: key === "p1",
		name: pokemon.name,
		types: pokemon.types.slice(),
		ability: pokemon.ability || "",
		abilityOn: pokemon.abilityOn,
		item: pokemon.item || "",
		status: pokemon.status || "",
		level: pokemon.level,
		hp: pokemon.curHP(),
		maxHP: pokemon.maxHP(),
		boosts: $.extend({atk: 0, def: 0, spa: 0, spd: 0, spe: 0}, pokemon.boosts),
		stats: pokemon.stats,
		speed: options.speed,
		monsLeft: options.monsLeft,
		firstTurn: options.firstTurn,
		sideState: options.sideState,
		seeded: options.sideState.seeded,
		saltCured: !!options.saltCured,
		focusEnergy: !!options.focusEnergy,
		moves: []
	};
	for (var i = 0; i < 4; i++) {
		var result = results[i];
		var move = result && result.move;
		if (!move || move.name === "(No Move)" || !move.name) {
			side.moves.push(null);
			continue;
		}
		var data = getAIMoveData(move);
		var range = result.range();
		var crit = options.critChance ? options.critChance(move) : 0;
		var maxCrit = range[1];
		if (crit >= 0.5 && !move.isCrit && options.critDamage) maxCrit = options.critDamage(i);
		var effectiveness = 1;
		var row = typeof typeChart !== "undefined" && typeChart && typeChart[move.type];
		if (row && foe) {
			effectiveness = foe.types.reduce(function (product, type) {
				return product * (row[type] !== undefined ? row[type] : 1);
			}, 1);
		}
		if (data.split !== SPLIT_STATUS && range[1] === 0 && data.power > 0) effectiveness = 0;
		side.moves.push({
			index: i,
			name: move.originalName || move.name,
			type: move.type,
			bp: move.bp,
			hits: move.hits || 1,
			recoil: move.recoil,
			drain: move.drain,
			sound: !!(move.flags && move.flags.sound),
			bullet: !!(move.flags && move.flags.bullet),
			effect: data.effect,
			accuracy: data.accuracy,
			chance: data.chance,
			target: data.target,
			priority: data.priority,
			flags: data.flags,
			split: data.split,
			power: data.power,
			maxDamage: range[1],
			maxCritDamage: maxCrit,
			critChance: crit,
			effectiveness: effectiveness
		});
	}
	return side;
}

function getAIFlags() {
	if (typeof TRAINER_AI_FLAGS === "undefined" || typeof TRAINER_ORDER === "undefined") return AI_SMART_FLAGS;
	var trainer = TRAINER_ORDER[currentTrainerIndex];
	if (!trainer) return AI_SMART_FLAGS;
	var flags = (TRAINER_AI_FLAGS[getPageMode()] || {})[trainer.name + "|" + trainer.location + "|" + trainer.levelCap];
	if (flags === undefined) flags = trainer.optional ? AI_NEGATIVES : AI_SMART_FLAGS;
	return flags;
}

function countYourMonsLeft() {
	if (typeof resolveBoxLayout !== "function") return 6;
	var team = resolveBoxLayout(readCustomSets(), readBoxLayout()).team;
	if (!team.length) return 6;
	var record = typeof readRunRecord === "function" ? readRunRecord() : null;
	return Math.max(1, team.filter(function (setId) {
		return !(record && getRunMon(setId, record).fainted);
	}).length);
}

function countFoeMonsLeft() {
	if (typeof TRAINER_ORDER === "undefined" || !TRAINER_ORDER[currentTrainerIndex] || typeof getKOSlots !== "function") return 1;
	return Math.max(1, getTeamSize(currentTrainerIndex) - getKOSlots(currentTrainerIndex).length);
}

function readSideState(suffix) {
	return {
		sr: $("#sr" + suffix).prop("checked"),
		spikes: ~~$("input:radio[name='spikes" + suffix + "']:checked").val(),
		toxicSpikes: 0,
		stickyWeb: false,
		reflect: $("#reflect" + suffix).prop("checked"),
		lightScreen: $("#lightScreen" + suffix).prop("checked"),
		auroraVeil: $("#auroraVeil" + suffix).prop("checked"),
		tailwind: $("#tailwind" + suffix).prop("checked"),
		seeded: $("#leechSeed" + suffix).prop("checked")
	};
}

// The battle as the AI sees it, from the last calculation (damageResults).
function readAIBattle() {
	if (!damageResults || !damageResults[1][0]) return null;
	var p1 = damageResults[0][0].attacker;
	var p2 = damageResults[1][0].attacker;
	var field = damageResults[1][0].field;
	var focus = {p1: $("#focusEnergyL").prop("checked"), p2: $("#focusEnergyR").prop("checked")};
	var critChance = function (attacker, defender, sideKey) {
		return function (move) {
			return typeof getCritChance === "function" ? getCritChance(attacker, defender, move, focus[sideKey]) || 0 : 0;
		};
	};
	var critDamage = function (sideIndex) {
		return function (i) {
			var result = damageResults[sideIndex][i];
			try {
				var move = result.move.clone();
				move.isCrit = true;
				return calc.calculate(gen, result.attacker, result.defender, move, result.field).range()[1];
			} catch (e) {
				return result.range()[1];
			}
		};
	};
	var player = buildAISide("p1", p1, damageResults[0], p2, {
		speed: getBattleSpeed(p1, "p1"), monsLeft: countYourMonsLeft(), firstTurn: p1.curHP() === p1.maxHP(),
		sideState: readSideState("L"), focusEnergy: focus.p1, critChance: critChance(p1, p2, "p1"), critDamage: critDamage(0)
	});
	var ai = buildAISide("p2", p2, damageResults[1], p1, {
		speed: getBattleSpeed(p2, "p2"), monsLeft: countFoeMonsLeft(), firstTurn: p2.curHP() === p2.maxHP(),
		sideState: readSideState("R"), focusEnergy: focus.p2, critChance: critChance(p2, p1, "p2"), critDamage: critDamage(1)
	});
	return {ai: ai, player: player, field: field, trickRoom: $("#trickroom").prop("checked"), flags: getAIFlags()};
}

function formatAIShare(share) {
	if (share <= 0) return "0%";
	if (share >= 0.995) return "100%";
	if (share < 0.01) return "<1%";
	return Math.round(share * 100) + "%";
}

// Battle: each of the foe's moves gets the chance the AI uses it; the likeliest is marked, and
// tagged KO when it can knock you out from the HP you have now.
function markFoeLikelyMoves() {
	var labels = $('label[for^="resultMoveR"]');
	labels.removeClass("ss-threat ss-threat-ko ss-ai-likely").removeAttr("data-ai").removeAttr("title");
	var battle = null;
	try {
		battle = readAIBattle();
	} catch (e) {
		battle = null;
	}
	if (!battle) return;
	var shares = predictAIMoves(battle).shares;
	var best = Math.max.apply(null, shares);
	var hp = battle.player.hp;
	shares.forEach(function (share, i) {
		var label = labels.eq(i);
		var move = battle.ai.moves[i];
		if (!move || i >= labels.length) return;
		label.attr("data-ai", formatAIShare(share));
		var ko = move.maxDamage >= hp && hp > 0 && share > 0;
		var title = "The trainer's AI uses this " + formatAIShare(share) + " of the time" + (ko ? "; it can KO you" : "");
		label.attr("title", title);
		if (share > 0 && share === best) label.addClass("ss-ai-likely ss-threat").toggleClass("ss-threat-ko", ko);
	});
}
