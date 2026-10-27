/*
 * Opposing trainer navigation, modelled on syl-rnb-calc. Previous / Next Trainer step
 * through this mode's boss fights in game order (TRAINER_ORDER, generated from the boss
 * documents by import/radical-red-trainers), showing each trainer's team under Pokémon 2
 * and loading its first Pokémon there. The Professor Oak button starts a new run: after you
 * confirm your run is over, it wipes this mode's box and goes back to the first trainer.
 * The current trainer is remembered per mode.
 */

// FireRed / LeafGreen's Professor Oak, from Smogon's sprite archive.
var OAK_SPRITE_URL = "https://raw.githubusercontent.com/smogon/sprites/master/src/_uncategorized/canonical/trainers/gen3/firered-leafgreen/Oak.png";
// Other fights with several possible teams (Lorelei's rain or snow team) remember the
// chosen team by its label.
var TRAINER_VARIANT_KEY = "trainerVariant";
// The rival's team depends on your starter's type (whichever region it is from): he picks
// the Kanto starter that counters it. Kept per
// mode, like the box: Normal and Hardcore are separate runs. Importing a .sav sets it from
// the save and locks it until Professor Oak starts a new run.
var STARTER_KEY = "starterType";
var STARTER_FROM_SAVE_KEY = "starterFromSave";
var STARTER_TYPES = ["Fire", "Water", "Grass"];
var RIVAL_TEAM_FOR_STARTER = {Fire: "Rival Has Squirtle", Water: "Rival Has Bulbasaur", Grass: "Rival Has Charmander"};

function getTrainerIndexKey() {
	return "trainerIndex:" + getPageMode();
}

var currentTrainerIndex = 0;
var currentBattleEffect = "";
// The Field controls the current fight's battle effect has set and locked.
var lockedFieldInputs = $();

/*
 * How a boss's battle effect ("Doubles + Permanent rain") maps onto the Field panel. The
 * first matching weather and terrain win; Pokémon 2 is the boss's side, so side-specific
 * effects use the right-hand ("R") toggles. These hold for the whole fight, so the controls
 * are locked until you move to another trainer. Effects the panel cannot show (pre-burned
 * Pokémon, special rules) stay as text only.
 */
var EFFECT_WEATHER = [
	{pattern: /primordial sea/i, id: "heavy-rain"},
	{pattern: /desolate land/i, id: "harsh-sunshine"},
	{pattern: /delta stream|strong winds/i, id: "strong-winds"},
	{pattern: /permanent rain/i, id: "rain"},
	{pattern: /permanent sun/i, id: "sun"},
	{pattern: /permanent sandstorm/i, id: "sand"},
	{pattern: /permanent snow/i, id: "snow"},
	{pattern: /permanent hail/i, id: "hail"}
];
var EFFECT_TERRAIN = [
	{pattern: /electric terrain/i, id: "electric"},
	{pattern: /grassy terrain/i, id: "grassy"},
	{pattern: /misty terrain/i, id: "misty"},
	{pattern: /psychic terrain/i, id: "psychic"}
];
var EFFECT_TOGGLES = [
	{pattern: /tailwind/i, id: "tailwindR"},
	{pattern: /omni-boosted/i, id: "StatBoostR"},
	{pattern: /magic room/i, id: "magicroom"},
	{pattern: /wonder room/i, id: "wonderroom"},
	{pattern: /gravity/i, id: "gravity"},
	{pattern: /trick room/i, id: "trickroom"}
];

function firstMatch(effects, text) {
	return effects.filter(function (effect) {
		return effect.pattern.test(text);
	})[0];
}

function lockFieldInputs(inputs) {
	lockedFieldInputs = lockedFieldInputs.add(inputs.prop("disabled", true));
}

// Undoes the previous fight's battle effect: unlocks its controls and turns off what it set.
// Field settings you chose yourself are left alone.
function releaseBattleEffect() {
	var locked = lockedFieldInputs.prop("disabled", false);
	var hadWeather = lockedField.weather;
	var hadTerrain = lockedField.terrain;
	lockedFieldInputs = $();
	lockedField.weather = false;
	lockedField.terrain = false;
	battleSpeedMultiplier.p1 = 1;
	$("#battle-effect-lock").hide();
	if (locked.is("#doubles-format")) $("#singles-format").prop("checked", true).change();
	if (hadWeather) $("#clear").prop("checked", true).change();
	if (hadTerrain) $("input:checkbox[name='terrain']").prop("checked", false).first().change();
	EFFECT_TOGGLES.forEach(function (effect) {
		if (locked.is("#" + effect.id)) $("#" + effect.id).prop("checked", false).change();
	});
	// Your Pokémon's own weather or terrain ability (e.g. Drizzle) applies again.
	if (hadWeather || hadTerrain) $("#p1 .ability").change();
}

