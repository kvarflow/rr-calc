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
 * sweeper's status bonus, recovery at full HP, Taunt, the speed order against priority). The damage bonuses (KO first +9, slower KO,
 * desperate +9, strongest +2), the slower-KO table and the 0.93 damage roll match.
 *
 * Before its move the AI may switch out (ai_switching.c): the trainer's other Pokémon still
 * standing are scored against yours, and the chance of each switch is shown with the moves.
 * Radical Red's version (decompiled too) skips the switching checks on a random quarter of turns,
 * absorbs Ground moves with Earth Eater, keeps Phoenix Down in, and never uses trainer items.
 *
 * What the calculator cannot know is assumed: no moves used yet this battle (so no Protect or
 * Destiny Bond last turn, no Choice lock), the foe's Pokémon has just come in when it is at full
 * HP (Fake Out, and it waits a turn before switching again unless it led), its benched Pokémon are
 * at full HP with no status, and neither side holds a Substitute.
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
var MOVE_TARGET_BOTH = 0x8;
var MOVE_TARGET_USER = 0x10;
var MOVE_TARGET_FOES_AND_ALLY = 0x20;
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
// Radical Red's DoubleDamageWithStatusMoveInMovesetThatAffects table.
var DOUBLE_DAMAGE_MOVES = ["Bitter Malice", "Infernal Parade", "Hex", "Venoshock"];
// The moves Sheer Force boosts (Radical Red's table), which then have no secondary effect.
var SHEER_FORCE_MOVES = ["Acid", "Acid Spray", "Air Slash", "Anchor Shot", "Ancient Power", "Apple Acid", "Astonish",
	"Aurora Beam", "Bite", "Blaze Kick", "Blizzard", "Blue Flare", "Body Slam", "Bolt Strike", "Bone Club", "Bounce", "Bubble",
	"Bubble Beam", "Bug Buzz", "Bulldoze", "Burning Jealousy", "Charge Beam", "Chatter", "Confusion", "Constrict",
	"Cross Poison", "Crunch", "Crush Claw", "Dark Pulse", "Diamond Storm", "Discharge", "Dizzy Punch", "Double Iron Bash",
	"Dragon Breath", "Dragon Rush", "Drum Beating", "Dynamic Punch", "Earth Power", "Electroweb", "Ember", "Energy Ball",
	"Extrasensory", "Fake Out", "Fiery Dance", "Fire Blast", "Fire Fang", "Fire Lash", "Fire Punch", "Flame Charge",
	"Flame Wheel", "Flamethrower", "Flare Blitz", "Flash Cannon", "Focus Blast", "Force Palm", "Freeze Shock", "Freeze-Dry",
	"Frost Breath", "Glaciate", "Grav Apple", "Gunk Shot", "Headbutt", "Head Charge", "Heart Stamp", "Heat Wave", "Hurricane",
	"Hyper Fang", "Ice Beam", "Ice Burn", "Ice Fang", "Ice Punch", "Icicle Crash", "Icy Wind", "Inferno", "Iron Head",
	"Iron Tail", "Lava Plume", "Leaf Tornado", "Lick", "Liquidation", "Low Sweep", "Lunge", "Luster Purge", "Metal Claw",
	"Meteor Mash", "Mirror Shot", "Mist Ball", "Moonblast", "Mud Bomb", "Mud Shot", "Muddy Water", "Mud-Slap",
	"Mystical Fire", "Needle Arm", "Night Daze", "Nuzzle", "Octazooka", "Ominous Wind", "Play Rough", "Poison Fang",
	"Poison Jab", "Poison Sting", "Poison Tail", "Powder Snow", "Power-Up Punch", "Psybeam", "Psychic", "Pyro Ball",
	"Razor Shell", "Relic Song", "Rock Climb", "Rock Slide", "Rock Smash", "Rock Tomb", "Rolling Kick", "Sacred Fire",
	"Scald", "Scale Shot", "Scorching Sands", "Searing Shot", "Secret Power", "Seed Flare", "Shadow Ball", "Shadow Bone",
	"Signal Beam", "Silver Wind", "Skitter Smack", "Sky Attack", "Sludge", "Sludge Bomb", "Sludge Wave", "Smog", "Snarl",
	"Snore", "Spark", "Sparkling Aria", "Spirit Break", "Spirit Shackle", "Steam Eruption", "Steamroller", "Steel Wing",
	"Stomp", "Strange Steam", "Struggle Bug", "Throat Chop", "Thunder", "Thunder Fang", "Thunder Punch", "Thunder Shock",
	"Thunderbolt", "Tri Attack", "Trop Kick", "Twineedle", "Twister", "Volt Tackle", "Water Pulse", "Waterfall",
	"Zap Cannon", "Zen Headbutt", "Zing Zap", "Fiery Wrath", "Freezing Glare", "Thunderous Kick", "Ceaseless Edge",
	"Triple Arrows", "Barb Barrage", "Hydro Cannon", "Frenzy Plant", "Blast Burn", "Bitter Malice", "Esper Wing",
	"Breaking Swipe", "Flash", "Springtide Storm", "Sandsear Storm", "Wildbolt Storm", "Bleakwind Storm", "Alluring Voice",
	"Psychic Noise", "Malignant Chain", "Matcha Gotcha"];
// Moves that thaw the user (Radical Red's table), worth +10 to a frozen AI.
var UNFREEZE_MOVES = ["Flame Wheel", "Sacred Fire", "Flare Blitz", "Scald", "Scorching Sands", "Fusion Flare", "Steam Eruption",
	"Burn Up", "Pyro Ball", "Matcha Gotcha"];
// Radical Red's IsClearBodyAbility tests Clear Body alone; White Smoke and Full Metal Body are taken to
// share its battle id (they do the same thing).
var CLEAR_BODY_ABILITIES = ["Clear Body", "White Smoke", "Full Metal Body"];
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
	Fire: ["Flash Fire", "Well-Baked Body"], Grass: ["Sap Sipper"], Ground: ["Earth Eater"]};
// Radical Red's stat-lowering table for Contrary, Clear Body, Defiant and Competitive (no Tickle).
var RR_STAT_LOWER_EFFECTS = [E.ATTACK_DOWN, E.DEFENSE_DOWN, E.SPEED_DOWN, E.SPECIAL_ATTACK_DOWN, E.SPECIAL_DEFENSE_DOWN,
	E.ACCURACY_DOWN, E.EVASION_DOWN, E.ATTACK_DOWN_2, E.DEFENSE_DOWN_2, E.SPEED_DOWN_2, E.SPECIAL_ATTACK_DOWN_2,
	E.SPECIAL_DEFENSE_DOWN_2, E.ACCURACY_DOWN_2, E.EVASION_DOWN_2];
var WIND_MOVES = ["Air Cutter", "Bleakwind Storm", "Blizzard", "Fairy Wind", "Gust", "Heat Wave", "Hurricane", "Icy Wind",
	"Petal Blizzard", "Sandstorm", "Sandsear Storm", "Springtide Storm", "Twister", "Whirlwind", "Wildbolt Storm", "Sonic Slash"];
// Moves that ignore the target's ability, like Mold Breaker.
var ABILITY_IGNORING_MOVES = ["Moongeist Beam", "Shell Side Arm", "Photon Geyser", "Sunsteel Strike"];
var RECOIL_QUARTER = ["Take Down", "Submission", "Wild Charge", "Head Charge", "Volt Tackle"];
var RECOIL_THIRD = ["Double-Edge", "Flare Blitz", "Brave Bird", "Wood Hammer", "Draco Barrage", "Wave Crash"];
var RECOIL_HALF = ["Head Smash", "Light of Ruin", "Chloroblast"];
// Radical Red's IsMoxieAbility (no Chilling Neigh or As One).
var MOXIE_ABILITIES = ["Moxie", "Battle Bond", "Beast Boost", "Soul-Heart", "Grim Neigh"];
var STORM_MOVES = ["Springtide Storm", "Bleakwind Storm", "Wildbolt Storm", "Sandsear Storm"];
// Radical Red's AI damage counts multi-hit moves from these tables (after the 0.93), not the hits the
// calculator rolls: 2-5 hits as 2 (5 with Skill Link), two-hit moves as 2, Triple Kick and Triple Axel
// as 6 of the first hit, anything else (Population Bomb) as 1.
var TWO_TO_FIVE_HIT_MOVES = ["Arm Thrust", "Barrage", "Bone Rush", "Bullet Seed", "Comet Punch", "Double Slap", "Fury Attack",
	"Fury Swipes", "Icicle Spear", "Pin Missile", "Rock Blast", "Scale Shot", "Spike Cannon", "Tail Slap", "Water Shuriken",
	"Surging Strikes", "Beat Up", "Triple Dive"];
var TWO_HIT_MOVES = ["Bonemerang", "Double Hit", "Double Iron Bash", "Double Kick", "Dragon Darts", "Dual Chop", "Dual Wingbeat",
	"Gear Grind", "Twineedle", "Twin Beam", "Tachyon Cutter"];
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
	var total = [];
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
		for (var i = 0; i < shares.length; i++) total[i] = (total[i] || 0) + weight * shares[i];
		path.length = depth;
		while (path.length && path[path.length - 1] + 1 >= sizes[path.length - 1]) path.pop();
		if (!path.length || ++runs >= limit) break;
		path[path.length - 1]++;
	}
	var sum = 0;
	for (var j = 0; j < total.length; j++) sum += total[j] || 0;
	var out = [];
	for (var k = 0; k < total.length; k++) out.push(sum ? (total[k] || 0) / sum : 0);
	return out;
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

// A physical move that uses its own Attack: Radical Red leaves out Counter, Metal Burst, Comeuppance, Fake
// Out, Foul Play and Body Press.
function hasRealPhysical(side) {
	return hasMoveWhere(side, function (m) {
		return m.split === SPLIT_PHYSICAL && m.power > 0 && m.effect !== E.COUNTER && m.effect !== E.FAKE_OUT &&
			!has(["Foul Play", "Body Press", "Metal Burst", "Comeuppance"], m.name);
	});
}

// Any physical attack but Counter (Radical Red's test in the Attack-lowering cases).
function hasPhysicalAttack(side) {
	return hasMoveWhere(side, function (m) {
		return m.split === SPLIT_PHYSICAL && m.power > 0 && m.effect !== E.COUNTER;
	});
}

