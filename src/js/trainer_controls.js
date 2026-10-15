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
	if (save.starter) setStarter(save.starter, true);
});

function isRivalStarterVariant(variant) {
	return /^Rival Has /.test(variant.label);
}

function getTrainerVariant(trainer) {
	var wanted = trainer.variants.some(isRivalStarterVariant) ?
		RIVAL_TEAM_FOR_STARTER[getStarterType()] : readSetting(TRAINER_VARIANT_KEY);
	return trainer.variants.filter(function (variant) {
		return variant.label === wanted;
	})[0] || trainer.variants[0];
}

function describeTrainer(trainer, index) {
	return [
		(index + 1) + " / " + TRAINER_ORDER.length,
		trainer.location,
		"Level cap " + trainer.levelCap
	].concat(trainer.optional ? ["Optional"] : []).join(" · ");
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

	$("#trainer-name").text(trainer.name);
	$("#trainer-details").text(describeTrainer(trainer, currentTrainerIndex));
	$("#trainer-variant")
		.empty()
		.append(trainer.variants.map(function (v) {
			return $("<option></option>").val(v.label).text(v.label);
		}))
		.val(variant.label)
		// Rival teams follow the starter setting instead of a per-fight choice.
		.toggle(trainer.variants.length > 1 && !isRivalStarterVariant(variant));
	releaseBattleEffect();
	// Battle conditions from the boss document, e.g. "Doubles + Permanent rain".
	$("#trainer-effect").text(variant.battleEffect ? "Battle effect: " + variant.battleEffect : "").toggle(!!variant.battleEffect);
	$("#trainer-team").empty().append(variant.sets.map(createPokemonSprite));
	$("#previous-trainer").prop("disabled", currentTrainerIndex === 0);
	$("#next-trainer").prop("disabled", currentTrainerIndex === TRAINER_ORDER.length - 1);
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
			(count ? " (" + count + " Pok\u00e9mon)" : "") + ", clears your KOs and defeated trainers, " +
			"and goes back to the first trainer. Your Fight Notes are kept. This cannot be undone.",
		[{
			label: "Yes, my run is over: wipe and start again",
			action: function () {
				writeBoxLayout({});
				clearCustomSets();
				clearTrainerProgress();
				// A new run picks a new starter.
				writeSetting(STARTER_FROM_SAVE_KEY + ":" + getPageMode(), false);
				updateStarterSelect();
				showTrainer(0);
			}
		}]);
}

// Like "Team/Box above Pokémon 1": the trainer panel (and its progress bars) can sit above Pokémon 2.
var TRAINER_ON_TOP_KEY = "trainerOnTop";

function placeTrainerPanel(onTop) {
	var panels = $("#trainer-nav").add("#run-progress");
	if (onTop) panels.insertBefore("#p2");
	else panels.insertAfter("#p2");
}

function buildTrainerPanel() {
	var panel = $(
		'<fieldset id="trainer-nav">' +
		'<legend align="center">Opposing Trainer</legend>' +
		'<div class="trainer-heading"><b id="trainer-name"></b> <span id="trainer-details"></span></div>' +
		'<div id="trainer-effect"></div>' +
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
		showTrainer(currentTrainerIndex - 1);
	});
	$("#next-trainer").click(function () {
		showTrainer(currentTrainerIndex + 1);
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
	$("#p2").after(buildTrainerPanel());
	placeTrainerPanel(readSetting(TRAINER_ON_TOP_KEY) === "true");
	$(".field-info legend").after('<div id="battle-effect-lock" class="battle-effect-lock"></div>');
	bindTrainerEvents();
	showTrainer(parseInt(readSetting(getTrainerIndexKey())) || 0);
});