// Sets the Field panel to the boss's battle effect and locks it for the fight.
function applyBattleEffect(text, trainerName) {
	text = text || "";
	if (/doubles/i.test(text)) lockFieldInputs($("#doubles-format").prop("checked", true).change().add("#singles-format"));
	var weather = firstMatch(EFFECT_WEATHER, text);
	if (weather) {
		$("#" + weather.id).prop("checked", true).change();
		lockFieldInputs($("input:radio[name='weather']"));
		lockedField.weather = true;
	}
	var terrain = firstMatch(EFFECT_TERRAIN, text);
	if (terrain) {
		// Terrain boxes are mutually exclusive: the change event must come from the one ticked.
		$("input:checkbox[name='terrain']").prop("checked", false);
		$("#" + terrain.id).prop("checked", true).change();
		lockFieldInputs($("input:checkbox[name='terrain']"));
		lockedField.terrain = true;
	}
	EFFECT_TOGGLES.forEach(function (effect) {
		if (effect.pattern.test(text)) lockFieldInputs($("#" + effect.id).prop("checked", true).change());
	});
	// "Permanent swamp (player's Pokémon speed stat is quartered)" (Brendan on Route 23).
	if (/swamp/i.test(text)) battleSpeedMultiplier.p1 = 0.25;
	if (lockedFieldInputs.length || battleSpeedMultiplier.p1 !== 1) {
		$("#battle-effect-lock").text("\uD83D\uDD12 Locked by " + trainerName + "'s battle effect: " + text +
			(battleSpeedMultiplier.p1 !== 1 ? ". Pok\u00e9mon 1's Speed is shown quartered." : "")).show();
	}
}

function getStarterKey() {
	return STARTER_KEY + ":" + getPageMode();
}

function getStarterType() {
	// Before starters were kept per mode there was one setting for both.
	var starter = readSetting(getStarterKey()) || readSetting(STARTER_KEY);
	return STARTER_TYPES.indexOf(starter) === -1 ? STARTER_TYPES[0] : starter;
}

function isStarterFromSave() {
	return readSetting(STARTER_FROM_SAVE_KEY + ":" + getPageMode()) === "true";
}

function updateStarterSelect() {
	var locked = isStarterFromSave();
	$("#trainer-starter")
		.val(getStarterType())
		.prop("disabled", locked)
		.attr("title", locked ?
			"From your save: you chose a " + getStarterType() + "-type starter. Start a new run with Professor Oak to change it." :
			"Your starter's type, from any region. The rival picks a starter strong against it.");
	$("#trainer-starter-lock").toggle(locked);
}

function setStarter(type, fromSave) {
	writeSetting(getStarterKey(), type);
	writeSetting(STARTER_FROM_SAVE_KEY + ":" + getPageMode(), !!fromSave);
	// A save imported while the page loads (after switching modes) arrives before the panel exists.
	if (!$("#trainer-starter").length) return;
	updateStarterSelect();
	showTrainer(currentTrainerIndex);
}

$(document).on("save:imported", function (event, save) {
	recordSaveProgress(save);
	markBeatenFights(save.beatenTrainers);
	if (save.starter) setStarter(save.starter, true);
	else if ($("#trainer-starter").length) showTrainer(currentTrainerIndex);
});

// Marking fights KO'd or Defeated, or changing your Team, can change the cap and levels shown.
$(document).on("trainer:progress customsets:changed box:rendered", function () {
	if (!$("#trainer-details").length) return;
	var trainer = TRAINER_ORDER[currentTrainerIndex];
	applyRelativeLevels(currentTrainerIndex, getTrainerVariant(trainer));
	$("#trainer-details").text(describeTrainer(trainer, currentTrainerIndex));
	$("#trainer-skip-label").toggle(canSkipFight(currentTrainerIndex));
});

/*
 * Many trainers' Pokémon have no fixed level: the game sets it from your highest-level party
 * Pokémon ("Highest Lv -3" in the boss documents, `levelBelowHighest` in the trainer data). Each
 * .sav import records that level and your badges, so those levels follow your party, and the
 * level cap shown is at least the one your badges give (fights you can do before a gym, like the
 * ones around Cerulean, are listed under the earlier cap). Without a save the document's levels
 * are kept.
 */