// A special attack (Radical Red leaves out Mirror Coat).
function hasSpecial(side) {
	return hasMoveWhere(side, function (m) {
		return m.split === SPLIT_SPECIAL && m.power > 0 && m.effect !== E.MIRROR_COAT;
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
	if (side.ability === "Blazing Soul" && move.type === "Fire" && side.hp === side.maxHP) priority++;
	// Radical Red doesn't check that the user is grounded.
	if (move.name === "Grassy Glide" && field.terrain === "Grassy") priority++;
	return priority;
}

// The speed bracket: Quick Draw (30% with an attack) and Quick Claw (20%) are rolled afresh each time
// the game asks, here once per side and thinking phase.
function bracketOf(side, foe, move, turn) {
	if (side.ability === "Quick Draw" && move && move.split !== SPLIT_STATUS && turn && turn.coin("quickDraw" + turn.phase + side.key, 0.3)) return 1;
	if (side.item === "Custap Berry" && !has(["Unnerve", "As One"], foe.ability) &&
		side.hp <= side.maxHP / (side.ability === "Gluttony" ? 2 : 4)) return 1;
	if (side.item === "Lagging Tail" || side.item === "Full Incense") return -2;
	if (side.item === "Quick Claw" && turn && turn.coin("quickClaw" + turn.phase + side.key, 0.2)) return 1;
	return 0;
}

// MoveWouldHitBeforeOtherMove: speed ties go against the attacker. Radical Red's version has no
// "the other move has higher priority, so this one goes second": it goes on to compare brackets
// and speed (CFRU master returns false there).
function hitsBefore(atk, move, def, defMove, battle, turn) {
	var field = battle.field;
	if (!defMove) {
		if (priorityOf(atk, move, field) > 0) return true;
	} else if (priorityOf(atk, move, field) > priorityOf(def, defMove, field)) {
		return true;
	}
	if (bracketOf(atk, def, move, turn) > bracketOf(def, atk, defMove, turn)) return true;
	var sa = atk.speed;
	var sd = def.speed;
	if (battle.trickRoom) {
		sa = def.speed;
		sd = atk.speed;
	}
	return sa > sd;
}

function hitsFirst(turn, atk, move, def) {
	return hitsBefore(atk, move, def, turn.predicted(def), turn.battle, turn);
}

function moveWillHit(atk, def, move, field) {
	if (atk.ability === "No Guard" || def.ability === "No Guard") return true;
	if (move.accuracy === 0) return true;
	if ((move.effect === E.THUNDER || has(STORM_MOVES, move.name)) && /Rain/.test(field.weather || "")) return true;
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
	if (atk.ability === "Illuminate") acc = acc * 12 / 10;
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
		// Radical Red fills its damage numbers before it predicts moves, so on a first turn Sucker Punch
		// (which needs a prediction) counts 0, and so do your Counter, Mirror Coat and Metal Burst.
		if (move.effect === E.SUCKER_PUNCH) return 0;
		if (atk.isPlayer && (move.effect === E.COUNTER || move.effect === E.MIRROR_COAT)) return 0;
		if (move.effect === E.OHKO) return isOHKOUsable(atk, def, move, field) ? (!atk.isPlayer || moveWillHit(atk, def, move, field) ? def.hp : 1) : 0;
		if (move.name === "Final Gambit") return Math.min(atk.hp, def.hp);
		if (move.effect === E.PSYWAVE) return Math.min(atk.level, def.hp);
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
			var hits = aiHitCount(atk, move);
			var oneHit = Math.floor((crit ? move.maxCritDamage : move.maxDamage) / calcHitCount(move));
			damage = Math.floor(oneHit * 93 / 100) * hits;
			if (hits <= 1 && move.hits <= 1 && def.hp === def.maxHP && (def.item === "Focus Sash" ||
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
	if (basis && basis.split !== SPLIT_STATUS) {
		var hit = moveDamage(turn, def, atk, strongest);
		if (move.name === "Metal Burst") damage = Math.floor(hit * 3 / 2);
		else if (basis.split === split) damage = hit * 2;
		if (atk.ability === "Parental Bond") damage *= 2;
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

// How many single hits Radical Red's AI damage counts a move as (see TWO_TO_FIVE_HIT_MOVES), and how many
// the calculator's number covers.
function aiHitCount(atk, move) {
	if (has(TWO_TO_FIVE_HIT_MOVES, move.name)) return atk.ability === "Skill Link" ? 5 : 2;
	if (has(TWO_HIT_MOVES, move.name)) return 2;
	if (move.effect === E.TRIPLE_KICK) return 6;
	return 1;
}

function calcHitCount(move) {
	return move.effect === E.TRIPLE_KICK ? 6 : Math.max(1, move.hits || 1);
}

// The player's side is the human: PickMoveHumanLikelyToChoose's order of preference.
function shouldUseHumanLikelyMove(atk, def, field) {
	return atk.isPlayer || def.monsLeft <= 1 || (!!field && isTrappedBy(def, atk, field));
}

function humanLikelyPreference(atk, def, a, b) {
	var tests = [
		function (m) {
			return m.chance * (atk.ability === "Serene Grace" ? 2 : 1) >= 50 && (m.drain || has([E.ABSORB, E.DREAM_EATER, E.SPEED_UP_1_HIT,
				E.SPECIAL_ATTACK_UP_HIT, E.DEFENSE_UP_2_HIT, E.DEFENSE_UP_HIT, E.ATTACK_UP_HIT, E.HIGHER_OFFENSES_DEFENSES_UP_HIT], m.effect));
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
	// Compared as unsigned bytes, as the game does: a negative priority (Revenge, Avalanche) wins.
	var pa = priorityOf(atk, a, field) & 0xFF;
	var pb = priorityOf(atk, b, field) & 0xFF;
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
			return m.effect !== E.MULTI_HIT;
		}) : 0);
	}
	if (!verdict && atk.ability !== "Magic Guard") verdict = prefer(function (m) {
		return !isRecoilMove(m);
	});
	if (!verdict && atk.ability !== "Contrary") verdict = prefer(function (m) {
		return !has(STAT_DROP_SELF_EFFECTS, m.effect);
	});
	if (!verdict && shouldUseHumanLikelyMove(atk, def, field)) verdict = humanLikelyPreference(atk, def, a, b);
	if (verdict) return verdict > 0;
	return turn.coin(key, 0.5);
}

// Pursuit counts as hitting a switch when the target can switch (not trapped, another Pokémon left) and
// has switched before; you haven't yet as far as the calculator knows, so only against the AI.
function isEffectivePursuit(atk, def, move, field) {
	return move.effect === E.PURSUIT && def.monsLeft > 1 && !(field && isTrappedBy(def, atk, field)) && !def.isPlayer;
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
			} else if (damage === best && i !== strongest && move.effect !== E.COUNTER && move.effect !== E.MIRROR_COAT &&
				move.effect !== E.FUTURE_SIGHT && !isEffectivePursuit(atk, def, atk.moves[strongest], field)) {
				if (isEffectivePursuit(atk, def, move, field) ||
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

// PriorityMoveInMoveset as Radical Red has it: the highest priority the side's moves get.
function priorityMoveInMoveset(side, field) {
	var best = 0;
	side.moves.forEach(function (move, i) {
		if (!move || !isUsable(side, i, field)) return;
		var p = 0;
		if (move.name === "Extreme Speed") p = 2;
		else if (side.ability === "Triage" && move.effect === E.ABSORB) p = 3;
		else if (move.priority === 1 || (side.hp === side.maxHP && ((side.ability === "Blazing Soul" && move.type === "Fire") ||
			(side.ability === "Gale Wings" && move.type === "Flying")))) p = 1;
		best = Math.max(best, p);
	});
	return best;
}

// MoveKnocksOutPossiblyGoesFirstWithBestAccuracy in Radical Red's (older) form: the KO moves with the
// best accuracy, ties kept when this one's priority is no higher, or when a plain priority-0 move would
// already beat you and your priority beats it; no Pursuit, contact or multi-hit rules.
var PLAIN_MOVE = {name: "Tackle", type: "Normal", priority: 0, split: SPLIT_PHYSICAL, flags: 0, effect: 0, power: 40};
function knocksOutWithBestAccuracy(turn, atk, def, check, checkFirst) {
	var field = turn.battle.field;
	var best = [];
	var bestAcc = 0;
	var last = -1;
	for (var j = 0; j < 4; j++) {
		var move = atk.moves[j];
		if (!move) break;
		if (!isUsable(atk, j, field)) continue;
		var acc = aiAccuracy(atk, def, move, field);
		if (acc === 0xFFFF) acc = 100;
		if (checkFirst && !hitsFirst(turn, atk, move, def)) continue;
		if (!knocksOut(turn, atk, def, j, 1)) continue;
		if ((moveWillHit(atk, def, move, field) && bestAcc <= 99) || acc > bestAcc) {
			best = [j];
			bestAcc = acc;
			last = j;
		} else if (acc === bestAcc) {
			var mine = priorityOf(atk, move, field);
			if (mine <= priorityOf(atk, atk.moves[last], field) ||
				(hitsBefore(atk, PLAIN_MOVE, def, turn.predicted(def), turn.battle, turn) && mine < priorityMoveInMoveset(def, field))) {
				best.push(j);
			} else {
				best = [j];
			}
			last = j;
		}
	}
	return best.indexOf(check) !== -1;
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

// The status a move gives (par, brn, psn, slp) can land on def.
function canBeStatusedWith(atk, def, kind, field) {
	if (kind === "par") return canBeParalyzed(atk, def, field);
	if (kind === "brn") return canBeBurned(atk, def, field);
	if (kind === "psn") return canBePoisoned(atk, def, field);
	return canBeSlept(atk, def, field);
}

// GoodIdeaTo<Status>Self: the side would like the status (what a Synchronize foe passes back).
function goodIdeaToStatusSelf(side, kind, field) {
	if (!canBeStatusedWith(side, side, kind, field)) return false;
	var ability = side.ability;
	if (ability === "Quick Feet" || (ability === "Guts" && hasRealPhysical(side)) || hasMoveNamed(side, ["Facade", "Psycho Shift"])) return true;
	if (kind === "par") return ability === "Marvel Scale";
	if (kind === "brn") return has(["Heatproof", "Magic Guard"], ability) || (ability === "Flare Boost" && hasSpecial(side));
	return has(["Marvel Scale", "Poison Heal", "Magic Guard"], ability) || (ability === "Toxic Boost" && hasRealPhysical(side));
}

var CURE_BERRIES = {par: "Cheri Berry", brn: "Rawst Berry", psn: "Pecha Berry"};

// Status a foe would rather have, or shrug off (BadIdeaToParalyze/Burn/Poison/PutToSleep). Radical Red:
// the curing berries count in every battle (CFRU master: the Battle Frontier only), Magic Guard always
// counts against burn and poison, and paralysis has no Rest rule.
function badIdeaToStatus(atk, def, kind, field) {
	var ability = defAbility(atk, def);
	var rain = ability === "Hydration" && /Rain/.test(field.weather || "") && def.item !== "Utility Umbrella";
	if (kind === "slp") {
		return has(["Early Bird", "Shed Skin"], ability) || rain || (ability === "Synchronize" && canBeSlept(def, atk, field));
	}
	if (def.item === CURE_BERRIES[kind] || def.item === "Lum Berry") return true;
	if (has(["Shed Skin", "Quick Feet"], ability) || rain) return true;
	if (ability === "Synchronize" && canBeStatusedWith(def, atk, kind, field) && !goodIdeaToStatusSelf(atk, kind, field)) return true;
	if (ability === "Marvel Scale" && hasPhysical(atk)) return true;
	if (ability === "Natural Cure" && def.monsLeft > 1 && !isTrappedBy(def, atk, field)) return true;
	if (ability === "Guts" && hasPhysical(def)) return true;
	if (hasMoveNamed(def, ["Facade", "Psycho Shift"])) return true;
	if (kind === "brn") return ability === "Magic Guard" || (ability === "Flare Boost" && hasSpecial(def));
	if (kind === "psn") {
		if (has(["Poison Heal", "Magic Guard"], ability) || (ability === "Toxic Boost" && hasPhysical(def))) return true;
		return atk.ability === "Poison Touch" && hasMoveWhere(atk, function (m) {
			return isDamaging(m) && (m.flags & FLAG_CONTACT) && m.effectiveness > 0;
		});
	}
	return false;
}

// DoubleDamageWithStatusMoveInMovesetThatAffects: Hex and the like, which hit a statused foe twice as hard.
function hasDoubleDamageMove(atk) {
	return hasMoveWhere(atk, function (m) {
		return has(DOUBLE_DAMAGE_MOVES, m.name) && m.effectiveness > 0;
	});
}

// CalcSecondaryEffectChance: none for the moves Sheer Force boosts, doubled by Serene Grace.
function chanceOf(atk, move) {
	if (atk.ability === "Sheer Force" && has(SHEER_FORCE_MOVES, move.name)) return 0;
	return move.chance * (atk.ability === "Serene Grace" ? 2 : 1);
}

// CanStatBeLowered (Negatives): not at -6 (+6 with Contrary), and Radical Red tests only Clear Body,
// and Hyper Cutter for Attack.
function canStatBeLowered(atk, def, stat) {
	var ability = defAbility(atk, def);
	if (has(CLEAR_BODY_ABILITIES, ability) || (stat === "atk" && ability === "Hyper Cutter")) return false;
	return ability === "Contrary" ? stage(def, stat) < 12 : stage(def, stat) > 0;
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

// BadIdeaToRaise<Stat>: a predicted phazing move (Roar, Haze, Clear Smog), a predicted sleep move from a
// slower foe that will land, an Unaware foe not about to faint; Attack into King's Shield and Defence
// into Obstruct when the AI's strongest move makes contact; Speed under Trick Room. (Having used a
// phazing move this battle is history the calculator doesn't have.)
function badIdeaToRaiseStat(turn, atk, def, stat) {
	var predicted = turn.predicted(def);
	var field = turn.battle.field;
	if (predicted && has([E.ROAR, E.HAZE, E.REMOVE_TARGET_STAT_CHANGES], predicted.effect)) return true;
	if (predicted && (predicted.effect === E.SLEEP || predicted.effect === E.YAWN) &&
		(moveWillHit(def, atk, predicted, field) || accuracyOf(def, atk, predicted, field) >= 80) && def.speed < atk.speed) return true;
	if (def.ability === "Unaware" && !willFaintFromChip(def, field)) return true;
	if (stat === "atk" || stat === "def") {
		var best = atk.moves[strongestMove(turn, atk, def)];
		if (hasMoveNamed(def, [stat === "atk" ? "King's Shield" : "Obstruct"]) && best && (best.flags & FLAG_CONTACT)) return true;
	}
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

// GoodIdeaToLower<Stat>. Radical Red tests only Clear Body, and Hyper Cutter for Attack; Defiant and
// Competitive rule out all but Speed and accuracy, Contrary all.
function goodIdeaToLower(turn, def, atk, move, stat) {
	var field = turn.battle.field;
	var ability = defAbility(atk, def);
	if (has(CLEAR_BODY_ABILITIES, ability) || (stat === "atk" && ability === "Hyper Cutter") || ability === "Contrary") return false;
	if (stat !== "spe" && stat !== "acc" && has(["Defiant", "Competitive"], ability)) return false;
	if (stat === "eva") {
		if (stage(def, "eva") > 6) return true;
		if (!hasMoveWhere(atk, function (m) {
			return isDamaging(m) && accuracyOf(atk, def, m, field) < 90;
		})) return false;
		return atk.speed >= def.speed ? !canKnockOut(turn, def, atk) : !can2HKO(turn, def, atk);
	}
	if (!hitsFirst(turn, atk, move, def) && canKnockOut(turn, atk, def)) return false;
	switch (stat) {
	case "atk":
		return !willFaintFromChip(def, field) && stage(def, "atk") > 4 && hasRealPhysical(def);
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

// ShouldTryToSetUpStat as Radical Red has it: no stat limit from the caller but +2 going first and
// +3 going second, never while badly poisoned at 75% HP or less, and on half the rolls not into a
// foe that can undo it (Haze, Roar and the like) or has priority and 2HKOs. (CFRU master: the
// caller's limit, a Defence/Sp. Def exception, and no set-up into Focus Sash or Sturdy.)
function shouldTrySetUp(turn, atk, def, move, stat) {
	var field = turn.battle.field;
	if (def.ability === "Unaware" && !hasMoveNamed(atk, ["Stored Power", "Power Trip"]) &&
		!(stat === "def" && hasMoveNamed(atk, ["Body Press"]))) return false;
	if (willFaintFromChip(atk, field)) return false;
	if (atk.status === "tox" && !has(["Poison Heal", "Magic Guard", "Toxic Boost"], atk.ability) && healthPercent(atk) <= 75) return false;
	var undoes = hasEffect(def, [E.HAZE, E.PSYCH_UP]) || hasMoveNamed(def, ["Topsy-Turvy"]) ||
		((hasMoveNamed(def, ["Roar", "Whirlwind"]) || (hasMoveNamed(def, ["Dragon Tail"]) && atk.types.indexOf("Fairy") === -1) ||
		(hasMoveNamed(def, ["Circle Throw"]) && atk.types.indexOf("Ghost") === -1)) && atk.monsLeft > 1) ||
		(hasMoveWhere(def, function (m) {
			return priorityOf(def, m, field) > 0;
		}) && can2HKO(turn, def, atk));
	if (undoes && turn.coin("setUp" + turn.phase + atk.key + atk.moves.indexOf(move) + stat, 0.5)) return false;
	var predicted = turn.predicted(def);
	if (hitsFirst(turn, atk, move, def)) {
		if (canKnockOutWithChip(turn, def, atk)) return false;
		return stage(atk, stat) <= 8;
	}
	if (predicted && predicted.effect === E.SEMI_INVULNERABLE) return true;
	if (stat === "spe" && stage(atk, "spe") <= 8 && !(predicted && knocksOut(turn, def, atk, def.moves.indexOf(predicted), 1))) {
		var boost = has([E.SPEED_UP_2, E.DRAGON_DANCE], move.effect) && move.name !== "Dragon Dance" ? 2 : 1;
		if (atk.ability === "Simple") boost *= 2;
		if (Math.floor(atk.speed * (2 + boost) / 2) >= def.speed) return true;
	}
	if (can2HKO(turn, def, atk)) return false;
	return stage(atk, stat) <= 9;
}

// IncreaseStatViability: what setting `stat` up is worth to this style. (`limit` was CFRU master's
// stage cap, which Radical Red's ShouldTryToSetUpStat replaces with its own.)
function statBonus(turn, atk, def, move, stat, limit, boost) {
	switch (styleOf(turn, atk)) {
	case STYLE.KILL:
		if (shouldTrySetUp(turn, atk, def, move, stat)) return 3 + boost;
		return isDamaging(move) && (stat === "atk" || stat === "spa") ? 1 : 0;
	case STYLE.SETUP_STATS:
		return shouldTrySetUp(turn, atk, def, move, stat) ? 3 + boost : 0;
	case STYLE.PHAZING:
		if (hasEffect(atk, [E.HAZE])) return 0;
		return shouldTrySetUp(turn, atk, def, move, stat) ? statusBonus(turn, atk, def, 1) : 0;
	case STYLE.BATON_PASS:
		// Radical Red: a Baton Passer sets up to +4 (evasion +6) without ShouldTryToSetUpStat.
		if (stat === "eva") return stage(atk, "eva") < 12 ? 6 : 0;
		if (stat === "def" || stat === "spd") return stage(atk, stat) < 10 ? 4 : 0;
		return stage(atk, stat) < 10 ? 5 : 0;
	default:
		return shouldTrySetUp(turn, atk, def, move, stat) ? statusBonus(turn, atk, def, 1) : 0;
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
		if (field.isGravity && has(GRAVITY_BANNED, move.name)) return 0;
		if (has(POWDER_MOVES, move.name) && (def.types.indexOf("Grass") !== -1 || def.ability === "Overcoat" ||
			def.item === "Safety Goggles")) down(10);
		// Radical Red: Ground moves (status ones too) do nothing to a Pokémon in the air, except Thousand
		// Arrows, Bonemerang, Bone Zone and Mold Breaker (Levitate is left to the type check below).
		if (move.type === "Ground" && !isGrounded(def, field) && move.name !== "Thousand Arrows" && move.name !== "Bonemerang" &&
			atk.ability !== "Bone Zone" && !ignoresAbilities(atk) && def.ability !== "Levitate") return 0;
		if (ability && !has(ABILITY_IGNORING_MOVES, move.name)) {
			var stops = function (amount) {
				down(amount);
				return score;
			};
			// Hardcore Erika's rematch: her Grass moves ignore immunities, Sap Sipper included.
			var grassIgnores = move.type === "Grass" && typeof currentBattleEffect === "string" && /grass type moves.*ignore immunities/i.test(currentBattleEffect);
			if (ABSORBING[move.type] && has(ABSORBING[move.type], ability) && !grassIgnores) return stops(20);
			if (ability === "Mountaineer" && move.type === "Rock" && move.split !== SPLIT_STATUS) return stops(20);
			if (ability === "Wind Rider" && has(WIND_MOVES, move.name)) return stops(10);
			if (ability === "Good as Gold" && move.split === SPLIT_STATUS && (move.target & ~MOVE_TARGET_BOTH) === 0) return stops(20);
			if (ability === "Purifying Salt" && has(SET_STATUS_EFFECTS, effect)) return stops(10);
			if (ability === "Aroma Veil" && has(["Disable", "Attract", "Encore", "Torment", "Taunt", "Heal Block"], move.name)) return stops(20);
			if ((ability === "Soundproof" && move.sound) || (ability === "Bulletproof" && move.bullet)) return stops(10);
			if (has(["Dazzling", "Queenly Majesty", "Armor Tail"], ability) && priorityOf(atk, move, field) > 0) return stops(10);
			if (ability === "Magic Bounce" && (move.flags & FLAG_MAGIC_COAT)) return stops(20);
			var lowers = has(RR_STAT_LOWER_EFFECTS, effect);
			if (ability === "Contrary" && lowers) return stops(20);
			if (has(["Clear Body", "Full Metal Body", "White Smoke"], ability) && (lowers || move.name === "Parting Shot")) return stops(10);
			if (ability === "Hyper Cutter" && (effect === E.ATTACK_DOWN || effect === E.ATTACK_DOWN_2)) return stops(10);
			if (ability === "Defiant" && move.split === SPLIT_STATUS && lowers && canStatBeRaised(def, "atk") && hasRealPhysical(def)) return stops(8);
			if (ability === "Competitive" && move.split === SPLIT_STATUS && lowers && canStatBeRaised(def, "spa") && hasSpecial(def)) return stops(8);
			if (ability === "Justified" && move.type === "Dark" && move.split !== SPLIT_STATUS && canStatBeRaised(def, "atk") &&
				!knocksOut(turn, atk, def, i, 2) && hasRealPhysical(def)) down(4);
			if (ability === "Steam Engine" && (move.type === "Fire" || move.type === "Water") && move.split !== SPLIT_STATUS &&
				canStatBeRaised(def, "spe") && !knocksOut(turn, atk, def, i, 1) && atk.speed > def.speed) down(knocksOut(turn, atk, def, i, 2) ? 5 : 9);
			if (has(SET_STATUS_EFFECTS, effect) && (ability === "Comatose" || (ability === "Shields Down" && /^Minior/.test(def.name) &&
				!/Core/.test(def.name)) || (ability === "Leaf Guard" && /Sun/.test(field.weather || "") && def.item !== "Utility Umbrella"))) return stops(10);
			if ((effect === E.SLEEP || effect === E.YAWN) && ability === "Sweet Veil") return stops(10);
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
			// Radical Red's table has the damaging confusion moves (Psybeam), not Confuse Ray.
			if (field.terrain === "Misty" && (has(SET_STATUS_EFFECTS, effect) || effect === E.CONFUSE_HIT || effect === E.SWAGGER ||
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
	if (move.split !== SPLIT_STATUS && ((field.weather === "Harsh Sunshine" && move.type === "Water" && move.name !== "Hydro Steam") ||
		(field.weather === "Heavy Rain" && move.type === "Fire"))) {
		down(20);
		return score;
	}

	var standardDamage = function () {
		if (damaging && move.effectiveness === 0) down(15);
		return score;
	};
	var statusChecks = function (canApply) {
		if (!canApply) down(10);
		return score;
	};
	var selfBoost = function (stats, noLockCheck) {
		var locked = !noLockCheck && goodAI && canBeChoiceLocked(atk);
		if (locked || atk.ability === "Contrary") return down(10);
		if (!stats.some(function (stat) {
			return canStatBeRaised(atk, stat) && (stat !== "atk" || hasRealPhysical(atk)) && (stat !== "spa" || hasSpecial(atk));
		})) down(10);
		return score;
	};

	// Moves that fail now: nothing has been used yet this battle (Spit Up, Belch, Mimic going first...), the
	// AI's bench is assumed healthy (Healing Wish), or this foe or field rules them out.
	var failsNow = function () {
		var first = hitsFirst(turn, atk, move, def);
		switch (move.name) {
		case "Splash": case "Conversion 2": case "Sketch": case "Belch": case "Recycle": case "Spit Up": case "Swallow":
		case "Stuff Cheeks": case "Healing Wish": case "Lunar Dance": case "Celebrate": case "Hold Hands": case "Happy Hour":
			return true;
		case "Mimic": case "Spite":
			return first || !predicted;
		case "Disable":
			return def.item === "Mental Herb" || first || !predicted;
		case "Last Resort":
			return atk.moves.filter(Boolean).length > 1;
		case "Purify":
			return !def.status;
		case "Heal Pulse": case "Floral Healing":
			return true;
		case "Heal Bell": case "Aromatherapy": case "Sparkly Swirl":
			return !atk.status || (move.name === "Heal Bell" && atk.ability === "Soundproof");
		case "Refresh":
			return !/^(psn|tox|brn|par)$/.test(atk.status);
		case "Psycho Shift":
			return !/^(psn|tox|brn|par)$/.test(atk.status) || !!def.status;
		case "Magic Coat":
			return !hasMoveWhere(def, function (m) {
				return (m.flags & FLAG_MAGIC_COAT) !== 0;
			});
		case "Attract": case "Captivate":
			return !atk.gender || !def.gender || atk.gender === "N" || def.gender === "N" || atk.gender === def.gender ||
				(move.name === "Attract" && has(["Oblivious", "Aroma Veil"], ability));
		case "Nightmare":
			return !isAsleep(def) && def.ability !== "Comatose";
		case "Mean Look": case "Block": case "Spider Web":
			return isTrappedBy(def, atk, field);
		case "Lock-On": case "Mind Reader":
			return atk.ability === "No Guard" || def.ability === "No Guard";
		case "Taunt":
			return ability === "Aroma Veil";
		case "Trick": case "Switcheroo":
			return (!atk.item && !def.item) || ability === "Sticky Hold" || /ite$|ium Z$/.test(atk.item) || /ite$|ium Z$/.test(def.item);
		case "Bestow":
			return !atk.item || !!def.item || /ite$|ium Z$/.test(atk.item);
		case "Magnet Rise":
			return field.isGravity || atk.item === "Iron Ball" || !isGrounded(atk, field);
		case "Defog":
			return !!(def.sideState.sr || def.sideState.spikes || def.sideState.toxicSpikes || def.sideState.stickyWeb);
		case "Powder":
			return !hasMoveWhere(def, function (m) {
				return m.type === "Fire" && m.split !== SPLIT_STATUS;
			});
		case "Memento":
			return stage(def, "atk") === 0 && stage(def, "spa") === 0;
		case "Flower Shield":
			return atk.types.indexOf("Grass") === -1;
		case "Burn Up": case "Double Shock":
			return atk.types.indexOf("Fire") === -1;
		case "Poltergeist":
			return !def.item;
		}
		return false;
	};
	if (failsNow()) return down(10);
	if (move.name === "Foresight" || move.name === "Odor Sleuth" || move.name === "Miracle Eye") {
		if (!(def.types.indexOf(move.name === "Miracle Eye" ? "Dark" : "Ghost") !== -1 && stage(def, "eva") >= 5)) down(9);
		return score;
	}
	if (move.name === "Laser Focus" && has(["Battle Armor", "Shell Armor"], ability)) return down(8);
	if (move.name === "Torment" && def.item === "Mental Herb") return down(6);

	switch (effect) {
	case E.SLEEP:
		if (move.effectiveness === 0) down(10);
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
		// Radical Red: Growth, Work Up, Rototiller and Gear Up are this effect and boost either attack;
		// no Choice-lock check here.
		if (atk.ability === "Contrary") return down(10);
		if (has(["Growth", "Work Up", "Rototiller", "Gear Up"], move.name)) {
			if (move.name === "Rototiller" && (atk.types.indexOf("Grass") === -1 || !isGrounded(atk, field))) return down(10);
			if (move.name === "Gear Up" && !has(["Plus", "Minus"], atk.ability)) return score;
			if (!((stage(atk, "atk") < 12 && hasRealPhysical(atk)) || (stage(atk, "spa") < 12 && hasSpecial(atk)))) down(10);
		} else if (stage(atk, "spa") >= 12 || !hasSpecial(atk)) {
			down(10);
		}
		return score;
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
		return selfBoost(["eva"], true);
	case E.ATK_SPATK_UP:
		if (move.name === "Fickle Beam") return standardDamage();
		return selfBoost(["atk", "spa"]);
	case E.ATK_ACC_UP:
		return selfBoost(["atk", "acc"]);
	case E.DEF_SPD_UP:
	case E.COSMIC_POWER:
		return selfBoost(["def", "spd"]);
	case E.BULK_UP:
		// Radical Red: only when nothing can go up any more (Coil checks accuracy too).
		if (atk.ability === "Contrary" || (goodAI && canBeChoiceLocked(atk))) return down(10);
		if ((stage(atk, "atk") >= 12 || !hasRealPhysical(atk)) && stage(atk, "def") >= 12 &&
			(move.name !== "Coil" || stage(atk, "acc") >= 12)) down(10);
		return score;
	case E.CALM_MIND:
		if ((move.name === "Quiver Dance" || move.name === "Geomancy") && turn.battle.trickRoom) return down(10);
		if (move.name === "Quiver Dance" && def.ability === "Dancer") return down(10);
		return selfBoost(move.name === "Quiver Dance" || move.name === "Geomancy" ? ["spa", "spd", "spe"] : ["spa", "spd"]);
	case E.DRAGON_DANCE:
		if (turn.battle.trickRoom) return down(10);
		if (move.name === "Dragon Dance" && def.ability === "Dancer") return down(10);
		return selfBoost(move.name === "Shell Smash" ? ["atk", "spa", "spe"] : ["atk", "spe"]);
	case E.EXTREME_EVOBOOST:
		if (move.name === "Clangorous Soul" && atk.hp <= Math.floor(atk.maxHP / 3)) return down(10);
		return selfBoost(["atk", "def", "spa", "spd", "spe"], true);
	case E.BELLY_DRUM:
		if (atk.ability === "Contrary" || healthPercent(atk) <= 50) down(10);
		return score;
	case E.CURSE:
		if (atk.types.indexOf("Ghost") !== -1) {
			if (healthPercent(atk) <= 50) down(6);
		} else if (!canStatBeRaised(atk, "atk") && !canStatBeRaised(atk, "def") && stage(atk, "spe") <= 0) {
			down(10);
		}
		return score;
	case E.ATTACK_DOWN:
	case E.ATTACK_DOWN_2:
		// Radical Red tests no abilities here; Noble Roar, Tearful Look and Play Nice take either attack.
		var lowerAtk = stage(def, "atk") > 0 && hasPhysicalAttack(def);
		if (has(["Noble Roar", "Tearful Look", "Play Nice"], move.name)) lowerAtk = lowerAtk || (stage(def, "spa") > 0 && hasSpecial(def));
		else if (move.name === "Venom Drench") {
			if (!/^(psn|tox)$/.test(def.status)) return down(10);
			lowerAtk = lowerAtk || stage(def, "spe") > 0 || (stage(def, "spa") > 0 && hasSpecial(def));
		}
		if (!lowerAtk) down(10);
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
		if ((stage(def, "atk") === 0 || !hasPhysicalAttack(def)) && stage(def, "def") === 0) down(10);
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
		// Radical Red's own rule: Stone Axe and Ceaseless Edge are attacks; with three or fewer of your
		// Pokémon left (or your Magic Bounce) nothing counts against hazards; a foe that can clear or
		// reflect them costs 10 half the time; Stealth Rock already up costs 20. (A Rapid Spin used
		// earlier in the battle would cost 9 half the time; no move has been used yet here.)
		if (move.name === "Stone Axe" || move.name === "Ceaseless Edge") return standardDamage();
		if (def.monsLeft <= 3 || def.ability === "Magic Bounce") return score;
		// A fight where hazards can't be removed (Hardcore Clair and Lance) only counts Magic Coat.
		var hazardsStay = typeof currentBattleEffect === "string" && /Can't remove hazards/i.test(currentBattleEffect);
		if (((!hazardsStay && ((hasMoveNamed(def, ["Rapid Spin"]) && atk.types.indexOf("Ghost") === -1) || hasMoveNamed(def, ["Defog"]))) ||
			hasMoveNamed(def, ["Magic Coat"])) &&
			!turn.coin("hazardClear" + turn.phase + atk.key + i, 0.5)) down(10);
		if (move.name === "Stealth Rock" && def.sideState.sr) down(20);
		else if ((move.name === "Sticky Web" && def.sideState.stickyWeb) || (move.name === "Spikes" && def.sideState.spikes >= 3) ||
			(move.name === "Toxic Spikes" && def.sideState.toxicSpikes >= 2)) down(10);
		else if (goodAI && ((move.name === "Spikes" && def.sideState.spikes >= 1) || (move.name === "Toxic Spikes" &&
			def.sideState.toxicSpikes === 1)) && hasMoveNamed(def, ["Rapid Spin", "Defog", "Mortal Spin", "Tidy Up"])) down(10);
		return score;
	case E.SANDSTORM:
		if (field.weather === "Sand" || has(["Harsh Sunshine", "Heavy Rain", "Strong Winds"], field.weather)) down(10);
		return score;
	case E.RAIN_DANCE:
		if (/Rain/.test(field.weather || "") || has(["Harsh Sunshine", "Heavy Rain", "Strong Winds"], field.weather)) down(10);
		return score;
	case E.SUNNY_DAY:
		if (/Sun/.test(field.weather || "") || has(["Harsh Sunshine", "Heavy Rain", "Strong Winds"], field.weather)) down(10);
		return score;
	case E.HAIL:
		if (isHail(field) || has(["Harsh Sunshine", "Heavy Rain", "Strong Winds"], field.weather)) down(10);
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
		// Radical Red's CanRest: Insomnia and Vital Spirit don't stop it.
		if (atk.hp === atk.maxHP || atk.status === "slp" || has(["Purifying Salt", "Sweet Veil", "Comatose"], atk.ability) ||
			(atk.ability === "Leaf Guard" && /Sun/.test(field.weather || "") && atk.item !== "Utility Umbrella") ||
			((field.terrain === "Electric" || field.terrain === "Misty") && isGrounded(atk, field))) down(10);
		if (atk.hp === atk.maxHP) down(10);
		else if (healthPercent(atk) >= 90) down(9);
		return score;
	case E.PROTECT:
		if (def.ability === "Unseen Fist") return down(10);
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
		} else if (move.name === "Gravity" && field.isGravity && atk.types.indexOf("Flying") === -1 && atk.item !== "Air Balloon") {
			down(10);
		}
		return score;
	case E.TEAM_EFFECTS:
		if (move.name === "Tailwind" && (atk.sideState.tailwind || turn.battle.trickRoom)) down(10);
		return score;
	case E.FAKE_OUT:
		if (!atk.firstTurn) {
			down(10);
			return standardDamage();
		}
		if (move.name === "Fake Out" && canBeChoiceLocked(atk) && (def.monsLeft >= 2 || !knocksOut(turn, atk, def, i, 1)) && atk.monsLeft <= 1) down(10);
		return standardDamage();
	case E.BATON_PASS:
		if (move.name === "Baton Pass") {
			if (atk.monsLeft <= 1) return down(10);
			if (!Object.keys(atk.boosts).some(function (stat) {
				return atk.boosts[stat] > 0;
			})) down(6);
			return score;
		}
		if (move.name === "Shed Tail") {
			if (atk.monsLeft <= 1 || healthPercent(atk) <= 50) down(10);
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
		// Radical Red: not into a foe that can Protect or hide (Fly, Dig); no type check after.
		if (hasProtectMove(def) || hasEffect(def, [E.SEMI_INVULNERABLE])) return down(10);
		var explosionKOs = knocksOut(turn, atk, def, i, 1);
		if (def.monsLeft <= 1 && explosionKOs) return score;
		if (!explosionKOs || (def.monsLeft >= 2 && anotherMoveKnocksOut(turn, atk, def, i))) down(4);
		return score;
	case E.SUCKER_PUNCH:
		// Radical Red: -9 whenever it would fail (CFRU master: -10 when you have no attacks).
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
			down(10);
		}
		if (move.name === "Dragon Tail" || move.name === "Circle Throw" || move.name === "Roar of Time") return standardDamage();
		if (def.monsLeft <= 1 || ability === "Suction Cups") down(10);
		return score;
	case E.KNOCK_OFF:
		return score;
	case E.DREAM_EATER:
		if (!isAsleep(def) && def.ability !== "Comatose") return down(10);
		return score;
	case E.RECHARGE:
		if (knocksOut(turn, atk, def, i, 1) && anotherMoveKnocksOut(turn, atk, def, i) && atk.ability !== "Truant") down(9);
		return standardDamage();
	case E.OHKO:
		if (defAbility(atk, def) === "Sturdy" || atk.level < def.level || (move.name === "Sheer Cold" && def.types.indexOf("Ice") !== -1)) {
			return down(10);
		}
		return standardDamage();
	case E.RECOIL_IF_MISS:
		if (accuracyOf(atk, def, move, field) < 70 && atk.ability !== "Magic Guard") down(6);
		return standardDamage();
	case E.FOCUS_ENERGY:
		if (atk.focusEnergy) down(10);
		return score;
	case E.COUNTER:
	case E.MIRROR_COAT:
		// Radical Red: a further -10 half the time, every turn (CFRU master: -8 only after a wrong guess).
		if (!predicted || predicted.split === SPLIT_STATUS) down(10);
		if (move.name === "Metal Burst" && hitsFirst(turn, atk, move, def)) {
			down(10);
			return standardDamage();
		}
		if (!turn.coin("counter" + turn.phase + atk.key + i, 0.5)) down(10);
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
		return score;
	case E.PERISH_SONG:
		if (atk.monsLeft <= 1 && atk.ability !== "Soundproof" && def.monsLeft >= 2) down(10);
		if (def.ability === "Soundproof") down(10);
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
		// Radical Red: Fly, Dig and the like aren't treated as charging moves.
		if (predicted && predicted.effect === E.SEMI_INVULNERABLE && hitsFirst(turn, atk, move, def)) down(10);
		if ((move.name === "Fly" || move.name === "Bounce") && secondaryDamage(atk, field) > 0 && (field.weather === "Sand" || isHail(field)) &&
			atk.hp <= Math.floor(atk.maxHP / 16)) down(10);
		return standardDamage();
	case E.SOLARBEAM:
	case E.SKULL_BASH:
	case E.SKY_ATTACK:
	case E.RAZOR_WIND:
		// Radical Red: always -4 for the charging turn (-10 if it would faint first), whatever the AI level.
		if (!needsCharge(atk, move, field)) return standardDamage();
		down(willFaintFromChip(atk, field) ? 10 : 4);
		if (def.status === "par" || isAsleep(def)) return standardDamage();
		if (hasProtectMove(def) && !willFaintFromChip(def, field)) {
			down(8);
			return standardDamage();
		}
		if (atk.speed > def.speed) {
			if (canKnockOut(turn, def, atk) && predicted) down(4);
		} else if (can2HKO(turn, def, atk) && predicted) {
			down(8);
		}
		return standardDamage();
	case E.ABSORB:
		if (move.name === "Strength Sap") {
			if (ability === "Contrary" || stage(def, "atk") === 0) down(10);
			return score;
		}
		if (ability === "Liquid Ooze" && !knocksOut(turn, atk, def, i, 1)) down(6);
		return standardDamage();
	case E.RECOIL:
		// Radical Red's recoil lists; a move not on them counts its whole damage as recoil.
		if (has(["Magic Guard", "Rock Head"], atk.ability)) return standardDamage();
		var dealt = moveDamage(turn, atk, def, i);
		var recoil = has(RECOIL_QUARTER, move.name) ? Math.max(1, dealt >> 2) : has(RECOIL_THIRD, move.name) ? Math.max(1, Math.floor(dealt / 3)) :
			has(RECOIL_HALF, move.name) ? Math.max(1, dealt >> 1) : has(["Mind Blown", "Steel Beam"], move.name) ? Math.max(1, atk.maxHP >> 1) : dealt;
		if (atk.hp > recoil || def.monsLeft <= 1) return standardDamage();
		if (def.hp > recoil || anotherMoveKnocksOut(turn, atk, def, i)) down(4);
		return score;
	}
	return standardDamage();
}

// AnyUsefulStatIsRaised (Radical Red's older form, for phazing and Explosion): with Stored Power or
// Power Trip any boost; otherwise Attack with a physical move, Defence when the foe has a physical
// move or Body Press, Sp. Atk with a special move, Sp. Def when the foe has a special move, and
// Speed, accuracy and evasion always.
function anyUsefulStatRaised(side, foe) {
	var up = function (stat) {
		return stage(side, stat) > 6;
	};
	if (hasMoveNamed(side, ["Stored Power", "Power Trip"])) return ["atk", "def", "spa", "spd", "spe", "acc", "eva"].some(up);
	return (up("atk") && hasPhysical(side)) || (up("def") && (hasPhysical(foe) || hasMoveNamed(foe, ["Body Press"]))) ||
		(up("spa") && hasSpecial(side)) || (up("spd") && hasSpecial(foe)) || up("spe") || up("acc") || up("eva");
}

// CanBeFlinched and IsUsefulToFlinchTarget: the AI moves first, nothing stops the flinch, and the
// foe would act (not asleep without Sleep Talk or Snore).
function canFlinch(turn, atk, def, move) {
	if (has(["Inner Focus", "Shield Dust"], defAbility(atk, def)) || def.item === "Covert Cloak") return false;
	if (!hitsFirst(turn, atk, move, def)) return false;
	return !isAsleep(def) || hasEffect(def, [E.SLEEP_TALK, E.SNORE]);
}

// ShouldTrap (stall styles): the foe can switch and won't knock the AI out before the trap pays.
function shouldTrap(turn, atk, def, move) {
	if (willFaintFromChip(atk, turn.battle.field) || !isGoodToTaunt(styleOf(turn, atk)) || def.monsLeft <= 1) return false;
	return hitsFirst(turn, atk, move, def) ? !canKnockOut(turn, def, atk) : !canKnockOut(turn, def, atk) && !can2HKO(turn, def, atk);
}

// ResistsAllMovesAtFullHealth: none of the foe's moves takes a third of the AI's full HP.
function resistsAllAtFullHealth(turn, def, atk) {
	return def.moves.every(function (move, i) {
		return !move || !isDamaging(move) || moveDamage(turn, def, atk, i) < Math.floor(atk.maxHP / 3);
	});
}

// OffensiveSetupMoveInMoveset: a boosting move, or an attack likely to raise an offence.
function hasOffensiveSetupMove(side) {
	return hasMoveWhere(side, function (m) {
		if (has([E.ATTACK_UP, E.SPECIAL_ATTACK_UP, E.EVASION_UP, E.ATTACK_UP_2, E.SPEED_UP_2, E.SPECIAL_ATTACK_UP_2, E.EVASION_UP_2,
			E.ATK_SPATK_UP, E.ATK_ACC_UP, E.BULK_UP, E.CALM_MIND, E.DRAGON_DANCE, E.BELLY_DRUM], m.effect)) return true;
		if (has([E.ATTACK_UP_HIT, E.SPECIAL_ATTACK_UP_HIT, E.SPECIAL_DEFENSE_DOWN_HIT, E.SPECIAL_DEFENSE_DOWN_2_HIT, E.DEFENSE_DOWN_HIT], m.effect)) {
			return chanceOf(side, m) >= 50 && m.effectiveness > 0;
		}
		return has([E.SUPERPOWER, E.OVERHEAT], m.effect) && side.ability === "Contrary" && m.effectiveness > 0;
	});
}

// ShouldUseWishAromatherapy (Wish), singles: only a cleric, not as the last Pokémon about to fall,
// and someone below 65% (the benched are taken to be at full HP).
function shouldUseWish(turn, atk, def) {
	if (styleOf(turn, atk) !== STYLE.CLERIC || willFaintFromChip(atk, turn.battle.field)) return false;
	if (atk.monsLeft <= 1 && ((can2HKO(turn, def, atk) && !hasProtectMove(atk)) || canKnockOut(turn, atk, def))) return false;
	return healthPercent(atk) < 65;
}

// ShouldCourtChange: swapping the sides' conditions helps the side (the other side has screens or
// a Tailwind it lacks, or it has hazards the other lacks).
function shouldCourtChange(side, foe) {
	var mine = side.sideState, theirs = foe.sideState;
	return ["reflect", "lightScreen", "auroraVeil", "tailwind"].some(function (k) {
		return theirs[k] && !mine[k];
	}) || ["sr", "spikes", "stickyWeb"].some(function (k) {
		return mine[k] && !theirs[k];
	});
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
	// Secondary chances with Sheer Force and Serene Grace (nobody is assumed to be behind a Substitute).
	var chance = chanceOf(atk, move);
	var phazingPredicted = !!predicted && has([E.ROAR, E.HAZE, E.REMOVE_TARGET_STAT_CHANGES], predicted.effect);
	// Recover's +8 for stallers and phazers, else STATUS(3) (RECOVER_INCREASE).
	var recoverBonus = function () {
		if (style === STYLE.STALL || style === STYLE.PHAZING) up(8);
		else status(3);
	};
	// The Cosmic Power logic (Defend Order, Stockpile, Contrary Shell Smash): Defence (its "1"
	// raises Attack, as in the game), else Sp. Def.
	var cosmicPower = function () {
		var defense = goodIdeaToRaise(turn, atk, def, "def");
		if (defense === 1) up(statBonus(turn, atk, def, move, "atk", 10, 2));
		else if (defense === 2) up(statBonus(turn, atk, def, move, "def", 8, 1));
		else if (goodIdeaToRaise(turn, atk, def, "spd")) up(statBonus(turn, atk, def, move, "spd", 10, 1));
	};
	var lowerStat = {};
	lowerStat[E.ATTACK_DOWN_HIT] = "atk";
	lowerStat[E.DEFENSE_DOWN_HIT] = "def";
	lowerStat[E.SPECIAL_ATTACK_DOWN_HIT] = "spa";
	lowerStat[E.SPECIAL_DEFENSE_DOWN_HIT] = "spd";
	lowerStat[E.ACCURACY_DOWN_HIT] = "acc";
	lowerStat[E.EVASION_DOWN_HIT] = "eva";

	switch (effect) {
	case E.SLEEP:
	case E.YAWN:
		up(sleepBonus(turn, atk, def, move));
		break;
	case E.PARALYZE:
	case E.PARALYZE_HIT:
		if (effect === E.PARALYZE_HIT && chance < 75) break;
		if (!canBeParalyzed(atk, def, field) || badIdeaToStatus(atk, def, "par", field)) break;
		status((def.speed >= atk.speed && def.speed / 2 < atk.speed) || hasDoubleDamageMove(atk) ||
			hasEffect(atk, [E.FLINCH_HIT]) ? 2 : 1);
		break;
	case E.WILL_O_WISP:
	case E.BURN_HIT:
		if (effect === E.BURN_HIT && chance < 75) break;
		if (!canBeBurned(atk, def, field) || badIdeaToStatus(atk, def, "brn", field)) break;
		if (predicted && predicted.split === SPLIT_PHYSICAL && knocksOut(turn, def, atk, def.moves.indexOf(predicted), 1)) status(3);
		else status(hasDoubleDamageMove(atk) || hasMoveNamed(atk, ["Infernal Parade"]) || hasPhysical(def) ? 2 : 1);
		break;
	case E.POISON:
	case E.TOXIC:
	case E.POISON_HIT:
	case E.BAD_POISON_HIT:
		if ((effect === E.POISON_HIT || effect === E.BAD_POISON_HIT) && chance < 75) break;
		if (!canBePoisoned(atk, def, field) || badIdeaToStatus(atk, def, "psn", field)) break;
		// Radical Red: Venoshock, Barb Barrage or Merciless (no Venom Drench); or Hex with Will-O-Wisp
		// when burning is no better.
		if (hasMoveNamed(atk, ["Venoshock", "Barb Barrage"]) || atk.ability === "Merciless") status(2);
		else if (hasDoubleDamageMove(atk) && hasEffect(atk, [E.WILL_O_WISP]) &&
			(!hasPhysical(def) || badIdeaToStatus(atk, def, "brn", field) || defAbility(atk, def) === "Flash Fire")) status(2);
		else status(1);
		break;
	case E.CONFUSE:
	case E.CONFUSE_HIT:
		// A confusing attack only when it can't miss (No Guard, a never-miss move).
		if (effect === E.CONFUSE_HIT && (chance < 75 || !moveWillHit(atk, def, move, field))) break;
		if (canBeConfused(atk, def, field)) {
			status(def.status === "par" || (atk.ability === "Serene Grace" && hasEffect(atk, [E.FLINCH_HIT])) ? 2 : 1);
		}
		break;
	case E.SWAGGER:
	case E.FLATTER:
		// Flatter goes with Psych Up only; Swagger with Foul Play too.
		if (hasEffect(atk, [E.PSYCH_UP]) || (effect === E.SWAGGER && hasMoveNamed(atk, ["Foul Play"]))) status(2);
		else if (canBeConfused(atk, def, field)) {
			status(def.status === "par" || (atk.ability === "Serene Grace" && hasEffect(atk, [E.FLINCH_HIT])) ? 2 : 1);
		}
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
		// Radical Red: Growth and Work Up raise Attack for a physical attacker, else Sp. Atk (no
		// Contrary check).
		if (move.name === "Growth" || move.name === "Work Up") {
			if (goodIdeaToRaise(turn, atk, def, "atk")) up(statBonus(turn, atk, def, move, "atk", 8, 2));
			else if (goodIdeaToRaise(turn, atk, def, "spa")) up(statBonus(turn, atk, def, move, "spa", 8, 2));
			break;
		}
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
	// Radical Red: Double Team and Minimize get nothing (CFRU master scores them like other boosts).
	case E.EVASION_UP:
	case E.EVASION_UP_2:
	case E.MINIMIZE:
		break;
	// Radical Red: no bonus for ATK_SPATK_UP (Fickle Beam), ATK_ACC_UP or DEF_SPD_UP.
	case E.COSMIC_POWER:
		if (atk.ability !== "Contrary") cosmicPower();
		break;
	case E.STOCKPILE:
		if (hasMoveNamed(atk, ["Swallow", "Spit Up"])) status(2);
		else if (atk.ability !== "Contrary") cosmicPower();
		break;
	case E.CHARGE:
		if (hasMoveWhere(atk, function (m) {
			return isDamaging(m) && m.type === "Electric" && m.effectiveness > 0;
		})) status(2);
		else raise("spd", 10, 1);
		break;
	case E.BULK_UP:
		if (!(hasPhysical(atk) && raise("atk", 8, 2))) raise("def", 8, 1);
		break;
	case E.CALM_MIND:
		// Quiver Dance not into a Dancer; Geomancy only with Power Herb or a foe that can't act, and
		// no phazing move to undo it.
		if (move.name === "Quiver Dance" && def.ability === "Dancer") break;
		if (move.name === "Geomancy" && (!(atk.item === "Power Herb" || isIncapacitated(def)) ||
			hasEffect(def, [E.ROAR, E.HAZE, E.REMOVE_TARGET_STAT_CHANGES]))) break;
		if ((move.name === "Quiver Dance" || move.name === "Geomancy") && raise("spe", 8, 3)) break;
		if (!raise("spa", 8, 2)) raise("spd", 8, 1);
		break;
	case E.DRAGON_DANCE:
		// Shell Smash with Contrary raises the defences: the Cosmic Power logic.
		if (move.name === "Shell Smash" && atk.ability === "Contrary") {
			cosmicPower();
			break;
		}
		if (raise("spe", 8, 3)) break;
		if (!raise("atk", 8, 2) && move.name === "Shell Smash") raise("spa", 8, 2);
		break;
	case E.EXTREME_EVOBOOST:
		if (phazingPredicted || atk.ability === "Contrary") break;
		if (move.name === "Clangorous Soul" && predicted) {
			var hit = def.moves.indexOf(predicted);
			if (knocksOut(turn, def, atk, hit, 1) || (knocksOut(turn, def, atk, hit, 3) && !knocksOut(turn, def, atk, hit, 2))) break;
		}
		// Attack with a physical move, else Sp. Atk with a special one, else Speed: the next only if
		// the last gave nothing.
		var evoBefore = score;
		if (hasRealPhysical(atk)) up(statBonus(turn, atk, def, move, "atk", 8, 2));
		if (score === evoBefore && hasSpecial(atk)) up(statBonus(turn, atk, def, move, "spa", 8, 2));
		if (score === evoBefore) up(statBonus(turn, atk, def, move, "spe", 8, 3));
		break;
	case E.BELLY_DRUM:
		if (hasRealPhysical(atk) && atk.ability !== "Contrary" && !badIdeaToRaiseStat(turn, atk, def, "atk")) {
			up(statBonus(turn, atk, def, move, "atk", 8, 2));
		}
		break;
	case E.CURSE:
		// A Ghost's Curse is worth more against a trapped foe; the other kind checks the foe's Magic
		// Guard (as Radical Red's code does), not the AI's.
		if (atk.types.indexOf("Ghost") !== -1) status(isTrappedBy(def, atk, field) ? 3 : 1);
		else if (atk.ability !== "Contrary" && defAbility(atk, def) !== "Magic Guard" && !phazingPredicted) {
			if (hasMoveNamed(atk, ["Gyro Ball"])) up(statBonus(turn, atk, def, move, "atk", 12, 4));
			else if (stage(atk, "spe") >= 3) {
				if (stage(atk, "atk") < 8) up(statBonus(turn, atk, def, move, "atk", 8, 2));
				else if (stage(atk, "def") <= 7) up(statBonus(turn, atk, def, move, "def", 8, 1));
			}
		}
		break;
	// Radical Red: SPECIAL_ATTACK_UP_HIT (Charge Beam, Fiery Dance) gets nothing.
	case E.ATTACK_UP_HIT:
		if (atk.ability === "Contrary") break;
		if (move.name === "Fell Stinger" && stage(atk, "atk") < 12 && knocksOut(turn, atk, def, i, 1)) {
			up(hitsFirst(turn, atk, move, def) ? 9 : 3);
			break;
		}
		if (atk.ability === "Parental Bond" && goodIdeaToRaise(turn, atk, def, "atk")) up(statBonus(turn, atk, def, move, "atk", 8, 2));
		else if (chance >= 75) raise("atk", 8, 2);
		break;
	case E.SPEED_UP_1_HIT:
		if (chance >= 75) raise("spe", 8, 3);
		break;
	case E.ATTACK_DOWN_HIT:
	case E.DEFENSE_DOWN_HIT:
	case E.SPECIAL_ATTACK_DOWN_HIT:
	case E.SPECIAL_DEFENSE_DOWN_HIT:
	case E.ACCURACY_DOWN_HIT:
	case E.EVASION_DOWN_HIT:
		// Not for damage dealers; a 50% or better drop it's a good idea to land (Snarl, Lunge).
		if (!isDamager(style) && chance >= 50 && goodIdeaToLower(turn, def, atk, move, lowerStat[effect])) status(effect === E.EVASION_DOWN_HIT ? 2 : 1);
		break;
	case E.FLINCH_HIT:
		if (!canFlinch(turn, atk, def, move)) break;
		// With Serene Grace or a foe already slowed (paralysed), a likely flinch or one that buys a
		// turn the AI needs; Radical Red also always likes Double Iron Bash.
		if (atk.ability === "Serene Grace" || def.status === "par") {
			if (chance >= 60 || !can2HKO(turn, atk, def)) status(3);
		} else if (move.name === "Double Iron Bash") status(3);
		break;
	case E.MULTI_HIT:
	case E.DOUBLE_HIT:
	case E.TRIPLE_KICK:
		// A sweeper's King's Rock flinches, or Scale Shot's Speed.
		var strongest = atk.moves[strongestMove(turn, atk, def)];
		if (isSweeper(style) && !isStrongest(turn, atk, def, i) && strongest && !isMultiHit(strongest) &&
			has(["King's Rock", "Razor Fang"], atk.item)) up(3);
		else if (move.name === "Scale Shot") raise("spe", 8, 3);
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
		if (goodIdeaToLower(turn, def, atk, move, "spa")) status(1);
		break;
	case E.SPECIAL_DEFENSE_DOWN:
	case E.SPECIAL_DEFENSE_DOWN_2:
		if (goodIdeaToLower(turn, def, atk, move, "spd")) status(1);
		break;
	case E.ACCURACY_DOWN:
	case E.ACCURACY_DOWN_2:
		if (goodIdeaToLower(turn, def, atk, move, "acc")) status(1);
		break;
	case E.TICKLE:
		if (goodIdeaToLower(turn, def, atk, move, "atk") || goodIdeaToLower(turn, def, atk, move, "def")) status(1);
		break;
	case E.EVASION_DOWN:
	case E.EVASION_DOWN_2:
		if (goodIdeaToLower(turn, def, atk, move, "eva")) status(2);
		break;
	// Radical Red: a speed-lowering attack (Low Sweep, Icy Wind) and grounding a foe in the air (Smack
	// Down) only get their "past the strongest move" +3 on half the rolls; CFRU master always gives it.
	case E.SPEED_DOWN_HIT:
		if (chance >= 50 && goodIdeaToLower(turn, def, atk, move, "spe") && turn.coin("speedDrop" + turn.phase + atk.key + i, 0.5)) up(3);
		break;
	case E.SMACK_DOWN:
		if (!isGrounded(def, field) && turn.coin("smackDown" + turn.phase + atk.key + i, 0.5)) up(3);
		break;
	case E.REFLECT:
	case E.LIGHT_SCREEN:
		if (shouldSetUpScreens(turn, atk, def, move)) {
			// Radical Red: +15 for Reflect and Light Screen (CFRU master +7).
			if (style === STYLE.SETUP_SCREENS || style === STYLE.SUPPORT_SCREENS) up(move.name === "Aurora Veil" ? 8 : 15);
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
		// With Aurora Veil to follow, only a screen setter gets anything.
		if (hasMoveNamed(atk, ["Aurora Veil"])) {
			if (style === STYLE.SETUP_SCREENS || style === STYLE.SUPPORT_SCREENS) up(8);
		} else if (has(["Ice Body", "Forecast", "Slush Rush", "Magic Guard", "Overcoat"], atk.ability) ||
			hasMoveNamed(atk, ["Blizzard", "Aurora Veil", "Weather Ball"]) || atk.item === "Icy Rock" || hasEffect(def, [E.MORNING_SUN])) status(2);
		break;
	case E.SET_TERRAIN:
		status(2);
		break;
	case E.RESTORE_HP:
	case E.MORNING_SUN:
	case E.SWALLOW:
		if (shouldRecover(turn, atk, def, move)) recoverBonus();
		else if (move.name === "Jungle Healing" && atk.status) status(3);
		break;
	case E.ABSORB:
	case E.DREAM_EATER:
		// Radical Red: draining moves only help a staller in singles (CFRU master: +3 for anyone).
		if (shouldRecover(turn, atk, def, move) && style === STYLE.STALL) status(2);
		break;
	case E.WISH:
		if (shouldUseWish(turn, atk, def)) up(8);
		else if (shouldRecover(turn, atk, def, move)) recoverBonus();
		break;
	case E.REST:
		var foeChipped = secondaryDamage(def, field) > 0;
		if (resistsAllAtFullHealth(turn, def, atk) && !hasOffensiveSetupMove(def)) {
			if ((atk.hp < atk.maxHP && foeChipped) || shouldRecover(turn, atk, def, move)) recoverBonus();
		} else if (atk.item === "Chesto Berry" || atk.item === "Lum Berry" || hasEffect(atk, [E.SLEEP_TALK, E.SNORE]) ||
			has(["Shed Skin", "Early Bird"], atk.ability) || (atk.ability === "Hydration" && /Rain/.test(field.weather || "") &&
			atk.item !== "Utility Umbrella")) {
			if (shouldRecover(turn, atk, def, move)) recoverBonus();
		} else if (foeChipped && style === STYLE.STALL) {
			recoverBonus();
		} else if (atk.status && turn.coin("rest" + turn.phase + atk.key, 0.5) && shouldRecover(turn, atk, def, move)) {
			recoverBonus();
		}
		break;
	case E.PROTECT:
		// Quick Guard, Wide Guard, Crafty Shield and Mat Block count as Protect when your predicted move
		// is one they stop.
		if (move.name === "Quick Guard" && !(predicted && priorityOf(def, predicted, field) > 0)) break;
		if (move.name === "Wide Guard" && !(predicted && (predicted.target & (MOVE_TARGET_BOTH | MOVE_TARGET_FOES_AND_ALLY)))) break;
		if (move.name === "Crafty Shield" && !(predicted && predicted.split === SPLIT_STATUS && !isSelfTargeting(predicted))) break;
		if (move.name === "Mat Block" && !(atk.firstTurn && predicted && isDamaging(predicted) && !isSelfTargeting(predicted))) break;
		// Radical Red: an Aegislash in Blade Forme uses King's Shield half the time it can.
		if (move.name === "King's Shield" && atk.ability === "Stance Change" && atk.name === "Aegislash-Blade" && !isIncapacitated(def) &&
			turn.coin("kingsShield" + turn.phase + atk.key + i, 0.5)) {
			if (style === STYLE.STALL) up(3);
			else status(3);
			break;
		}
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
		if (move.name === "Trick Room") {
			if (!turn.battle.trickRoom && atk.speed < def.speed) status(3);
		} else if (move.name === "Magic Room") {
			status(1);
		} else if (move.name === "Wonder Room") {
			// When swapping the defences helps against what the foe hits with.
			if ((hasPhysical(def) && atk.stats.def < atk.stats.spd) || (hasSpecial(def) && atk.stats.spd < atk.stats.def)) status(2);
		} else if (move.name === "Gravity" && !field.isGravity) {
			// Radical Red: nothing once Gravity is up. A shaky sleep move goes through the sleep rules.
			var sleeper = atk.moves.filter(function (m) {
				return m && m.effect === E.SLEEP && m.accuracy && m.accuracy < 90;
			})[0];
			if (sleeper) up(sleepBonus(turn, atk, def, sleeper));
			else if (defAbility(atk, def) !== "Levitate") status(hasMoveWhere(atk, function (m) {
				return m.accuracy && m.accuracy < 90;
			}) ? 2 : 1);
		}
		break;
	case E.TEAM_EFFECTS:
		if (move.name === "Tailwind") {
			status(has([STYLE.SETUP_SCREENS, STYLE.BATON_PASS, STYLE.CLERIC, STYLE.SUPPORT_SCREENS, STYLE.PHAZING], style) ? 2 : 1);
		} else if (move.name === "Lucky Chant") {
			status(1);
		} else if (move.name === "Magnet Rise" && isGrounded(atk, field) && hasMoveWhere(def, function (m) {
			return isDamaging(m) && m.type === "Ground";
		}) && typeEffectiveness("Ground", atk.types) >= 1) {
			var groundPredicted = predicted && predicted.type === "Ground" && isDamaging(predicted);
			status(groundPredicted && hitsFirst(turn, atk, move, def) ? 3 : groundPredicted ? 2 : 1);
		}
		break;
	case E.TRAP:
		// Not into Rapid Spin, a Ghost or a foe already trapped. Radical Red: Salt Cure +8 on Water and
		// Steel types, else +4; the others when a staller should trap.
		if (hasMoveNamed(def, ["Rapid Spin"]) || def.types.indexOf("Ghost") !== -1) break;
		if (move.name === "Salt Cure") {
			if (!def.saltCured) up(def.types.indexOf("Water") !== -1 || def.types.indexOf("Steel") !== -1 ? 8 : 4);
		} else if (shouldTrap(turn, atk, def, move)) up(7);
		break;
	case E.MIST:
		if (style === STYLE.SETUP_SCREENS || style === STYLE.SUPPORT_SCREENS) up(6);
		break;
	case E.SAFEGUARD:
		if (has([STYLE.BATON_PASS, STYLE.CLERIC, STYLE.SUPPORT_SCREENS, STYLE.PHAZING], style) &&
			!(field.terrain === "Misty" && isGrounded(atk, field))) status(1);
		break;
	case E.PERISH_SONG:
		if (isTrappedBy(def, atk, field)) status(3);
		break;
	case E.NIGHTMARE:
		if ((def.status === "slp" || def.ability === "Comatose") && defAbility(atk, def) !== "Magic Guard") status(3);
		break;
	case E.ATTRACT:
		if (willFaintFromChip(def, field) && atk.speed < def.speed) break;
		status(def.status || isTrappedBy(def, atk, field) ? 2 : 1);
		break;
	case E.PURSUIT:
		// A sweeper's Pursuit into a predicted U-turn or Volt Switch that comes after it.
		if (isSweeper(style) && predicted && isPivotMove(predicted) && !hitsFirst(turn, atk, move, def)) up(3);
		break;
	case E.RAPID_SPIN:
		// Hazards on its own side with someone left to protect: worth clearing. Defog also for the
		// foe's screens (or to lower evasion); Court Change when swapping the sides helps; Rapid Spin
		// and Mortal Spin to free a seeded AI.
		if ((atk.sideState.sr || atk.sideState.spikes || atk.sideState.toxicSpikes || atk.sideState.stickyWeb) && atk.monsLeft > 1) {
			status(3);
		} else if (move.name === "Defog") {
			if (def.sideState.reflect || def.sideState.lightScreen || def.sideState.auroraVeil) status(3);
			else if (!(def.sideState.sr || def.sideState.spikes || def.sideState.toxicSpikes || def.sideState.stickyWeb) &&
				goodIdeaToLower(turn, def, atk, move, "eva")) status(2);
		} else if (move.name === "Court Change") {
			if (shouldCourtChange(atk, def) && !shouldCourtChange(def, atk)) status(2);
		} else if (atk.seeded && move.effectiveness > 0) {
			status(3);
		}
		break;
	case E.FEINT:
		if (predicted && predicted.effect === E.PROTECT) up(3);
		break;
	case E.IMPRISON:
		status(predicted && hasMoveNamed(atk, [predicted.name]) ? 3 : 1);
		break;
	case E.INGRAIN:
		status(atk.item === "Big Root" ? 2 : 1);
		break;
	case E.HEAL_BELL:
		if (style === STYLE.CLERIC && atk.status && !(move.name === "Heal Bell" && atk.ability === "Soundproof")) up(7);
		break;
	case E.REFRESH:
		if (move.name !== "Psycho Shift" && atk.status) status(3);
		break;
	case E.LOCK_ON:
		// Radical Red: only Laser Focus, when the AI can't KO now and survives to use the crit.
		if (move.name === "Laser Focus" && !canKnockOut(turn, atk, def) &&
			(atk.speed > def.speed ? !canKnockOut(turn, def, atk) : !can2HKO(turn, def, atk))) status(1);
		break;
	case E.FURY_CUTTER:
		if (isSweeper(style) && atk.item === "Metronome") up(3);
		break;
	case E.TORMENT:
		status(/^Choice /.test(def.item) || def.ability === "Gorilla Tactics" ? 2 : 0);
		break;
	case E.MAGIC_COAT:
		if (predicted && predicted.split === SPLIT_STATUS && (predicted.target & (MOVE_TARGET_BOTH | MOVE_TARGET_FOES_FIELD))) status(3);
		break;
	case E.SNATCH:
		if (predicted && (predicted.flags & 0x8)) status(3); // FLAG_SNATCH_AFFECTED
		break;
	case E.DISABLE:
		if (def.item !== "Mental Herb" && !hitsFirst(turn, atk, move, def) && predicted && predicted.split === SPLIT_STATUS) status(1);
		break;
	case E.PAIN_SPLIT:
		// Radical Red: only a staller, when the split heals it enough.
		if ((atk.hp + def.hp) / 2 > atk.hp * 1.2 && style === STYLE.STALL) status(2);
		break;
	case E.SEMI_INVULNERABLE:
		if (isSweeper(style)) {
			if (hitsFirst(turn, atk, move, def) ? predicted && has([E.EXPLOSION, E.PROTECT], predicted.effect) :
				predicted && predicted.effect === E.SEMI_INVULNERABLE) up(3);
		}
		break;
	case E.LAST_RESORT:
		// Radical Red: Sky Drop against a foe taking chip damage, for a sweeper.
		if (move.name === "Sky Drop" && isSweeper(style) && secondaryDamage(def, field) > 0) up(3);
		break;
	case E.TYPE_CHANGES:
		if (move.name === "Soak") {
			if (isSweeper(style) && hasMoveWhere(atk, function (m) {
				return isDamaging(m) && (m.type === "Electric" || m.type === "Grass");
			})) status(2);
		} else if (defAbility(atk, def) === "Wonder Guard") {
			status(2);
		}
		break;
	case E.ATTACK_BLOCKERS:
		var healer = hasEffect(def, [E.RESTORE_HP, E.MORNING_SUN, E.SWALLOW, E.WISH, E.REST]);
		if (move.name === "Throat Chop") {
			if (hitsFirst(turn, atk, move, def) && predicted && predicted.sound) status(3);
			else if (isSweeper(style) && hasMoveWhere(def, function (m) {
				return m.sound;
			})) up(3);
		} else if (move.name === "Telekinesis") {
			if (hasMoveWhere(atk, function (m) {
				return m.accuracy && m.accuracy < 90;
			})) status(1);
		} else if (move.name === "Embargo") {
			if (def.item) status(1);
		} else if (move.name !== "Powder") {
			// Heal Block, Psychic Noise, Glaive Rush: against healing.
			if (hitsFirst(turn, atk, move, def) && predicted && has([E.RESTORE_HP, E.MORNING_SUN, E.SWALLOW, E.WISH, E.REST], predicted.effect)) status(3);
			else if (healer || def.item === "Leftovers" || (def.item === "Black Sludge" && def.types.indexOf("Poison") !== -1)) status(2);
		} else if (predicted && predicted.type === "Fire" && isDamaging(predicted)) {
			status(3);
		}
		break;
	case E.FAKE_OUT:
		// Radical Red: only Fake Out itself (not First Impression).
		if (move.name === "Fake Out" && shouldUseFakeOut(turn, atk, def, move)) up(8);
		break;
	case E.BATON_PASS:
	case E.TELEPORT:
		if (move.name === "Baton Pass") {
			if (style === STYLE.BATON_PASS) up(3);
			break;
		}
		// Radical Red: Shed Tail +3 with someone to pass to.
		if (move.name === "Shed Tail") {
			if (atk.monsLeft > 1) up(3);
			break;
		}
		var pivot = shouldPivot(turn, atk, def, i);
		if (pivot === "pivot") up(pivotBonus(style));
		else if (pivot === "immediately") up(9);
		else if (pivot === "dont") {
			score = Math.max(0, score - 9);
			if (isStrongest(turn, atk, def, i)) recalcStrongestIgnoring(turn, atk, def, i);
		}
		// Radical Red: a Zero Form Palafin always wants to switch out (+18).
		if (atk.name === "Palafin") up(18);
		break;
	case E.EXPLOSION:
		if (!predicted || predicted.effect === E.PROTECT) break;
		// Radical Red: +4 with a Gem of its type or a Custap Berry in the red; when another move
		// already knocks out, only against useful boosts.
		if (atk.item === move.type + " Gem" || (atk.item === "Custap Berry" && healthPercent(atk) <= 25)) {
			up(4);
			break;
		}
		if (!isIncapacitated(atk) && atk.moves.some(function (m, j) {
			return j !== i && m && m.effect !== E.FUTURE_SIGHT && isUsable(atk, j, field) && knocksOut(turn, atk, def, j, 1);
		})) {
			if (anyUsefulStatRaised(def, atk)) up(4);
			break;
		}
		if (atk.speed >= def.speed ? can2HKO(turn, atk, def) && !canKnockOut(turn, def, atk) : can2HKO(turn, atk, def) && !can2HKO(turn, def, atk)) break;
		up(4);
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
		// Not an item the foe is glad to lose or that can't be knocked off (Mega Stones); Radical Red
		// has no Sticky Hold check here, and only another move knocking out (not Knock Off) cancels it.
		if (!def.item || has(["Iron Ball", "Lagging Tail", "Sticky Barb"], def.item) || /ite( [XY])?$/.test(def.item) ||
			/ium Z$/.test(def.item) || hasMoveNamed(atk, ["Poltergeist"])) break;
		if (move.name === "Corrosive Gas") status(2);
		else if (!anotherMoveKnocksOut(turn, atk, def, i)) up(3);
		break;
	case E.FOCUS_ENERGY:
		status(has(["Super Luck", "Sniper"], atk.ability) || atk.item === "Scope Lens" ? 2 : 1);
		break;
	// Radical Red: no change for Memento, Healing Wish or Final Gambit (CFRU master: Memento -5).
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
	// Radical Red: a frozen AI wants a move that thaws it (Scald, Flare Blitz...), +10.
	if (atk.status === "frz" && has(UNFREEZE_MOVES, move.name)) score += 10;
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
	if ((willFaintFromChip(atk, field) && !has(MOXIE_ABILITIES, def.ability)) ||
		isIncapacitated(def)) return false;
	// Radical Red: not while badly poisoned (CFRU master has no such rule, and Protects for Moody and
	// when you will faint from chip damage, which Radical Red doesn't).
	if (atk.status === "tox" && !has(["Poison Heal", "Magic Guard", "Toxic Boost"], atk.ability)) return false;
	if ((atk.item === "Toxic Orb" && !atk.status && (has(["Poison Heal", "Toxic Boost", "Quick Feet", "Magic Guard"], atk.ability) ||
		hasMoveNamed(atk, ["Facade"]))) || (atk.item === "Flame Orb" && !atk.status &&
		(has(["Guts", "Flare Boost", "Magic Guard"], atk.ability) || hasMoveNamed(atk, ["Facade"])))) return true;
	if (atk.ability === "Speed Boost" && atk.speed <= def.speed && stage(atk, "spe") < 12) return true;
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
		return isTrappedBy(def, atk, turn.battle.field) ? 7 : 3;
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

// ShouldPivot: whether U-turn, Volt Switch, Flip Turn or Parting Shot is worth using now, using
// how well the AI's best switch-in does against you (none for your side: your party isn't modelled).
// "immediately" when the switching checks chose to pivot out instead of switching.
function shouldPivot(turn, atk, def, i) {
	var move = atk.moves[i];
	var field = turn.battle.field;
	if (turn.goodToPivot && atk === turn.battle.ai) return "immediately";
	var style = styleOf(turn, atk);
	var usefulBoost = (usefulOffenseRaised(atk) && isDamager(style)) || stage(def, "eva") >= 10;
	var flags = atk === turn.battle.ai && turn.battle.party && turn.battle.party.length ? switchInFlags(scoreSwitchIns(turn).best) : 0;
	var F = SWITCH_FLAG;
	if (hazardsHurt(atk, 4, field)) return "dont";
	if (atk.monsLeft <= 1) return "try";
	if (turn.predictedSwitch[def.key] && !usefulBoost) return "pivot";
	var damaging = move.split !== SPLIT_STATUS;
	var full = def.hp === def.maxHP;
	var breaksSash = full && (def.item === "Focus Sash" || defAbility(atk, def) === "Sturdy" ||
		has(["Multiscale", "Shadow Shield"], defAbility(atk, def)));
	var hazardsOnSide = atk.sideState.sr || atk.sideState.spikes > 0;
	// Pivot if its attacking stat is at -3 or worse (with both kinds of attack CFRU only looks at
	// Sp. Atk: it compares the Attack stat's index, not its stage).
	var weakAttacks = function () {
		var physical = hasRealPhysical(atk);
		var special = hasSpecial(atk);
		if (physical && !special) return stage(atk, "atk") <= OFFENSIVE_STAT_MIN;
		if (special) return stage(atk, "spa") <= OFFENSIVE_STAT_MIN;
		return false;
	};
	if (hitsFirst(turn, atk, move, def)) {
		if (anotherMoveKnocksOut(turn, atk, def, i)) return "dont";
		if (canKnockOut(turn, atk, def)) return "try";
		if (isDamager(style) && can2HKO(turn, atk, def)) {
			if (canKnockOut(turn, def, atk)) return "pivot";
			if (damaging && (((flags & F.RESIST_ALL) && (flags & (F.KO_FOE | F.REMOVE_HAZARDS))) || breaksSash)) return "pivot";
		} else if (!usefulBoost) {
			if (isDamager(style) && damaging && breaksSash) return "pivot";
			if (flags & (F.WALLS_FOE | F.RESIST_ALL)) {
				if (hazardsOnSide && (flags & F.REMOVE_HAZARDS)) return "pivot";
				if (willFaintFromChip(atk, field)) return "pivot";
				if (isDamager(style)) return weakAttacks() ? "pivot" : "try";
			}
		}
		return "dont";
	}
	if (canKnockOut(turn, def, atk)) return move.effect === E.TELEPORT ? "dont" : "try";
	if (can2HKO(turn, def, atk)) {
		if (canKnockOut(turn, atk, def)) return anotherMoveKnocksOut(turn, atk, def, i) ? "dont" : "try";
		if (isDamager(style) && (flags & F.KO_FOE) && (flags & (F.OUTSPEEDS | F.WALLS_FOE | F.RESIST_ALL))) return "pivot";
		return "dont";
	}
	if (canKnockOut(turn, atk, def)) return !anotherMoveKnocksOut(turn, atk, def, i) && !usefulBoost ? "try" : "dont";
	if (can2HKO(turn, atk, def)) {
		if (isDamager(style) && damaging && (((flags & F.KO_FOE) && (flags & (F.OUTSPEEDS | F.WALLS_FOE | F.RESIST_ALL))) ||
			((flags & F.RESIST_ALL) && (flags & F.REMOVE_HAZARDS)) || breaksSash)) return "pivot";
		return "dont";
	}
	if (isDamager(style) && (flags & F.KO_FOE) && (flags & F.OUTSPEEDS)) return "pivot";
	if (!usefulBoost && (flags & (F.OUTSPEEDS | F.WALLS_FOE | F.RESIST_ALL))) {
		if (hazardsOnSide && (flags & F.REMOVE_HAZARDS)) return "pivot";
		if (willFaintFromChip(atk, field)) return "pivot";
		if (isDamager(style) && weakAttacks()) return "pivot";
		return "try";
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
	if (atk.moves[i].effect === E.ROAR && styleOf(turn, atk) === STYLE.PHAZING &&
		(def.sideState.sr || def.sideState.spikes || def.sideState.toxicSpikes)) return true;
	return anyUsefulStatRaised(def, atk);
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
		predicted.effect === E.MORNING_SUN)) || has(MOXIE_ABILITIES, atk.ability);

	if (!switching && knocksOutWithBestAccuracy(turn, atk, def, i, true) &&
		(accuracyOf(atk, def, move, field) >= 70 || !helpsAccuracy || canKnockOut(turn, def, atk))) {
		return suckerPunchRule() ? up(9) : score;
	}
	if (!switching && noProtect && !hitsFirst(turn, atk, move, def) && knocksOutWithBestAccuracy(turn, atk, def, i, false) && chipSafe) {
		return up(slowKOBonus(turn, atk, def));
	}
	var predictedIndex = predicted ? def.moves.indexOf(predicted) : -1;
	if (noProtect && predictedIndex !== -1 && knocksOut(turn, def, atk, predictedIndex, 1) &&
		strongestGoesFirst(turn, atk, def) === i && !(turn.goodToPivot && atk === turn.battle.ai) &&
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
 * Switching (ai_switching.c, singles). Before choosing a move the AI may switch out: to take your
 * predicted move with an absorbing ability, to escape a KO, when its moves are all bad, asleep,
 * seeded, at -3 or worse, or to save a sweeper for later. Where it goes is decided by scoring each
 * Pokémon left in its party against yours (CalcMostSuitableMonToSwitchInto), the same scoring
 * that picks its next Pokémon after a KO. Damage between your Pokémon and its benched ones is the
 * calculator's top roll x 0.96 ("more idealistic" than the 0.93 on the field), as in the game.
 */
var SWITCH_FLAG = {KO_FOE: 1, RESIST_ALL: 2, REVENGE_KILL: 4, WALLS_FOE: 8, CAN_2HKO: 16, REMOVE_HAZARDS: 32,
	OUTSPEEDS: 64, FAINTS: 128};
var SWITCH_SCORE = {KO_FOE: 31, RESIST_ALL: 17, REVENGE_KILL: 8, WALLS_FOE: 2, CAN_2HKO: 2, OUTSPEEDS: 14,
	WEAK: 1, FAINTS: 39, FAINTS_BUT_OUTSPEEDS: 15};
var SWITCH_SCORE_MAX = 31 + 17 + 8 + 14;
// OFFENSIVE_STAT_MIN_NUM: a stat stage of 3 is -3.
var OFFENSIVE_STAT_MIN = 3;

// Radical Red's FindMonThatAbsorbsOpponentsMove: Earth Eater takes Ground moves and Well-Baked Body
// Fire ones too, and Earth Eater counts as healing (IsHPAbsorptionAbility).
var SWITCH_ABSORBING = {Electric: ["Volt Absorb", "Lightning Rod", "Motor Drive"], Water: ["Water Absorb", "Dry Skin", "Storm Drain"],
	Fire: ["Flash Fire", "Well-Baked Body"], Grass: ["Sap Sipper"], Ground: ["Earth Eater"]};
var HP_ABSORBING = ["Water Absorb", "Volt Absorb", "Earth Eater"];
var STAT_STAGE_RATIOS = [[10, 40], [10, 35], [10, 30], [10, 25], [10, 20], [10, 15], [10, 10], [15, 10], [20, 10],
	[25, 10], [30, 10], [35, 10], [40, 10]];

AITurn.prototype.keep = function (key, compute) {
	this.kept = this.kept || {};
	if (!(key in this.kept)) this.kept[key] = compute.call(this);
	return this.kept[key];
};

function withStage(value, stageIndex) {
	var ratio = STAT_STAGE_RATIOS[Math.max(0, Math.min(12, stageIndex))];
	return Math.floor(value * ratio[0] / ratio[1]);
}

// AnyStatGreaterThan: any stat stage above `amount` (6 is no change).
function anyStageAbove(side, amount) {
	return ["atk", "def", "spe", "spa", "spd", "acc", "eva"].some(function (stat) {
		return stage(side, stat) > amount;
	});
}

// AnyUsefulOffseniveStatIsRaised, as Radical Red has it: Attack with a physical move, Sp. Atk with a
// special one, or Speed (CFRU master also counts Defence with Body Press).
function usefulOffenseRaised(side) {
	return (stage(side, "atk") > 6 && hasRealPhysical(side)) || (stage(side, "spa") > 6 && hasSpecial(side)) || stage(side, "spe") > 6;
}

function typeEffectiveness(type, types) {
	var row = typeof typeChart !== "undefined" && typeChart && typeChart[type];
	if (!row) return 1;
	return types.reduce(function (product, t) {
		return product * (row[t] !== undefined ? row[t] : 1);
	}, 1);
}

// GetMonEntryHazardDamage: Stealth Rock and Spikes on the AI's side of the field.
function entryHazardDamage(mon, sideState, field) {
	if (mon.ability === "Magic Guard" || mon.item === "Heavy-Duty Boots") return 0;
	var damage = 0;
	if (sideState.sr) damage += Math.floor(mon.maxHP * typeEffectiveness("Rock", mon.types) / 8);
	if (sideState.spikes > 0 && isGrounded(mon, field)) damage += Math.floor(mon.maxHP / [0, 8, 6, 4][Math.min(3, sideState.spikes)]);
	return damage;
}

function willFaintFromHazards(mon, sideState, field) {
	return entryHazardDamage(mon, sideState, field) >= mon.hp;
}

// WillTakeSignificantDamageFromEntryHazards: coming back in would cost 1/fraction of its HP.
function hazardsHurt(side, fraction, field) {
	var damage = entryHazardDamage(side, side.sideState, field);
	return damage > 0 && (damage >= side.hp || damage >= Math.floor(side.maxHP / fraction));
}

function isMoldBreaker(side) {
	return has(MOLD_BREAKERS, side.ability);
}

// IsTrapped through an ability (Shadow Tag, Arena Trap, Magnet Pull); trapping moves are not known.
function isTrappedBy(side, foe, field) {
	if (side.types.indexOf("Ghost") !== -1 || side.item === "Shed Shell") return false;
	if (foe.ability === "Shadow Tag") return side.ability !== "Shadow Tag";
	if (foe.ability === "Arena Trap") return isGrounded(side, field);
	if (foe.ability === "Magnet Pull") return side.types.indexOf("Steel") !== -1;
	return false;
}

function isPivotMove(move) {
	return !!move && move.effect === E.BATON_PASS && move.name !== "Baton Pass";
}

function hasPivotMoveThatAffects(turn, atk, def, mustGoFirst) {
	return atk.moves.some(function (move, i) {
		if (!isPivotMove(move) || !isUsable(atk, i, turn.battle.field)) return false;
		if (move.split !== SPLIT_STATUS && move.maxDamage === 0) return false;
		return !mustGoFirst || hitsFirst(turn, atk, move, def);
	});
}

// HealingMoveInMonMoveset / HealingMoveInMoveset.
function hasHealingMove(side) {
	return hasEffect(side, [E.RESTORE_HP, E.MORNING_SUN, E.SWALLOW, E.WISH]);
}

/* A benched Pokémon against your Pokémon on the field, and back. */

// GetFinalAIMoveDamageFromParty (AI_CalcPartyDmg): one use of a benched Pokémon's move on you.
function partyDamage(turn, mon, def, i) {
	return turn.keep("pdmg" + mon.key + i, function () {
		var move = mon.moves[i];
		var field = turn.battle.field;
		if (!move || move.split === SPLIT_STATUS || move.power === 0) return 0;
		if (move.effect === E.OHKO) return def.hp;
		if (move.effect === E.BURN_UP && mon.types.indexOf("Fire") === -1) return 0;
		if (field.terrain === "Psychic" && priorityOf(mon, move, field) > 0 && isGrounded(def, field)) return 0;
		if (has(["Dazzling", "Queenly Majesty", "Armor Tail"], defAbility(mon, def)) && priorityOf(mon, move, field) > 0) return 0;
		var damage;
		if (has(FIXED_DAMAGE_EFFECTS, move.effect)) {
			damage = move.effect === E.ENDEAVOR ? Math.max(0, def.hp - mon.hp) : move.maxDamage;
		} else {
			var crit = move.critChance >= 1 || (move.critChance >= 0.5 && turn.coin("pcrit" + mon.key + i, 0.5));
			damage = Math.floor((crit ? move.maxCritDamage : move.maxDamage) * 96 / 100);
			if (move.hits <= 1 && (move.effect === E.FALSE_SWIPE || (def.hp === def.maxHP &&
				(def.item === "Focus Sash" || (defAbility(mon, def) === "Sturdy"))))) damage = Math.min(damage, def.hp - 1);
		}
		return Math.min(damage, def.maxHP);
	});
}

function partyMoveKnocksOut(turn, mon, def, i) {
	var move = mon.moves[i];
	if (!move || move.split === SPLIT_STATUS) return false;
	if (def.ability === "Disguise" && def.abilityOn && !isMoldBreaker(mon)) return false;
	return partyDamage(turn, mon, def, i) >= def.hp;
}

// CanKnockOutFromParty: any of its moves.
function partyCanKnockOut(turn, mon, def) {
	for (var i = 0; i < 4; i++) {
		if (mon.moves[i] && isUsable(mon, i, turn.battle.field) && partyMoveKnocksOut(turn, mon, def, i)) return true;
	}
	return false;
}

function partyMaxDamage(turn, mon, def) {
	var best = 0;
	for (var i = 0; i < 4; i++) {
		if (mon.moves[i] && isUsable(mon, i, turn.battle.field)) best = Math.max(best, partyDamage(turn, mon, def, i));
	}
	return best;
}

// AI_CalcMonDefDmg: one use of your move on a benched Pokémon, after it comes in.
function damageToBenched(turn, atk, mon, i) {
	return turn.keep("bdmg" + atk.key + i + mon.key, function () {
		var move = atk.moves[i];
		var hit = mon.incoming[i];
		if (!move || !hit) return 0;
		if (move.effect !== E.PAIN_SPLIT && (move.split === SPLIT_STATUS || (hit.maxDamage === 0 && move.power > 0))) return 0;
		switch (move.effect) {
		case E.SUPER_FANG:
			return Math.floor(mon.hp / 2);
		case E.ENDEAVOR:
			return Math.max(0, mon.hp - atk.hp);
		case E.PAIN_SPLIT:
			return Math.max(0, mon.hp - Math.max(1, Math.floor((atk.hp + mon.hp) / 2)));
		case E.BURN_UP:
			if (atk.types.indexOf("Fire") === -1) return 0;
		}
		if (has(FIXED_DAMAGE_EFFECTS, move.effect)) return hit.maxDamage;
		var crit = hit.critChance >= 1 || (hit.critChance >= 0.5 && turn.coin("bcrit" + atk.key + i + mon.key, 0.5));
		var damage = Math.floor((crit ? hit.maxCritDamage : hit.maxDamage) * 96 / 100);
		if (move.hits <= 1) {
			if (move.effect === E.FALSE_SWIPE) {
				damage = Math.min(damage, mon.hp - 1);
			} else if (entryHazardDamage(mon, mon.sideState, turn.battle.field) === 0 && mon.hp === mon.maxHP &&
				((mon.ability === "Sturdy" && !isMoldBreaker(atk)) || mon.item === "Focus Sash")) {
				damage = Math.min(damage, mon.hp - 1);
			}
		}
		return damage;
	});
}

// Disguise (and Ice Face against physical moves) takes the first hit.
function disguiseTakesHit(mon, atk, move) {
	if (isMoldBreaker(atk) || !mon.abilityOn) return false;
	return mon.ability === "Disguise" || (mon.ability === "Ice Face" && move.split === SPLIT_PHYSICAL);
}

function benchedHitDamage(turn, mon, i) {
	var player = turn.battle.player;
	var move = player.moves[i];
	if (disguiseTakesHit(mon, player, move)) return mon.ability === "Disguise" ? Math.floor(mon.maxHP / 8) : 0;
	return damageToBenched(turn, player, mon, i) + entryHazardDamage(mon, mon.sideState, turn.battle.field);
}

// PredictedMoveWontDoTooMuchToMon: the switch-in can take your predicted move.
function predictedHitIsSafe(turn, mon, flags) {
	var player = turn.battle.player;
	var move = turn.predicted(player);
	if (flags & SWITCH_FLAG.FAINTS) return false;
	if (!move || move.split === SPLIT_STATUS || move.name === "Pursuit") return true;
	if (flags & SWITCH_FLAG.RESIST_ALL) return true;
	if (move.effect === E.SUCKER_PUNCH) return true;
	var damage = benchedHitDamage(turn, mon, player.moves.indexOf(move));
	if (damage >= mon.hp) return false;
	if (damage * 2 < mon.hp) return true;
	return damage * 2 >= mon.maxHP && hasHealingMove(mon) && mon.speed > player.speed;
}

// PredictedMoveWontKOMon.
function predictedHitWontKO(turn, mon) {
	var player = turn.battle.player;
	var move = turn.predicted(player);
	if (!move || move.split === SPLIT_STATUS || move.effect === E.SUCKER_PUNCH) return true;
	return benchedHitDamage(turn, mon, player.moves.indexOf(move)) < mon.hp;
}

// PredictedMoveKOsSelfDueToContact: your predicted move would faint you on its Rough Skin, Iron
// Barbs or Rocky Helmet.
function contactKnocksYouOut(turn, mon) {
	var player = turn.battle.player;
	var move = turn.predicted(player);
	if (!move || !(move.flags & FLAG_CONTACT) || player.ability === "Long Reach" || player.item === "Protective Pads") return false;
	if (player.ability === "Magic Guard") return false;
	var damage = 0;
	if (has(["Rough Skin", "Iron Barbs"], mon.ability) && !isMoldBreaker(player)) damage += Math.floor(player.maxHP / 8);
	if (mon.item === "Rocky Helmet") damage += Math.floor(player.maxHP / 6);
	return damage > 0 && damage >= player.hp;
}

/* CalcMostSuitableMonToSwitchInto: each benched Pokémon scored against yours. */
function scoreSwitchIns(turn) {
	return turn.keep("switchIns", function () {
		var battle = turn.battle;
		var foe = battle.player;
		var ai = battle.ai;
		var field = battle.field;
		var smart = battle.flags > AI_NEGATIVES;
		var hazardsUp = ai.sideState.sr || ai.sideState.spikes > 0;
		var viable = 1 + battle.party.length;
		var entries = [];
		var best = null;
		var second = null;
		var lastValid = null;
		var secondLastValid = null;
		var sameAsBest = function (entry, other, key) {
			if (entry.score !== other.score) return false;
			if ((other.flags & SWITCH_FLAG.FAINTS) && !(entry.flags & SWITCH_FLAG.FAINTS)) return true;
			return !(other.flags & SWITCH_FLAG.FAINTS) && !(entry.flags & SWITCH_FLAG.FAINTS) && turn.coin(key, 0.5);
		};
		battle.party.forEach(function (mon) {
			var entry = {mon: mon, score: 0, flags: 0, canRemoveHazards: false, ranked: false};
			entries.push(entry);
			secondLastValid = lastValid;
			lastValid = entry;
			if (willFaintFromHazards(mon, ai.sideState, field)) return;
			var noteHazardRemoval = function (move) {
				if (move.effect === E.RAPID_SPIN && hazardsUp) entry.canRemoveHazards = viable >= 2;
			};
			if (mon.speed >= foe.speed) {
				entry.score += SWITCH_SCORE.OUTSPEEDS;
				entry.flags |= SWITCH_FLAG.OUTSPEEDS;
			}
			var k;
			if (partyCanKnockOut(turn, mon, foe)) {
				entry.score += SWITCH_SCORE.KO_FOE;
				entry.flags |= SWITCH_FLAG.KO_FOE;
				if (has(MOXIE_ABILITIES, mon.ability) || isTrappedBy(foe, mon, field)) {
					entry.score += SWITCH_SCORE.REVENGE_KILL;
					entry.flags |= SWITCH_FLAG.REVENGE_KILL;
				} else {
					// Priority moves first (each one found goes to the front), then the rest in order.
					var ordered = [];
					for (k = 0; k < 4; k++) {
						if (!mon.moves[k] || !isUsable(mon, k, field)) continue;
						if (priorityOf(mon, mon.moves[k], field) > 0) ordered.unshift({index: k, priority: true});
						else ordered.push({index: k, priority: false});
					}
					for (var o = 0; o < ordered.length; o++) {
						var move = mon.moves[ordered[o].index];
						noteHazardRemoval(move);
						if (move.split !== SPLIT_STATUS && ordered[o].priority && partyMoveKnocksOut(turn, mon, foe, ordered[o].index)) {
							entry.score += SWITCH_SCORE.REVENGE_KILL;
							entry.flags |= SWITCH_FLAG.REVENGE_KILL;
							if (!(entry.flags & SWITCH_FLAG.OUTSPEEDS)) {
								entry.score += SWITCH_SCORE.OUTSPEEDS;
								entry.flags |= SWITCH_FLAG.OUTSPEEDS;
							}
							break;
						} else if (move.name === "Fell Stinger" || move.name === "Pursuit") {
							if (partyMoveKnocksOut(turn, mon, foe, ordered[o].index)) {
								entry.score += SWITCH_SCORE.REVENGE_KILL;
								entry.flags |= SWITCH_FLAG.REVENGE_KILL;
								break;
							}
						}
					}
				}
			} else {
				var usable = false;
				for (k = 0; k < 4; k++) {
					var m = mon.moves[k];
					if (!m || !isUsable(mon, k, field)) continue;
					usable = true;
					noteHazardRemoval(m);
					if (m.split !== SPLIT_STATUS && partyMaxDamage(turn, mon, foe) >= Math.floor(foe.hp / 2)) {
						entry.score += SWITCH_SCORE.CAN_2HKO;
						entry.flags |= SWITCH_FLAG.CAN_2HKO;
						break;
					}
				}
				if (!usable) {
					entry.score = -1;
					return;
				}
			}

			// How well it takes your moves (priority ones first).
			var foeMoves = [];
			var physical = false;
			var special = false;
			for (k = 0; k < 4; k++) {
				var fm = foe.moves[k];
				if (!fm || !isUsable(foe, k, field)) continue;
				if (fm.split === SPLIT_PHYSICAL) physical = true;
				else if (fm.split === SPLIT_SPECIAL) special = true;
				else continue;
				if (priorityOf(foe, fm, field) > 0) foeMoves.unshift({index: k, priority: true});
				else foeMoves.push({index: k, priority: false});
			}
			var hpOnSwitchIn = Math.max(0, mon.hp - entryHazardDamage(mon, ai.sideState, field));
			var faints = false;
			var weak = false;
			var neutral = 0;
			var recovery = passiveRecovery(mon, field);
			for (k = 0; k < foeMoves.length; k++) {
				var hitMove = foe.moves[foeMoves[k].index];
				if (smart) {
					var first = damageToBenched(turn, foe, mon, foeMoves[k].index);
					var other = first;
					if (disguiseTakesHit(mon, foe, hitMove)) {
						first = mon.ability === "Disguise" ? Math.floor(mon.maxHP / 8) : 0;
					} else if (first >= hpOnSwitchIn) {
						faints = true;
						if ((entry.flags & SWITCH_FLAG.OUTSPEEDS) && foeMoves[k].priority &&
							(field.terrain !== "Psychic" || !isGrounded(mon, field))) entry.flags &= ~SWITCH_FLAG.OUTSPEEDS;
						break;
					}
					if (has(["Multiscale", "Shadow Shield"], mon.ability) && mon.hp === mon.maxHP && !isMoldBreaker(foe)) other *= 2;
					var adjustedHP = Math.min(hpOnSwitchIn, mon.maxHP);
					if (adjustedHP + recovery <= first + other) weak = true;
					else if (adjustedHP + recovery * 2 <= first + other * 2) neutral++;
				} else {
					var effectiveness = mon.incoming[foeMoves[k].index].effectiveness;
					if (effectiveness > 1) {
						weak = true;
						break;
					} else if (effectiveness === 1) {
						neutral++;
					}
				}
			}
			var weaken = function () {
				entry.score = entry.score >= SWITCH_SCORE.WEAK ? entry.score - SWITCH_SCORE.WEAK : 0;
			};
			if (faints) {
				if (!(entry.flags & SWITCH_FLAG.OUTSPEEDS)) {
					entry.flags |= SWITCH_FLAG.FAINTS;
					entry.score = entry.score >= SWITCH_SCORE.FAINTS ? entry.score - SWITCH_SCORE.FAINTS : 0;
				} else if (!(entry.flags & SWITCH_FLAG.KO_FOE)) {
					entry.score = entry.score >= SWITCH_SCORE.FAINTS_BUT_OUTSPEEDS ? entry.score - SWITCH_SCORE.FAINTS_BUT_OUTSPEEDS : 0;
				} else {
					weaken();
				}
			} else if (weak) {
				weaken();
			} else if (!neutral) {
				entry.score += SWITCH_SCORE.RESIST_ALL;
				entry.flags |= SWITCH_FLAG.RESIST_ALL;
			} else {
				var attack = withStage(foe.stats.atk, stage(foe, "atk"));
				var spAttack = withStage(foe.stats.spa, stage(foe, "spa"));
				var cantWall = (physical && mon.stats.def <= attack) || (!(physical && mon.stats.def <= attack) && special && mon.stats.spd <= spAttack);
				if (!cantWall) {
					entry.score += SWITCH_SCORE.WALLS_FOE;
					entry.flags |= SWITCH_FLAG.WALLS_FOE;
				}
			}

			entry.ranked = true;
			if (entry.score >= SWITCH_SCORE_MAX && entry.canRemoveHazards) {
				second = best;
				best = entry;
			} else if (!best || entry.score > best.score || sameAsBest(entry, best, "bestTie" + mon.key)) {
				second = best;
				best = entry;
			} else if (!second || entry.score > second.score || sameAsBest(entry, second, "secondTie" + mon.key)) {
				second = entry;
			}
		});
		if (best) {
			if (!(best.flags & SWITCH_FLAG.RESIST_ALL) &&
				(best.flags & (SWITCH_FLAG.KO_FOE | SWITCH_FLAG.OUTSPEEDS)) !== (SWITCH_FLAG.KO_FOE | SWITCH_FLAG.OUTSPEEDS)) {
				for (var i = 0; i < entries.length; i++) {
					if (entries[i].canRemoveHazards && !(entries[i].flags & SWITCH_FLAG.FAINTS)) {
						second = best;
						best = entries[i];
						break;
					}
				}
			}
			return {entries: entries, best: best, second: second};
		}
		// None stood out: the last ones checked.
		var fallback = function (entry) {
			return entry ? {mon: entry.mon, score: 0, flags: 0} : null;
		};
		return {entries: entries, best: fallback(lastValid), second: fallback(secondLastValid)};
	});
}

function switchInFlags(entry) {
	return entry ? entry.flags : 0;
}

// The best Pokémon, the second best, then the rest of the party in order.
function switchInsInOrder(turn) {
	var scored = scoreSwitchIns(turn);
	var list = [];
	if (scored.best) list.push({entry: scored.best, flags: scored.best.flags});
	if (scored.second) list.push({entry: scored.second, flags: scored.second.flags});
	scored.entries.forEach(function (entry) {
		if (entry !== scored.best && entry !== scored.second) list.push({entry: entry, flags: entry.flags, rest: true});
	});
	return list;
}

/* The checks in ShouldSwitch, in order. Each returns null or {mon, pivot}; mon null means the best. */

// FindMonThatAbsorbsOpponentsMove.
function switchToAbsorb(turn, justIn) {
	var battle = turn.battle;
	var ai = battle.ai;
	var foe = battle.player;
	var move = turn.predicted(foe);
	if (stage(ai, "eva") >= 9) return null;
	if (!move || move.split === SPLIT_STATUS) return null;
	if (!isDamager(styleOf(turn, foe))) {
		if (justIn) return null;
		if (turn.coin("absorbHalf", 0.5)) return null;
	}
	if (!hitsFirst(turn, foe, move, ai)) {
		if (canKnockOut(turn, ai, foe)) return null;
	} else if (!canKnockOut(turn, foe, ai) && canKnockOut(turn, ai, foe) && anyStageAbove(ai, 6)) {
		return null;
	}
	if (!canKnockOut(turn, foe, ai) && anyStageAbove(ai, 7)) return null;
	if (isMoldBreaker(foe)) return null;
	var abilities = SWITCH_ABSORBING[move.type];
	if (!abilities || has(abilities, ai.ability)) return null;
	var list = switchInsInOrder(turn);
	for (var i = 0; i < list.length; i++) {
		var mon = list[i].entry.mon;
		if (!has(abilities, mon.ability) || willFaintFromHazards(mon, ai.sideState, battle.field)) continue;
		if (has(HP_ABSORBING, mon.ability) && mon.hp === mon.maxHP && entryHazardDamage(mon, ai.sideState, battle.field) === 0) {
			if (justIn) continue;
			if (finalDamage(turn, foe, ai, foe.moves.indexOf(move), 2) < ai.hp) continue;
		}
		return {mon: mon};
	}
	return null;
}

// ShouldSwitchIfWonderGuard: your Wonder Guard Pokémon, and nothing here can touch it.
function switchForWonderGuard(turn) {
	var battle = turn.battle;
	var ai = battle.ai;
	var foe = battle.player;
	var field = battle.field;
	if (foe.ability !== "Wonder Guard" || willFaintFromChip(foe, field)) return null;
	for (var i = 0; i < 4; i++) {
		var move = ai.moves[i];
		if (!move || !isUsable(ai, i, field)) continue;
		if (move.split !== SPLIT_STATUS) {
			if (isMoldBreaker(ai) || move.effectiveness > 1) return null;
			continue;
		}
		switch (move.effect) {
		case E.SLEEP:
		case E.YAWN:
			if (canBeSlept(ai, foe, field)) return null;
			break;
		case E.ROAR:
			if (foe.monsLeft > 1) return null;
			break;
		case E.TOXIC:
		case E.POISON:
			if (canBePoisoned(ai, foe, field)) return null;
			break;
		case E.WILL_O_WISP:
			if (canBeBurned(ai, foe, field)) return null;
			break;
		case E.CONFUSE:
		case E.SWAGGER:
		case E.FLATTER:
			if (canBeConfused(ai, foe, field)) return null;
			break;
		case E.PARALYZE:
			if (canBeParalyzed(ai, foe, field)) return null;
			break;
		case E.LEECH_SEED:
			if (foe.types.indexOf("Grass") === -1) return null;
			break;
		case E.CURSE:
			if (ai.types.indexOf("Ghost") !== -1) return null;
			break;
		case E.SPIKES:
			if ((move.name === "Stealth Rock" && !foe.sideState.sr) || (move.name === "Toxic Spikes" && foe.sideState.toxicSpikes < 2) ||
				(move.name === "Sticky Web" && !foe.sideState.stickyWeb) || (move.name === "Spikes" && foe.sideState.spikes < 3)) return null;
			break;
		case E.SANDSTORM:
			if (!foe.types.some(function (t) {
				return has(["Rock", "Ground", "Steel"], t);
			})) return null;
			break;
		case E.HAIL:
			if (foe.types.indexOf("Ice") === -1) return null;
			break;
		case E.BATON_PASS:
		case E.TELEPORT:
			return null;
		case E.MEMENTO:
			return null;
		}
	}
	for (var p = 0; p < battle.party.length; p++) {
		var mon = battle.party[p];
		if (mon.moves.some(function (m) {
			return m && m.split !== SPLIT_STATUS && m.effectiveness > 1;
		})) return {mon: mon};
	}
	return null;
}

// ResistsAllMoves: none of the attacker's moves does a third of the defender's HP.
function resistsAllMoves(turn, atk, def) {
	for (var i = 0; i < 4; i++) {
		if (atk.moves[i] && isUsable(atk, i, turn.battle.field) && finalDamage(turn, atk, def, i, 1) >= Math.floor(def.hp / 3)) return false;
	}
	return true;
}

// WallsFoe: its Defence (Sp. Def) beats the attacker's Attack (Sp. Atk) for the moves it has.
function wallsFoe(atk, def) {
	var attack = withStage(atk.stats.atk, stage(atk, "atk"));
	var spAttack = withStage(atk.stats.spa, stage(atk, "spa"));
	if (hasPhysical(atk) && def.stats.def <= attack) return false;
	if (hasSpecial(atk) && def.stats.spd <= spAttack) return false;
	return true;
}

// OnlyBadMovesLeftInMoveset: nothing worth using (Negatives only) and nothing that hurts enough.
function onlyBadMovesLeft(turn) {
	var battle = turn.battle;
	var ai = battle.ai;
	var foe = battle.player;
	var field = battle.field;
	if (battle.flags === AI_NEGATIVES) return false;
	var damaging = 0;
	for (var i = 0; i < 4; i++) {
		var move = ai.moves[i];
		if (!move || !isUsable(ai, i, field)) continue;
		if (scoreNegatives(turn, ai, foe, i, 100) >= 100) {
			if (move.split === SPLIT_STATUS) return false;
			if (move.effect === E.KNOCK_OFF && foe.item && foe.ability !== "Sticky Hold") return false;
			damaging++;
		}
	}
	if (hasEffect(ai, [E.PROTECT])) return false;
	if (damaging === 0) return true;
	if (hasPivotMoveThatAffects(turn, ai, foe, false)) return false;
	var damage = finalDamage(turn, ai, foe, strongestMove(turn, ai, foe), 1);
	if (damage >= foe.hp) return false;
	var recovery = passiveRecovery(foe, field);
	if (recovery || hasHealingMove(foe)) {
		if (damage * 3 >= foe.hp + recovery * 2) return false;
	} else if (damage * 3 >= foe.hp) {
		return false;
	}
	var flags = switchInFlags(scoreSwitchIns(turn).best);
	if (flags === 0) return false;
	if (flags & (SWITCH_FLAG.KO_FOE | SWITCH_FLAG.CAN_2HKO)) return true;
	if (flags & SWITCH_FLAG.RESIST_ALL) return !resistsAllMoves(turn, foe, ai);
	if (flags & SWITCH_FLAG.WALLS_FOE) return !wallsFoe(foe, ai);
	return true;
}

// ShouldSwitchIfOnlyBadMovesLeft.
function switchFromBadMoves(turn, justIn) {
	if (justIn || !onlyBadMovesLeft(turn)) return null;
	var scored = scoreSwitchIns(turn);
	var wanted = SWITCH_FLAG.OUTSPEEDS | SWITCH_FLAG.WALLS_FOE | SWITCH_FLAG.RESIST_ALL;
	if (scored.best && (scored.best.flags & wanted) && predictedHitIsSafe(turn, scored.best.mon, scored.best.flags)) return {mon: null};
	if (scored.second && (scored.second.flags & wanted) && predictedHitIsSafe(turn, scored.second.mon, scored.second.flags)) {
		return {mon: scored.second.mon};
	}
	return null;
}

// SwitchToBestResistMon: one that resists everything, or one your contact move would faint you on.
function switchToResist(turn, pivot, checkContact) {
	var list = switchInsInOrder(turn);
	for (var i = 0; i < list.length; i++) {
		var mon = list[i].entry.mon;
		if ((list[i].flags & SWITCH_FLAG.RESIST_ALL) ||
			(checkContact && contactKnocksYouOut(turn, mon) && predictedHitWontKO(turn, mon))) return {mon: mon, pivot: pivot};
	}
	return null;
}

// ShouldSwitchIfNaturalCureOrRegenerator.
function switchToHeal(turn) {
	var battle = turn.battle;
	var ai = battle.ai;
	var foe = battle.player;
	var field = battle.field;
	if (ai.ability === "Natural Cure") {
		if (hazardsHurt(ai, 4, field)) return null;
		if (!(isAsleep(ai) || ai.status === "frz" || (ai.status && ai.hp >= Math.floor(ai.maxHP / 2)))) return null;
	} else if (ai.ability === "Regenerator") {
		if (ai.hp > Math.floor(ai.maxHP / 2) || hazardsHurt(ai, 3, field)) return null;
		var predicted = turn.predicted(foe);
		if (!predicted || !knocksOut(turn, foe, ai, foe.moves.indexOf(predicted), 1)) return null;
		var own = turn.aiPrediction;
		if (own && hitsFirst(turn, ai, own, foe) && knocksOut(turn, ai, foe, ai.moves.indexOf(own), 1)) return null;
	} else {
		return null;
	}
	var resist = switchToResist(turn, false, false);
	if (resist) return resist;
	var best = scoreSwitchIns(turn).best;
	if (best && !predictedHitIsSafe(turn, best.mon, best.flags)) {
		if (!predictedHitWontKO(turn, best.mon)) return null;
		if (turn.coin("healHalf", 0.5)) return null;
	}
	return {mon: null};
}

// ShouldSwitchWhileAsleep.
function switchWhileAsleep(turn, justIn) {
	var battle = turn.battle;
	var ai = battle.ai;
	if (justIn || !isAsleep(ai) || !turn.coin("sleepHalf", 0.5)) return null;
	if (stage(ai, "atk") >= 8 || stage(ai, "spa") >= 8 || stage(ai, "spe") >= 8 || stage(ai, "eva") >= 9) {
		if (turn.coin("sleepBoosted", 0.5)) return null;
	}
	if (has(["Shed Skin", "Early Bird"], ai.ability) || (ai.ability === "Hydration" && /Rain/.test(battle.field.weather || "")) ||
		hasEffect(ai, [E.SLEEP_TALK, E.SNORE, E.REST]) ||
		(styleOf(turn, ai) === STYLE.STALL && isTrappedBy(battle.player, ai, battle.field))) return null;
	var best = scoreSwitchIns(turn).best;
	if (best && !predictedHitIsSafe(turn, best.mon, best.flags)) return null;
	return {mon: null};
}

// IsTakingAnnoyingSecondaryDamage: Leech Seed (a quarter of the time).
function switchFromLeechSeed(turn) {
	var battle = turn.battle;
	var ai = battle.ai;
	var foe = battle.player;
	if (ai.ability === "Magic Guard" || canKnockOut(turn, ai, foe) || battle.flags <= AI_NEGATIVES) return null;
	if (!ai.seeded || !turn.coin("seedQuarter", 0.25) || usefulOffenseRaised(ai) || canKnockOut(turn, ai, foe)) return null;
	if (hazardsHurt(ai, 4, battle.field)) return null;
	var scored = scoreSwitchIns(turn);
	var good = function (entry) {
		if (!entry) return false;
		var flags = entry.flags;
		if ((flags & SWITCH_FLAG.OUTSPEEDS) && ((flags & SWITCH_FLAG.KO_FOE) ||
			((flags & SWITCH_FLAG.CAN_2HKO) && !(flags & SWITCH_FLAG.FAINTS))) && predictedHitIsSafe(turn, entry.mon, flags)) return true;
		if (flags & (SWITCH_FLAG.RESIST_ALL | SWITCH_FLAG.WALLS_FOE)) return true;
		return can2HKO(turn, ai, foe);
	};
	if (good(scored.best)) return {mon: scored.best.mon};
	if (good(scored.second)) return {mon: scored.second.mon};
	return null;
}

// ShouldSwitchToAvoidDeath: you would KO it first, and a teammate takes the hit better.
function switchToAvoidDeath(turn, justIn) {
	var battle = turn.battle;
	var ai = battle.ai;
	var foe = battle.player;
	if (justIn || battle.flags <= AI_NEGATIVES) return null;
	var own = turn.aiPrediction;
	var predicted = turn.predicted(foe);
	if (ai.status === "par" && ai.hp < Math.floor(ai.maxHP / 3) && !has(["Quick Feet", "Natural Cure"], ai.ability)) return null;
	// Radical Red: Phoenix Down (revives once at half HP) stays in while its revive is unused.
	if (ai.ability === "Phoenix Down") return null;
	if (/^Aegislash/.test(ai.name) && ai.ability === "Stance Change" && hasMoveNamed(ai, ["King's Shield"]) && predicted &&
		(predicted.flags & FLAG_CONTACT) && hasRealPhysical(foe)) return null;
	if (!predicted || (own && hitsFirst(turn, ai, own, foe))) return null;
	if (!knocksOut(turn, foe, ai, foe.moves.indexOf(predicted), 1) || hazardsHurt(ai, 3, battle.field)) return null;
	var scored = scoreSwitchIns(turn);
	if (healthPercent(ai) <= 20 && !(scored.best && scored.best.score >= SWITCH_SCORE_MAX)) return null;
	var list = switchInsInOrder(turn);
	for (var i = 0; i < list.length; i++) {
		var mon = list[i].entry.mon;
		var flags = list[i].flags;
		var hit = mon.incoming[foe.moves.indexOf(predicted)];
		var immune = predicted.power > 0 && hit && hit.maxDamage === 0;
		if (((flags & (SWITCH_FLAG.OUTSPEEDS | SWITCH_FLAG.WALLS_FOE | SWITCH_FLAG.RESIST_ALL)) && immune) ||
			(((flags & (SWITCH_FLAG.WALLS_FOE | SWITCH_FLAG.RESIST_ALL)) ||
			((flags & SWITCH_FLAG.KO_FOE) && (flags & SWITCH_FLAG.OUTSPEEDS))) && predictedHitIsSafe(turn, mon, flags)) ||
			(contactKnocksYouOut(turn, mon) && predictedHitWontKO(turn, mon))) return {mon: mon};
	}
	return null;
}

// ShouldSwitchWhenOffensiveStatsAreLow: an attacker at -3 or worse in what it attacks with.
function switchFromLowStats(turn, justIn) {
	var battle = turn.battle;
	var ai = battle.ai;
	var foe = battle.player;
	var style = styleOf(turn, ai);
	if (justIn || !isDamager(style)) return null;
	var atk = stage(ai, "atk");
	var spa = stage(ai, "spa");
	var acc = stage(ai, "acc");
	if (!(atk <= OFFENSIVE_STAT_MIN || spa <= OFFENSIVE_STAT_MIN || acc <= OFFENSIVE_STAT_MIN)) return null;
	var physical = false;
	var special = false;
	ai.moves.forEach(function (move, i) {
		if (!move || !isUsable(ai, i, battle.field) || move.power === 0) return;
		if (move.split === SPLIT_PHYSICAL && move.effect !== E.COUNTER && move.name !== "Body Press" && move.name !== "Foul Play") physical = true;
		else if (move.split === SPLIT_SPECIAL && move.effect !== E.MIRROR_COAT) special = true;
	});
	var inaccurate = acc <= OFFENSIVE_STAT_MIN && ai.moves.every(function (move) {
		return !move || move.split === SPLIT_STATUS || move.accuracy === 0 ||
			withStage(accuracyOf(ai, foe, move, battle.field), acc - stage(foe, "eva") + 6) < 70;
	}) && style !== STYLE.STALL;
	if (!((atk <= OFFENSIVE_STAT_MIN && physical && !special) || (spa <= OFFENSIVE_STAT_MIN && special && !physical) ||
		(atk <= OFFENSIVE_STAT_MIN && spa <= OFFENSIVE_STAT_MIN && physical && special) || inaccurate)) return null;
	var pivot = hasPivotMoveThatAffects(turn, ai, foe, true);
	if (canKnockOut(turn, foe, ai) && acc > OFFENSIVE_STAT_MIN) return null;
	var best = scoreSwitchIns(turn).best;
	if (!best) return null;
	if ((best.flags & (SWITCH_FLAG.WALLS_FOE | SWITCH_FLAG.RESIST_ALL)) ||
		((best.flags & SWITCH_FLAG.OUTSPEEDS) && predictedHitIsSafe(turn, best.mon, best.flags))) return {mon: best.mon, pivot: pivot};
	return null;
}

// OffensiveSetupMoveInMoveset (the status moves; the hit-and-boost moves never count, as in CFRU).
function hasOffensiveSetupMove(side) {
	return hasEffect(side, [E.ATTACK_UP, E.SPECIAL_ATTACK_UP, E.EVASION_UP, E.ATTACK_UP_2, E.SPEED_UP_2, E.SPECIAL_ATTACK_UP_2,
		E.EVASION_UP_2, E.ATK_SPATK_UP, E.ATK_ACC_UP, E.BULK_UP, E.CALM_MIND, E.DRAGON_DANCE, E.BELLY_DRUM]);
}

// CanHealFirstToPreventKnockOut.
function canHealBeforeKO(turn, atk, def) {
	var field = turn.battle.field;
	for (var i = 0; i < 4; i++) {
		var move = atk.moves[i];
		if (!move || !isUsable(atk, i, field)) continue;
		if (has([E.RESTORE_HP, E.MORNING_SUN, E.ABSORB, E.DREAM_EATER], move.effect) || (move.effect === E.PROTECT && turn.predicted(def))) {
			var heal = move.effect === E.PROTECT ? 0 : healAmount(atk, def, move, field);
			if (hitsFirst(turn, atk, move, def) && !canKnockOutAfterHealing(turn, def, atk, heal, false)) return true;
		}
	}
	return false;
}

// ShouldSaveSweeperForLater: a sweeper that can't KO steps aside for one that can, or for a wall.
function switchToSaveSweeper(turn, justIn) {
	var battle = turn.battle;
	var ai = battle.ai;
	var foe = battle.player;
	var field = battle.field;
	if (justIn || battle.flags <= AI_NEGATIVES || ai.status === "frz") return null;
	if (ai.status === "par" && !has(["Quick Feet", "Guts"], ai.ability)) return null;
	if (!isDamager(styleOf(turn, ai))) return null;
	var predicted = turn.predicted(foe);
	var fakeOutHurts = predicted && predicted.name === "Fake Out" && !has(["Inner Focus", "Shield Dust"], ai.ability) &&
		ai.item !== "Covert Cloak" && finalDamage(turn, foe, ai, foe.moves.indexOf(predicted), 1) >= Math.floor(ai.maxHP / 2);
	if (canKnockOut(turn, ai, foe) && !fakeOutHurts) return null;
	if (hazardsHurt(ai, 4, field)) return null;
	var trappingFoe = isTrappedBy(foe, ai, field) && secondaryDamage(foe, field) > 0;
	if (trappingFoe) return null;
	var willDie = canKnockOut(turn, foe, ai) && !canHealBeforeKO(turn, ai, foe);
	var reason = willDie;
	if (!reason && !usefulOffenseRaised(ai) && stage(ai, "eva") < 9 && !hasOffensiveSetupMove(ai)) {
		var scored = scoreSwitchIns(turn);
		if (switchInFlags(scored.best) & SWITCH_FLAG.KO_FOE) {
			reason = true;
		} else if (turn.coin("sweeperHalf", 0.5) && (!can2HKO(turn, ai, foe) || turn.coin("sweeperAnyway", 0.5)) &&
			!resistsAllMoves(turn, foe, ai)) {
			var strongest = ai.moves[strongestMove(turn, ai, foe)];
			reason = !(strongest && (strongest.effect === E.ABSORB || strongest.effect === E.DREAM_EATER));
		}
	}
	if (!reason) return null;
	var own = turn.aiPrediction;
	if (own && ((own.name === "Fake Out" && !has(["Inner Focus", "Shield Dust"], foe.ability)) || own.effect === E.PROTECT)) return null;
	var pivot = hasPivotMoveThatAffects(turn, ai, foe, true);
	if (canKnockOut(turn, foe, ai)) {
		if (own && hitsFirst(turn, ai, own, foe) && own.effect === E.DESTINY_BOND) return null;
		var list = [scoreSwitchIns(turn).best, scoreSwitchIns(turn).second];
		for (var i = 0; i < list.length; i++) {
			var entry = list[i];
			if (!entry) continue;
			var flags = entry.flags;
			var wanted = SWITCH_FLAG.OUTSPEEDS | SWITCH_FLAG.KO_FOE;
			if (((flags & wanted) === wanted && predictedHitIsSafe(turn, entry.mon, flags)) ||
				(contactKnocksYouOut(turn, entry.mon) && predictedHitWontKO(turn, entry.mon))) return {mon: entry.mon, pivot: pivot};
		}
	}
	return switchToResist(turn, pivot, true);
}

/*
 * ShouldSwitch's checks for the Pokémon on the field, in order; the first that says so decides.
 * `justSwitchedIn`: it came in this turn (after a KO or a switch), when most of them wait a turn.
 * Not modelled (the calculator doesn't know them): passing a Wish, Perish Song, a Yawn, your Fly or
 * Dig in progress, a Choice lock, Toxic's turn count.
 */
function switchChecks(turn) {
	var battle = turn.battle;
	var justIn = battle.justSwitchedIn;
	var decide = function (check) {
		return function () {
			if (isTrappedBy(battle.ai, battle.player, battle.field)) return null;
			var decision = check();
			if (decision && !decision.mon) {
				var best = scoreSwitchIns(turn).best;
				decision.mon = best ? best.mon : battle.party[0];
			}
			return decision;
		};
	};
	return [
		decide(function () {
			return switchToAbsorb(turn, justIn);
		}), decide(function () {
			return switchForWonderGuard(turn);
		}), decide(function () {
			return switchFromBadMoves(turn, justIn);
		}), decide(function () {
			return switchToHeal(turn);
		}), decide(function () {
			return switchWhileAsleep(turn, justIn);
		}), decide(function () {
			return switchFromLeechSeed(turn);
		}), decide(function () {
			return switchToAvoidDeath(turn, justIn);
		}), decide(function () {
			return switchFromLowStats(turn, justIn);
		}), decide(function () {
			return switchToSaveSweeper(turn, justIn);
		})
	];
}

// The AI's own move as PredictMovesForBanks has it (smart flags; under 100 means it would switch).
function predictAISelf(turn) {
	var battle = turn.battle;
	var ai = battle.ai;
	turn.phase = "p";
	turn.cache = {};
	var index = null;
	if (!(isAsleep(ai) && !hasEffect(ai, [E.SLEEP_TALK, E.SNORE])) && ai.hp > 0) {
		var values = runScripts(turn, ai, battle.player, AI_SMART_FLAGS, false);
		var best = Math.max.apply(null, values);
		if (best >= 100) {
			var ties = [];
			values.forEach(function (value, i) {
				if (value === best && ai.moves[i]) ties.push(i);
			});
			index = ties.length === 1 ? ties[0] : ties[turn.rng.pick(ties.map(function () {
				return 1 / ties.length;
			}))];
		}
	}
	turn.aiPrediction = index === null ? null : ai.moves[index];
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

// Why the AI switches, in ShouldSwitch's order (for the Battle tab's tooltip).
var SWITCH_REASONS = ["to take your move with its ability", "against your Wonder Guard", "because its moves are no good here",
	"to heal with its ability", "because it is asleep", "because of Leech Seed", "to avoid being knocked out",
	"because its attacking stat is down", "to save it for later"];

/*
 * The chance (0-1) the AI picks each of `battle.ai`'s four moves, and of each switch.
 * battle: {ai: side, player: side, field: calc Field (AI's view), trickRoom, flags,
 *          party: the AI's benched sides (with .slot), justSwitchedIn}
 * Returns {shares: [4 moves], switches: [{mon, share, reasons: {index: share}}], switchShare}.
 */
function predictAIMoves(battle) {
	var party = battle.party || [];
	var reasons = SWITCH_REASONS.length;
	var outcomes = enumerateChances(function (rng) {
		var turn = new AITurn(rng, megaPhaseBattle(battle, false));
		var outcome = [0, 0, 0, 0];
		predictPlayer(turn);
		if (party.length) {
			predictAISelf(turn);
			turn.phase = "w";
			turn.cache = {};
			turn.prediction[battle.ai.key] = turn.aiPrediction ? turn.battle.ai.moves.indexOf(turn.aiPrediction) : null;
			var decision = null;
			var reason = -1;
			// Radical Red: on a quarter of its turns the AI doesn't think about switching at all.
			var checks = isTrappedBy(battle.ai, battle.player, battle.field) || turn.coin("noSwitchCheck", 0.25) ? [] : switchChecks(turn);
			for (var c = 0; c < checks.length && !decision; c++) {
				decision = checks[c]();
				reason = c;
			}
			turn.prediction[battle.ai.key] = null;
			if (decision && !decision.pivot) {
				outcome[4 + party.indexOf(decision.mon) * reasons + reason] = 1;
				return outcome;
			}
			if (decision) turn.goodToPivot = true;
		}
		turn.phase = "a";
		turn.cache = {};
		turn.battle = megaPhaseBattle(battle, true);
		var shares = chooseShares(runScripts(turn, turn.battle.ai, turn.battle.player, battle.flags, true), battle.ai.moves);
		for (var i = 0; i < 4; i++) outcome[i] = shares[i];
		return outcome;
	}, 20000);
	var switches = party.map(function (mon, p) {
		var entry = {mon: mon, share: 0, reasons: {}};
		for (var r = 0; r < reasons; r++) {
			var share = outcomes[4 + p * reasons + r] || 0;
			if (share > 0) {
				entry.share += share;
				entry.reasons[r] = share;
			}
		}
		return entry;
	}).filter(function (entry) {
		return entry.share > 0;
	}).sort(function (a, b) {
		return b.share - a.share;
	});
	return {
		shares: [0, 1, 2, 3].map(function (i) {
			return outcomes[i] || 0;
		}),
		switches: switches,
		switchShare: switches.reduce(function (sum, entry) {
			return sum + entry.share;
		}, 0)
	};
}

// Who the AI sends out next if you KO its Pokémon now: the best switch-in against yours.
function predictReplacement(battle) {
	var party = battle.party || [];
	if (!party.length) return [];
	var outcomes = enumerateChances(function (rng) {
		var turn = new AITurn(rng, battle);
		var outcome = [];
		var best = scoreSwitchIns(turn).best;
		outcome[party.indexOf(best ? best.mon : party[0])] = 1;
		for (var i = 0; i < party.length; i++) outcome[i] = outcome[i] || 0;
		return outcome;
	}, 5000);
	return party.map(function (mon, i) {
		return {mon: mon, share: outcomes[i] || 0};
	}).filter(function (entry) {
		return entry.share > 0;
	}).sort(function (a, b) {
		return b.share - a.share;
	});
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
		gender: pokemon.gender || "",
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

// Radical Red's GetAIFlags gives every trainer battle the smart flags (7); the AI flags stored with each
// trainer (most have 1) are never read.
function getAIFlags() {
	return AI_SMART_FLAGS;
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

// The highest crit roll of a calculation (for moves with a 50% crit chance).
function maxCritRoll(result) {
	try {
		var move = result.move.clone();
		move.isCrit = true;
		return calc.calculate(gen, result.attacker, result.defender, move, result.field).range()[1];
	} catch (e) {
		return result.range()[1];
	}
}

/*
 * The trainer's other Pokémon still standing (not KO'd, not the one on the field), at full HP,
 * each against yours and yours against each. None in double battles, which aren't modelled.
 */
function readAIParty(p1, playerField, aiField, options) {
	if (typeof TRAINER_ORDER === "undefined" || typeof getTrainerVariant !== "function" || typeof activeTrainerSlot !== "number") return [];
	var trainer = TRAINER_ORDER[currentTrainerIndex];
	if (!trainer || /Doubles/i.test(typeof currentBattleEffect === "string" ? currentBattleEffect : "")) return [];
	var kos = typeof getKOSlots === "function" ? getKOSlots(currentTrainerIndex) : [];
	var party = [];
	getTrainerVariant(trainer).sets.forEach(function (setId, slot) {
		if (slot === activeTrainerSlot || kos.indexOf(slot) !== -1) return;
		var pokemon;
		try {
			pokemon = createPokemon(setId);
			// A benched Mega hasn't Mega Evolved: the game scores it in its base form.
			if (/-Mega/.test(pokemon.name)) {
				var baseName = pokemon.name.split("-Mega")[0];
				var variant = getTrainerVariant(trainer);
				pokemon = new calc.Pokemon(gen, baseName, {level: pokemon.level, gender: pokemon.gender, nature: pokemon.nature,
					item: pokemon.item, evs: pokemon.evs, ivs: pokemon.ivs, moves: pokemon.moves, abilityOn: true,
					ability: (variant.preMega && variant.preMega[slot]) || pokedex[baseName].abilities[0]});
			}
		} catch (e) {
			return;
		}
		var out = [];
		var incoming = [];
		for (var m = 0; m < 4; m++) {
			out[m] = calc.calculate(gen, pokemon, p1, pokemon.moves[m], aiField);
			incoming[m] = calc.calculate(gen, p1, pokemon, p1.moves[m], playerField);
		}
		var mon = out[0].attacker;
		var side = buildAISide("b" + slot, mon, out, p1, {
			speed: getBattleSpeed(mon, "p2"), monsLeft: options.monsLeft, firstTurn: true, sideState: options.sideState,
			critChance: function (move) {
				return typeof getCritChance === "function" ? getCritChance(mon, p1, move, false) || 0 : 0;
			},
			critDamage: function (i) {
				return maxCritRoll(out[i]);
			}
		});
		side.slot = slot;
		side.setId = setId;
		side.incoming = incoming.map(function (result) {
			var move = result.move;
			if (!move || !move.name || move.name === "(No Move)") return null;
			var crit = typeof getCritChance === "function" ? getCritChance(p1, mon, move, options.playerFocus) || 0 : 0;
			var max = result.range()[1];
			return {
				maxDamage: max,
				maxCritDamage: crit >= 0.5 && crit < 1 ? maxCritRoll(result) : max,
				critChance: crit,
				effectiveness: typeEffectiveness(move.type, side.types)
			};
		});
		party.push(side);
	});
	return party;
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
	var party = readAIParty(p1, damageResults[0][0].field, field,
		{monsLeft: ai.monsLeft, sideState: ai.sideState, playerFocus: focus.p1});
	// It came in this turn, after a KO or a switch (the lead at full HP did not): the switching
	// checks wait a turn.
	var kos = typeof getKOSlots === "function" && typeof TRAINER_ORDER !== "undefined" ? getKOSlots(currentTrainerIndex) : [];
	var justSwitchedIn = ai.firstTurn && (kos.length > 0 || (typeof activeTrainerSlot === "number" && activeTrainerSlot !== 0));
	var battle = {ai: ai, player: player, field: field, trickRoom: $("#trickroom").prop("checked"), flags: getAIFlags(),
		party: party, justSwitchedIn: justSwitchedIn};
	battle.mega = readPendingMega(p1, p2, field, damageResults[0][0].field, {ai: ai, player: player, focus: focus});
	return battle;
}

/*
 * A boss shown in its base form ("Base form" on the trainer panel) Mega Evolves when it moves this
 * turn. Radical Red decides whether to switch, predicts both moves and works out every damage number
 * as if it were already the Mega, but scores its move with the base form's speed, priority, ability and
 * types (CFRU master uses the Mega throughout). {ai, player}: the Mega and you against it.
 */
function readPendingMega(p1, p2, aiField, playerField, base) {
	if (typeof showingMegaBase === "undefined" || !showingMegaBase || typeof getActiveTrainerSet !== "function") return null;
	var mega;
	try {
		mega = createPokemon(getActiveTrainerSet());
	} catch (e) {
		return null;
	}
	if (!/-Mega/.test(mega.name)) return null;
	mega.originalCurHP = p2.curHP();
	mega.status = p2.status;
	mega.boosts = $.extend({}, p2.boosts);
	var out = [];
	var incoming = [];
	for (var m = 0; m < 4; m++) {
		out[m] = calc.calculate(gen, mega, p1, mega.moves[m], aiField);
		incoming[m] = calc.calculate(gen, p1, mega, p1.moves[m], playerField);
	}
	var crit = function (attacker, defender, focus) {
		return function (move) {
			return typeof getCritChance === "function" ? getCritChance(attacker, defender, move, focus) || 0 : 0;
		};
	};
	var megaSide = out[0].attacker;
	return {
		ai: buildAISide("p2", megaSide, out, p1, {speed: getBattleSpeed(megaSide, "p2"), monsLeft: base.ai.monsLeft,
			firstTurn: base.ai.firstTurn, sideState: base.ai.sideState, focusEnergy: base.focus.p2, critChance: crit(megaSide, p1, base.focus.p2),
			critDamage: function (i) {
				return maxCritRoll(out[i]);
			}}),
		player: buildAISide("p1", incoming[0].attacker, incoming, megaSide, {speed: base.player.speed, monsLeft: base.player.monsLeft,
			firstTurn: base.player.firstTurn, sideState: base.player.sideState, focusEnergy: base.focus.p1,
			critChance: crit(p1, megaSide, base.focus.p1), critDamage: function (i) {
				return maxCritRoll(incoming[i]);
			}})
	};
}

// The battle as each thinking phase sees it: everything but the move choice sees the pending Mega; the
// move choice keeps the base form but with the Mega's damage numbers.
function megaPhaseBattle(battle, choosing) {
	if (!battle.mega) return battle;
	var view = $.extend({}, battle, {player: battle.mega.player, ai: battle.mega.ai});
	if (choosing) {
		view.ai = $.extend({}, battle.ai, {moves: battle.ai.moves.map(function (move, i) {
			var megaMove = battle.mega.ai.moves[i];
			return move && megaMove ? $.extend({}, move, {maxDamage: megaMove.maxDamage, maxCritDamage: megaMove.maxCritDamage}) : move;
		})});
	}
	return view;
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
	if (!battle) {
		renderAISwitch(null);
		return;
	}
	var prediction = predictAIMoves(battle);
	var shares = prediction.shares;
	renderAISwitch(battle, prediction);
	var best = Math.max.apply(null, shares.concat(prediction.switches.map(function (entry) {
		return entry.share;
	})));
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

function shortMonName(mon) {
	return (mon.name || "").replace(/-Mega.*$/, "");
}

// Under the foe's moves: its chance of switching out and to whom (with why), and who it sends out
// next if you KO it now.
function renderAISwitch(battle, prediction) {
	var box = $("#ai-switch");
	if (!box.length) box = $('<div id="ai-switch" class="ai-switch" aria-live="polite"></div>');
	// Small screens: in the foe's header (Battle has to fit the screen); otherwise under its moves.
	if ($("html").hasClass("small-screen")) box.appendTo($("#resultHeaderR").closest(".result-move-header"));
	else box.appendTo($('label[for="resultMoveR4"]').closest(".move-result-subgroup"));
	box.empty().removeAttr("title");
	if (!battle || !battle.party || !battle.party.length) {
		box.hide();
		return;
	}
	var lines = [];
	if (prediction.switchShare > 0) {
		var why = [];
		var line = $('<div class="ai-switch-out"></div>')
			.append($("<b></b>").text("Switches " + formatAIShare(prediction.switchShare)), " \u2192 ",
				document.createTextNode(prediction.switches.map(function (entry) {
					Object.keys(entry.reasons).forEach(function (r) {
						var text = SWITCH_REASONS[r];
						if (why.indexOf(text) === -1) why.push(text);
					});
					return shortMonName(entry.mon) + (prediction.switches.length > 1 ? " " + formatAIShare(entry.share) : "");
				}).join(" \u00b7 ")));
		line.attr("title", "The trainer's AI switches out " + why.join(", or ") + ".");
		lines.push(line);
	}
	var next = predictReplacement(battle);
	if (next.length) {
		lines.push($('<div class="ai-switch-next"></div>').text("Next \u2192 " + next.map(function (entry) {
			return shortMonName(entry.mon) + (next.length > 1 ? " " + formatAIShare(entry.share) : "");
		}).join(" \u00b7 ")).attr("title", "The Pok\u00e9mon the trainer sends out next if you knock this one out now"));
	}
	box.append(lines).toggle(lines.length > 0).attr("title", lines.map(function (line) {
		return line.attr("title") ? line.text() + ": " + line.attr("title") : line.text();
	}).join("\n"));
}
