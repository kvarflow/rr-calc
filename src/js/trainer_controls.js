/*
 * Opposing trainer navigation, modelled on syl-rnb-calc. Previous / Next Trainer step
 * through this mode's boss fights in game order (TRAINER_ORDER, generated from the boss
 * documents by import/radical-red-trainers), showing each trainer's team under Pokémon 2
 * and loading its first Pokémon there. The Professor Oak button starts a new run: after you
 * confirm your run is over, it wipes this mode's box and goes back to the first trainer.
 * The current trainer is remembered per mode.
 */

var OAK_SPRITE_URL = "https://play.pokemonshowdown.com/sprites/trainers/oak.png";
// Other fights with several possible teams (Lorelei's rain or snow team) remember the
// chosen team by its label.
var TRAINER_VARIANT_KEY = "trainerVariant";
// The rival's team depends on your starter: he picks the one that counters it.
var STARTER_KEY = "starterType";
var STARTER_TYPES = ["Fire", "Water", "Grass"];
var RIVAL_TEAM_FOR_STARTER = {Fire: "Rival Has Squirtle", Water: "Rival Has Bulbasaur", Grass: "Rival Has Charmander"};

function getTrainerIndexKey() {
	return "trainerIndex:" + getPageMode();
}

function readSetting(key) {
	try {
		return localStorage.getItem(key);
	} catch (e) {
		return null;
	}
}

function writeSetting(key, value) {
	try {
		localStorage.setItem(key, value);
	} catch (e) {
		// Storage unavailable (e.g. private browsing): the choice lasts until reload.
	}
}

var currentTrainerIndex = 0;
var currentBattleEffect = "";

/*
 * How a boss's battle effect ("Doubles + Permanent rain") maps onto the Field panel. The
 * first matching weather and terrain win; Pokémon 2 is the boss's side, so side-specific
 * effects use the right-hand ("R") toggles. Effects the panel cannot show (Trick Room,
 * pre-burned Pokémon, special rules) stay as text only.
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
	{pattern: /gravity/i, id: "gravity"}
];

function firstMatch(effects, text) {
	return effects.filter(function (effect) {
		return effect.pattern.test(text);
	})[0];
}

// Sets the Field panel to the boss's battle effect, resetting what a previous boss set.
function applyBattleEffect(text) {
	text = text || "";
	$(/doubles/i.test(text) ? "#doubles-format" : "#singles-format").prop("checked", true).change();
	var weather = firstMatch(EFFECT_WEATHER, text);
	$("#" + (weather ? weather.id : "clear")).prop("checked", true).change();
	// Terrain boxes are mutually exclusive: the change event must come from the one ticked.
	var terrain = firstMatch(EFFECT_TERRAIN, text);
	$("input:checkbox[name='terrain']").prop("checked", false);
	(terrain ? $("#" + terrain.id).prop("checked", true) : $("input:checkbox[name='terrain']").first()).change();
	EFFECT_TOGGLES.forEach(function (effect) {
		$("#" + effect.id).prop("checked", effect.pattern.test(text)).change();
	});
}

function getStarterType() {
	var starter = readSetting(STARTER_KEY);
	return STARTER_TYPES.indexOf(starter) === -1 ? STARTER_TYPES[0] : starter;
}

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

function markActiveTrainerPokemon(setId) {
	$("#trainer-team .pokemon-sprite").each(function () {
		$(this).toggleClass("trainer-pokemon-active", $(this).attr("data-set-id") === setId);
	});
}

function loadTrainerPokemon(setId) {
	loadSetIntoPokemon("#p2", setId);
	markActiveTrainerPokemon(setId);
	// "Swellow is pre-burned": that Pokémon starts the battle burned.
	var preBurned = currentBattleEffect.match(/(\S+) is pre-burned/i);
	if (preBurned && getPokemonName(setId).toLowerCase().indexOf(preBurned[1].toLowerCase()) === 0) {
		$("#p2 .status").val("Burned").change();
	}
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
	// Battle conditions from the boss document, e.g. "Doubles + Permanent rain".
	$("#trainer-effect").text(variant.battleEffect ? "Battle effect: " + variant.battleEffect : "").toggle(!!variant.battleEffect);
	$("#trainer-team").empty().append(variant.sets.map(createPokemonSprite));
	$("#previous-trainer").prop("disabled", currentTrainerIndex === 0);
	$("#next-trainer").prop("disabled", currentTrainerIndex === TRAINER_ORDER.length - 1);
	currentBattleEffect = variant.battleEffect || "";
	if (variant.sets.length) loadTrainerPokemon(variant.sets[0]);
	// After loading, since a Pokémon's ability (e.g. Drizzle) can set the weather itself.
	applyBattleEffect(variant.battleEffect);
}

// The Professor Oak button: your run ended, so this mode's box and progress start over.
// The other mode's box is not touched.
function confirmNewRun() {
	var mode = BOX_TRANSFER_MODES[getPageMode()];
	var count = getSetIds(readCustomSets()).length;
	showChoiceDialog(
		"Start a new run?",
		"Did your run end? Starting again deletes your " + mode + " Team, Box, Box 2 and Trash" +
			(count ? " (" + count + " Pok\u00e9mon)" : "") + " and goes back to the first trainer. " +
			"This cannot be undone.",
		[{
			label: "Yes, my run is over: wipe and start again",
			action: function () {
				writeBoxLayout({});
				clearCustomSets();
				showTrainer(0);
			}
		}]);
}

function buildTrainerPanel() {
	var panel = $(
		'<fieldset id="trainer-nav">' +
		'<legend align="center">Opposing Trainer</legend>' +
		'<div class="trainer-heading"><b id="trainer-name"></b> <span id="trainer-details"></span></div>' +
		'<div id="trainer-effect"></div>' +
		'<label class="trainer-starter">Your starter: <select id="trainer-starter"></select></label> ' +
		'<select id="trainer-variant" aria-label="Which team this trainer uses"></select>' +
		'<div id="trainer-team" class="trainer-team"></div>' +
		'<div class="trainer-buttons">' +
		'<button type="button" id="previous-trainer">Previous Trainer</button>' +
		'<button type="button" id="next-trainer">Next Trainer</button>' +
		'<button type="button" id="reset-trainer" title="New run: wipe your box and go back to the first trainer" aria-label="Start a new run"></button>' +
		'</div>' +
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
	$("#trainer-starter")
		.append(STARTER_TYPES.map(function (type) {
			return $("<option></option>").val(type).text(type);
		}))
		.val(getStarterType())
		.change(function () {
			writeSetting(STARTER_KEY, $(this).val());
			showTrainer(currentTrainerIndex);
		});
	$("#trainer-variant").change(function () {
		writeSetting(TRAINER_VARIANT_KEY, $(this).val());
		showTrainer(currentTrainerIndex);
	});
	$("#trainer-team").on("click", ".pokemon-sprite", function () {
		loadTrainerPokemon($(this).attr("data-set-id"));
	});
}

$(document).ready(function () {
	$("#p2").after(buildTrainerPanel());
	bindTrainerEvents();
	showTrainer(parseInt(readSetting(getTrainerIndexKey())) || 0);
});