var PLAYER_HIGHEST_LEVEL_KEY = "playerHighestLevel";
var SAVE_BADGES_KEY = "saveBadges";
// The gyms in the order the boss documents raise the level cap (Sabrina before Koga; Clair leads
// the Viridian gym).
var LEVEL_CAP_LEADERS = ["Brock", "Misty", "Lt. Surge", "Erika", "Sabrina", "Koga", "Blaine", "Clair"];

function recordSaveProgress(save) {
	writeSetting(PLAYER_HIGHEST_LEVEL_KEY + ":" + getPageMode(), getHighestPartyLevel(save));
	writeSetting(SAVE_BADGES_KEY + ":" + getPageMode(), save.badges || 0);
}

// Your highest level: the highest-level Pokémon in your Team (from a .sav, or made or edited by
// hand), else the last save's party.
function getPlayerHighestLevel() {
	var highest = 0;
	if (typeof resolveBoxLayout === "function") {
		var sets = readCustomSets();
		resolveBoxLayout(sets, readBoxLayout()).team.forEach(function (id) {
			var split = id.indexOf(" (");
			var set = split !== -1 && sets[id.slice(0, split)] && sets[id.slice(0, split)][id.slice(split + 2, -1)];
			if (set && set.level > highest) highest = set.level;
		});
	}
	return highest || parseInt(readSetting(PLAYER_HIGHEST_LEVEL_KEY + ":" + getPageMode())) || 0;
}

$(document).on("run:new", function () {
	writeSetting(PLAYER_HIGHEST_LEVEL_KEY + ":" + getPageMode(), "");
	writeSetting(SAVE_BADGES_KEY + ":" + getPageMode(), "");
	writeSetting(SKIPPED_FIGHTS_KEY + ":" + getPageMode(), "");
});

// Fights the save says you have won (the game's trainer flags) are marked Defeated, with the team
// you beat: Bugsy's before or after Lt. Surge, Jasmine's or Pryce's random one, the rival's.
function markBeatenFights(beaten) {
	if (!beaten || !beaten.length || typeof readTrainerKOs !== "function") return;
	var kos = readTrainerKOs();
	var marked = false;
	TRAINER_ORDER.forEach(function (trainer, index) {
		trainer.variants.forEach(function (variant) {
			if (!variant.trainerIds || !variant.trainerIds.every(function (id) {
				return beaten.indexOf(id) !== -1;
			}) || isVariantDefeated(index, variant, kos)) return;
			kos[getVariantKey(index, variant)] = variant.sets.map(function (set, slot) {
				return slot;
			});
			marked = true;
		});
	});
	if (marked) writeTrainerKOs(kos);
}

/*
 * The level a team's Pokémon follow (the game takes your highest-level party Pokémon when you
 * fight) and where it comes from: once beaten, what it was then ("beaten"); a fight still ahead of
 * your progress, its own cap, since you will be at it by then ("cap"); otherwise your save's
 * highest ("save") or, without a save, the cap you are at now from your badges or the gyms marked
 * Defeated ("cap"). So a fight left for later (Bugsy after Lt. Surge) comes at the higher level.
 */
function getTeamLevelBasis(index, variant) {
	if (typeof isVariantDefeated === "function" && isVariantDefeated(index, variant)) {
		return {level: getDefeatLevel(index, variant), from: "beaten"};
	}
	var trainer = TRAINER_ORDER[index];
	var arcCaps = typeof getArcCaps === "function" ? getArcCaps() : [];
	var listed = parseInt(trainer.levelCap) || arcCaps[index] || 0;
	// The cap you are at: your badges' (or gyms marked Defeated), raised by your save's highest level
	// (story fights raise it between gyms too, 22 to 27 around Mt. Moon).
	var highest = getPlayerHighestLevel();
	var current = Math.max(getProgressLevelCap() || arcCaps[0] || 0, highest);
	if (isFightSkipped(index)) current = Math.max(current, trainer.parallel.capAfter);
	if (listed > current) return {level: listed, from: "cap"};
	return highest ? {level: highest, from: "save"} : {level: current, from: "cap"};
}

function getTeamHighestLevel(index, variant) {
	return getTeamLevelBasis(index, variant).level;
}

// Sets the level of each team Pokémon whose level follows yours; the others keep the document's.
function applyRelativeLevels(index, variant) {
	var highest = getTeamHighestLevel(index, variant);
	variant.sets.forEach(function (setId, slot) {
		var species = setId.substring(0, setId.indexOf(" ("));
		var set = setdex[species] && setdex[species][setId.substring(setId.indexOf("(") + 1, setId.lastIndexOf(")"))];
		if (!set) return;
		if (set.documentLevel === undefined) set.documentLevel = set.level;
		var below = variant.levelBelowHighest ? variant.levelBelowHighest[slot] : null;
		set.level = highest && typeof below === "number" ? Math.max(1, Math.min(100, highest - below)) : set.documentLevel;
	});
}

