/*
 * Opposing trainer navigation, modelled on syl-rnb-calc. Previous / Next Trainer step
 * through this mode's boss fights in game order (TRAINER_ORDER, generated from the boss
 * documents by import/radical-red-trainers), showing each trainer's team under Pokémon 2
 * and loading its first Pokémon there. The Professor Oak button goes back to the first
 * trainer. The current trainer is remembered per mode.
 */

var OAK_SPRITE_URL = "https://play.pokemonshowdown.com/sprites/trainers/oak.png";
// Fights with several possible teams (the rival's depends on your starter) remember the
// chosen team by its label, so later fights of the same kind use the same choice.
var TRAINER_VARIANT_KEY = "trainerVariant";

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

function getTrainerVariant(trainer) {
	var preferred = readSetting(TRAINER_VARIANT_KEY);
	return trainer.variants.filter(function (variant) {
		return variant.label === preferred;
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
		.toggle(trainer.variants.length > 1);
	// Battle conditions from the boss document, e.g. "Doubles + Permanent rain".
	$("#trainer-effect").text(variant.battleEffect ? "Battle effect: " + variant.battleEffect : "").toggle(!!variant.battleEffect);
	$("#trainer-team").empty().append(variant.sets.map(createPokemonSprite));
	$("#previous-trainer").prop("disabled", currentTrainerIndex === 0);
	$("#next-trainer").prop("disabled", currentTrainerIndex === TRAINER_ORDER.length - 1);
	if (variant.sets.length) loadTrainerPokemon(variant.sets[0]);
}

function buildTrainerPanel() {
	var panel = $(
		'<fieldset id="trainer-nav">' +
		'<legend align="center">Opposing Trainer</legend>' +
		'<div class="trainer-heading"><b id="trainer-name"></b> <span id="trainer-details"></span></div>' +
		'<div id="trainer-effect"></div>' +
		'<select id="trainer-variant" aria-label="Which team this trainer uses"></select>' +
		'<div id="trainer-team" class="trainer-team"></div>' +
		'<div class="trainer-buttons">' +
		'<button type="button" id="previous-trainer">Previous Trainer</button>' +
		'<button type="button" id="next-trainer">Next Trainer</button>' +
		'<button type="button" id="reset-trainer" title="Back to the first trainer" aria-label="Back to the first trainer"></button>' +
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
	$("#reset-trainer").click(function () {
		showTrainer(0);
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