// A fight by its trainer's name (a gym leader's gym; rematches are named "Misty (Rematch)").
function findFight(name) {
	for (var i = 0; i < TRAINER_ORDER.length; i++) {
		if (TRAINER_ORDER[i].name === name) return i;
	}
	return -1;
}

// How many gyms you have beaten, in LEVEL_CAP_LEADERS order: the save's badges, or as far as the
// gym fights marked Defeated go.
function countGymsBeaten() {
	var gyms = parseInt(readSetting(SAVE_BADGES_KEY + ":" + getPageMode())) || 0;
	if (typeof isTrainerDefeated === "function") {
		LEVEL_CAP_LEADERS.forEach(function (name, k) {
			var at = findFight(name);
			if (at !== -1 && isTrainerDefeated(at)) gyms = Math.max(gyms, k + 1);
		});
	}
	return Math.min(gyms, LEVEL_CAP_LEADERS.length);
}

function isGymBeaten(name) {
	return countGymsBeaten() > LEVEL_CAP_LEADERS.indexOf(name);
}

// The cap after your last gym: the next higher cap of a required fight after it.
/*
 * The fights that raise the level cap and the cap after each: the last required fight at a cap
 * before a required fight with a higher one (gyms, and story fights between them: Archer at Mt.
 * Moon, the first Giovanni, Ariana & Archer at Silph...). Optional and before-or-after fights don't.
 */
var capRaisers = null;

function getCapRaisers() {
	if (capRaisers) return capRaisers;
	capRaisers = [];
	var last = -1;
	TRAINER_ORDER.forEach(function (trainer, index) {
		var cap = parseInt(trainer.levelCap) || 0;
		if (trainer.optional || trainer.parallel || trainer.duplicate || !cap) return;
		if (last !== -1 && cap > (parseInt(TRAINER_ORDER[last].levelCap) || 0)) capRaisers.push({index: last, capAfter: cap});
		last = index;
	});
	return capRaisers;
}

// The cap after your badges: the next higher cap of a required fight after your last gym leader.
function getBadgeLevelCap() {
	var gyms = countGymsBeaten();
	var at = gyms ? findFight(LEVEL_CAP_LEADERS[gyms - 1]) : -1;
	if (at === -1) return 0;
	var cap = parseInt(TRAINER_ORDER[at].levelCap) || 0;
	for (var i = at + 1; i < TRAINER_ORDER.length; i++) {
		var next = parseInt(TRAINER_ORDER[i].levelCap) || 0;
		if (!TRAINER_ORDER[i].optional && next > cap) return next;
	}
	return cap;
}

// The cap you are at: after the furthest cap-raising fight you have beaten (marked Defeated, or
// won in your save), or what your badges give.
function getProgressLevelCap() {
	var cap = getBadgeLevelCap();
	if (typeof isTrainerDefeated === "function") {
		getCapRaisers().forEach(function (raiser) {
			if (raiser.capAfter > cap && isTrainerDefeated(raiser.index)) cap = raiser.capAfter;
		});
	}
	return cap;
}

/*
 * Fights you can do before or after a gym (`parallel`: Nugget Bridge, the Dig House and the S.S.
 * Anne around Misty; Route 9 to the Celadon gym around Lt. Surge; the rematches around Sabrina).
 * "Skip for now" moves one after the last fight of its group, so Previous / Next take you there
 * later, and it shows the cap after the gym.
 */
var SKIPPED_FIGHTS_KEY = "skippedFights";

function readSkippedFights() {
	try {
		return JSON.parse(readSetting(SKIPPED_FIGHTS_KEY + ":" + getPageMode())) || [];
	} catch (e) {
		return [];
	}
}

// A beaten fight is no longer left for later: it goes back to its place.
function isBeatenFight(index) {
	return typeof isTrainerDefeated === "function" && isTrainerDefeated(index);
}

function canSkipFight(index) {
	return !!TRAINER_ORDER[index].parallel && !isBeatenFight(index);
}

function isFightSkipped(index) {
	return canSkipFight(index) && readSkippedFights().indexOf(index) !== -1;
}

function setFightSkipped(index, skipped) {
	var list = readSkippedFights().filter(function (i) {
		return i !== index;
	});
	if (skipped) list.push(index);
	writeSetting(SKIPPED_FIGHTS_KEY + ":" + getPageMode(), JSON.stringify(list));
	showTrainer(index);
}

// The last fight of each group: its gym or the last fight that can be done around it.
function getParallelGroupEnds() {
	var ends = {};
	TRAINER_ORDER.forEach(function (trainer, index) {
		if (!trainer.parallel) return;
		var gate = trainer.parallel.gate;
		ends[gate] = Math.max(ends[gate] === undefined ? findFight(gate) : ends[gate], index);
	});
	return ends;
}

// Route trainers in Previous / Next (all of them, or only the one you are on).
var ROUTE_TRAINERS_KEY = "routeTrainers";

function areRouteTrainersShown() {
	return readSetting(ROUTE_TRAINERS_KEY) !== "false";
}

/*
 * The order Previous and Next follow: the document's, with skipped fights after their group and
 * route trainers before the boss fight they lead up to (`all`: every route trainer, shown or not).
 */
function getTrainerNavOrder(all) {
	var ends = getParallelGroupEnds();
	var waiting = {};
	var order = [];
	var routes = {};
	var showRoutes = all || areRouteTrainersShown();
	var skipped = readSkippedFights();
	TRAINER_ORDER.forEach(function (trainer, index) {
		if (!trainer.route || !(showRoutes || index === currentTrainerIndex)) return;
		var before = trainer.route.before === null ? "end" : trainer.route.before;
		(routes[before] = routes[before] || []).push(index);
	});
	// Those before the same fight, a place at a time (Route 6's, then the S.S. Anne's).
	Object.keys(routes).forEach(function (before) {
		var places = [];
		routes[before].forEach(function (index) {
			if (places.indexOf(TRAINER_ORDER[index].location) === -1) places.push(TRAINER_ORDER[index].location);
		});
		routes[before].sort(function (a, b) {
			return places.indexOf(TRAINER_ORDER[a].location) - places.indexOf(TRAINER_ORDER[b].location) || a - b;
		});
	});
	TRAINER_ORDER.forEach(function (trainer, index) {
		if (trainer.route) return;
		if (routes[index]) order = order.concat(routes[index]);
		if (trainer.parallel && skipped.indexOf(index) !== -1 && !isBeatenFight(index)) (waiting[trainer.parallel.gate] = waiting[trainer.parallel.gate] || []).push(index);
		else if (!trainer.duplicate || index === currentTrainerIndex) order.push(index);
		Object.keys(ends).forEach(function (gate) {
			if (ends[gate] === index && waiting[gate]) order = order.concat(waiting[gate]);
		});
	});
	return order.concat(routes.end || []);
}

function stepTrainer(step) {
	var order = getTrainerNavOrder();
	var next = order[order.indexOf(currentTrainerIndex) + step];
	if (next !== undefined) showTrainer(next);
}

function isRivalStarterVariant(variant) {
	return /^Rival Has /.test(variant.label);
}

function isBadgeVariant(variant) {
	return variant.thunderBadge !== undefined;
}

function getTrainerVariant(trainer) {
	// A fight the game picks a team for (by badge or at random) shows the one you beat.
	if ((trainer.randomTeams || trainer.variants.some(isBadgeVariant)) && typeof isVariantDefeated === "function") {
		var index = TRAINER_ORDER.indexOf(trainer);
		var beaten = trainer.variants.filter(function (variant) {
			return isVariantDefeated(index, variant);
		})[0];
		if (beaten) return beaten;
	}
	// Bugsy's team follows the Thunder Badge (Lt. Surge beaten), as his script does.
	if (trainer.variants.some(isBadgeVariant)) {
		var afterSurge = isGymBeaten("Lt. Surge");
		return trainer.variants.filter(function (variant) {
			return variant.thunderBadge === afterSurge;
		})[0] || trainer.variants[0];
	}
	var wanted = trainer.variants.some(isRivalStarterVariant) ?
		RIVAL_TEAM_FOR_STARTER[getStarterType()] : readSetting(TRAINER_VARIANT_KEY);
	return trainer.variants.filter(function (variant) {
		return variant.label === wanted;
	})[0] || trainer.variants[0];
}

// The cap a fight is at: the one you are at now (badges, gyms marked Defeated, the cap after the gym
// for a skipped fight) when that is higher than its own; a beaten fight, the cap it was beaten at.
// A route trainer is at the cap of the fight it comes before.
function getShownLevelCap(index) {
	var trainer = TRAINER_ORDER[index];
	var levelCap = trainer.route && typeof getArcCaps === "function" ? getArcCaps()[index] : trainer.levelCap;
	var listed = parseInt(levelCap) || 0;
	if (typeof isTrainerDefeated === "function" && isTrainerDefeated(index)) {
		var then = getDefeatCap(index, getTrainerVariant(trainer));
		return then > listed ? then : levelCap;
	}
	var progressCap = getProgressLevelCap();
	if (isFightSkipped(index)) progressCap = Math.max(progressCap, trainer.parallel.capAfter);
	return progressCap > listed ? progressCap : levelCap;
}

function describeTrainer(trainer, index) {
	var order = getTrainerNavOrder();
	var details = [
		(order.indexOf(index) + 1) + " / " + order.length,
		trainer.location,
		"Level cap " + getShownLevelCap(index)
	];
	var variant = getTrainerVariant(trainer);
	var basis = getTeamLevelBasis(index, variant);
	if (basis.level && variant.levelBelowHighest && variant.levelBelowHighest.some(function (n) {
		return typeof n === "number";
	})) {
		details.push(basis.from === "beaten" ? "Levels from your Lv " + basis.level + " when beaten" :
			basis.from === "save" ? "Levels from your Lv " + basis.level : "Levels for Lv " + basis.level + " (the cap)");
	}
	if (variant.thunderBadge !== undefined) details.push(variant.thunderBadge ? "Team after Lt. Surge" : "Team before Lt. Surge");
	if (trainer.randomTeams) details.push("Random team (1 in 3)");
	return details.concat(trainer.route ? ["Route trainer"] : trainer.optional ? ["Optional"] : []).join(" · ");
}

// The team slot loaded into Pokémon 2. A team can repeat a set (Creator's five Shedinja),
// so slots, not set ids, say which Pokémon is meant.
var activeTrainerSlot = 0;

function markActiveTrainerPokemon(slot) {
	activeTrainerSlot = slot;
	showingMegaBase = false;
	updateMegaFormButton();
	$("#trainer-team .pokemon-sprite").each(function (i) {
		$(this).toggleClass("trainer-pokemon-active", i === slot);
	});
	$(document).trigger("trainer:active");
}

/*
 * Weather and terrain a trainer's Pokémon sets up (Thwackey's Grassy Surge) last several turns,
 * so they stay up when it switches out: loading a teammate keeps them instead of turning them
 * off. Turn them off yourself when they run out. Primal weather ends with its Pokémon.
 */
var CARRIED_WEATHER = ["Sun", "Rain", "Sand", "Hail", "Snow"];
var fightField = {weather: "", terrain: ""};

function keepFightField() {
	var weather = lastAutoWeather[1];
	var terrain = lastAutoTerrain[1];
	if (CARRIED_WEATHER.indexOf(weather) !== -1) fightField.weather = weather;
	if (terrain) fightField.terrain = terrain;
	// Only when loading turned it off: weather your Pokémon set since then stays.
	if (!lockedField.weather && !weather && fightField.weather && !$("input:radio[name='weather']:checked").val()) {
		lastAutoWeather[1] = fightField.weather;
		$("input:radio[name='weather'][value='" + fightField.weather + "']").prop("checked", true).change();
	}
	if (!lockedField.terrain && !terrain && fightField.terrain && !$("input:checkbox[name='terrain']:checked").length) {
		lastAutoTerrain[1] = fightField.terrain;
		$("input:checkbox[name='terrain'][value='" + fightField.terrain + "']").prop("checked", true).change();
	}
}

function loadTrainerPokemon(setId, slot) {
	loadSetIntoPokemon("#p2", setId);
	keepFightField();
	if (slot === undefined) {
		slot = $("#trainer-team .pokemon-sprite").map(function () {
			return $(this).attr("data-set-id");
		}).get().indexOf(setId);
	}
	markActiveTrainerPokemon(slot);
	// "Swellow is pre-burned": that Pokémon starts the battle burned.
	var preBurned = currentBattleEffect.match(/(\S+) is pre-burned/i);
	if (preBurned && getPokemonName(setId).toLowerCase().indexOf(preBurned[1].toLowerCase()) === 0) {
		$("#p2 .status").val("Burned").change();
	}
}

/*
 * A trainer's Mega starts the fight in its base form and Mega Evolves when it first attacks.
 * "Base form" switches Pokémon 2 to that form, with the ability the boss document gives it
 * before Mega Evolving (Kangaskhan's Inner Focus); "Mega form" switches back.
 */
var showingMegaBase = false;

function getActiveTrainerSet() {
	return getTrainerVariant(TRAINER_ORDER[currentTrainerIndex]).sets[activeTrainerSlot];
}

function updateMegaFormButton() {
	var setId = getActiveTrainerSet() || "";
	$("#trainer-mega-form")
		.toggle(/-Mega/.test(getPokemonName(setId)))
		.text(showingMegaBase ? "Mega form" : "Base form")
		.attr("title", showingMegaBase ? "Back to the Mega Evolved form" : "Before it Mega Evolves: base form and ability");
}

function toggleMegaForm() {
	var setId = getActiveTrainerSet();
	if (showingMegaBase) {
		loadTrainerPokemon(setId, activeTrainerSlot);
		return;
	}
	var baseName = getPokemonName(setId).split("-Mega")[0];
	var variant = getTrainerVariant(TRAINER_ORDER[currentTrainerIndex]);
	var ability = (variant.preMega && variant.preMega[activeTrainerSlot]) || pokedex[baseName].abilities[0];
	$("#p2 .forme").val(baseName).change();
	$("#p2 .ability").val(ability).change();
	showingMegaBase = true;
	updateMegaFormButton();
}

function showTrainer(index) {
	currentTrainerIndex = Math.max(0, Math.min(index, TRAINER_ORDER.length - 1));
	writeSetting(getTrainerIndexKey(), currentTrainerIndex);
	var trainer = TRAINER_ORDER[currentTrainerIndex];
	var variant = getTrainerVariant(trainer);
	applyRelativeLevels(currentTrainerIndex, variant);

	$("#trainer-name").text(trainer.name);
	$("#trainer-details").text(describeTrainer(trainer, currentTrainerIndex));
	$("#trainer-variant")
		.empty()
		.append(trainer.variants.map(function (v) {
			return $("<option></option>").val(v.label).text(v.label);
		}))
		.val(variant.label)
		// Rival teams follow the starter setting, Bugsy's your badges, instead of a per-fight choice.
		.toggle(trainer.variants.length > 1 && !isRivalStarterVariant(variant) && !isBadgeVariant(variant));
	var ends = getParallelGroupEnds();
	$("#trainer-skip-label").toggle(canSkipFight(currentTrainerIndex))
		.attr("title", trainer.parallel ? "You can do this fight before or after " + trainer.parallel.gate +
			": Previous / Next bring it up after " + TRAINER_ORDER[ends[trainer.parallel.gate]].name + ", at the cap after the gym" : "");
	$("#trainer-skip-where").text(trainer.parallel ? " (fight it after " + TRAINER_ORDER[ends[trainer.parallel.gate]].location + ")" : "");
	$("#trainer-skip").prop("checked", isFightSkipped(currentTrainerIndex));
	releaseBattleEffect();
	// Battle conditions from the boss document, e.g. "Doubles + Permanent rain".
	$("#trainer-effect").text(variant.battleEffect ? "Battle effect: " + variant.battleEffect : "").toggle(!!variant.battleEffect);
	$("#trainer-team").empty().append(variant.sets.map(createPokemonSprite));
	var order = getTrainerNavOrder();
	$("#previous-trainer").prop("disabled", order.indexOf(currentTrainerIndex) === 0);
	$("#next-trainer").prop("disabled", order.indexOf(currentTrainerIndex) === order.length - 1);
	currentBattleEffect = variant.battleEffect || "";
	fightField = {weather: "", terrain: ""};
	if (variant.sets.length) loadTrainerPokemon(variant.sets[0], 0);
	// After loading, since a Pokémon's ability (e.g. Drizzle) can set the weather itself.
	applyBattleEffect(variant.battleEffect, trainer.name);
	$(document).trigger("trainer:shown");
}

// The Professor Oak button: your run ended, so this mode's box and progress start over.
// The other mode's box is not touched.
function confirmNewRun() {
	var mode = BOX_TRANSFER_MODES[getPageMode()];
	var count = getSetIds(readCustomSets()).length;
	showChoiceDialog(
		"Start a new run?",
		"Did your run end? Starting again deletes your " + mode + " Team, Box, Box 2 and Trash" +
			(count ? " (" + count + " Pok\u00e9mon)" : "") + ", clears your KOs, defeated trainers and Nuzlocke encounters, " +
			"and goes back to the first trainer. Your Fight Notes are kept. This cannot be undone.",
		[{
			label: "Yes, my run is over: wipe and start again",
			action: startNewRun
		}]);
}

// Also run by a .sav import from a new game (save_import.js).
function startNewRun() {
	$(document).trigger("run:end"); // run_record.js keeps how far it got
	writeBoxLayout({});
	clearCustomSets();
	clearTrainerProgress();
	// A new run picks a new starter.
	writeSetting(STARTER_FROM_SAVE_KEY + ":" + getPageMode(), false);
	updateStarterSelect();
	$(document).trigger("run:new");
	showTrainer(0);
}

// Like "Team/Box above Pokémon 1": the trainer panel (and its progress bars) can sit above Pokémon 2.
var TRAINER_ON_TOP_KEY = "trainerOnTop";

function placeTrainerPanel(onTop) {
	var panels = $("#trainer-nav").add("#run-progress").add("#run-record");
	if (onTop) panels.insertBefore("#p2");
	else panels.insertAfter("#p2");
}

function buildTrainerPanel() {
	var panel = $(
		'<fieldset id="trainer-nav">' +
		'<legend align="center">Opposing Trainer</legend>' +
		'<div class="trainer-heading"><b id="trainer-name"></b> <span id="trainer-details"></span></div>' +
		'<div id="trainer-effect"></div>' +
		'<label id="trainer-skip-label" class="trainer-skip"><input type="checkbox" id="trainer-skip" /> Skip for now' +
		'<span id="trainer-skip-where"></span></label>' +
		'<label class="trainer-starter">Your starter\u2019s type: <select id="trainer-starter"></select>' +
		'<span id="trainer-starter-lock" class="trainer-starter-lock"> \uD83D\uDD12 from your save</span></label> ' +
		'<select id="trainer-variant" aria-label="Which team this trainer uses"></select>' +
		'<div id="trainer-team" class="trainer-team"></div>' +
		'<div class="trainer-buttons">' +
		'<button type="button" id="previous-trainer">Previous Trainer</button>' +
		'<button type="button" id="next-trainer">Next Trainer</button>' +
		'<button type="button" id="trainer-mega-form"></button>' +
		'<button type="button" id="reset-trainer" title="New run: wipe your box and go back to the first trainer" aria-label="Start a new run"></button>' +
		'</div>' +
		'<label class="trainer-on-top"><input type="checkbox" id="trainer-on-top" /> Trainer above Pok\u00e9mon 2</label>' +
		'<label class="trainer-routes" title="Every other trainer in the game, before the boss fight they lead up to">' +
		'<input type="checkbox" id="trainer-routes" /> Route trainers in Previous / Next</label>' +
		'</fieldset>');
	$("<img />")
		.attr({src: OAK_SPRITE_URL, alt: ""})
		.on("error", function () {
			$(this).replaceWith("↺");
		})
		.appendTo(panel.find("#reset-trainer"));
	return panel;
}

function bindTrainerEvents() {
	$("#previous-trainer").click(function () {
		stepTrainer(-1);
	});
	$("#next-trainer").click(function () {
		stepTrainer(1);
	});
	$("#trainer-skip").change(function () {
		setFightSkipped(currentTrainerIndex, this.checked);
	});
	$("#reset-trainer").click(confirmNewRun);
	$("#trainer-mega-form").click(toggleMegaForm);
	// Turning the kept weather or terrain off (it ran out) stops it coming back.
	$("input:radio[name='weather']").change(function () {
		if (this.checked && this.value !== fightField.weather) fightField.weather = "";
	});
	$("input:checkbox[name='terrain']").change(function () {
		if (!$("input:checkbox[name='terrain'][value='" + fightField.terrain + "']").prop("checked")) fightField.terrain = "";
	});
	$("#trainer-on-top").prop("checked", readSetting(TRAINER_ON_TOP_KEY) === "true").change(function () {
		writeSetting(TRAINER_ON_TOP_KEY, this.checked);
		placeTrainerPanel(this.checked);
	});
	$("#trainer-routes").prop("checked", areRouteTrainersShown()).change(function () {
		writeSetting(ROUTE_TRAINERS_KEY, this.checked);
		showTrainer(currentTrainerIndex);
	});
	$("#trainer-starter")
		.append(STARTER_TYPES.map(function (type) {
			return $("<option></option>").val(type).text(type);
		}))
		.change(function () {
			setStarter($(this).val(), false);
		});
	updateStarterSelect();
	$("#trainer-variant").change(function () {
		writeSetting(TRAINER_VARIANT_KEY, $(this).val());
		showTrainer(currentTrainerIndex);
	});
	$("#trainer-team").on("click", ".pokemon-sprite", function () {
		loadTrainerPokemon($(this).attr("data-set-id"), $(this).index());
	});
}

$(document).ready(function () {
	// A game with no boss fights yet (games.js) has no trainer panel.
	if (!TRAINER_ORDER.length) return;
	$("#p2").after(buildTrainerPanel());
	placeTrainerPanel(readSetting(TRAINER_ON_TOP_KEY) === "true");
	$(".field-info legend").after('<div id="battle-effect-lock" class="battle-effect-lock"></div>');
	bindTrainerEvents();
	showTrainer(parseInt(readSetting(getTrainerIndexKey())) || 0);
});
