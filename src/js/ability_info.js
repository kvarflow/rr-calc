/*
 * A ? beside each Pokémon's ability shows what the ability does (data/ability_descriptions.js),
 * and for abilities that change how the calculator should be used (Simple, Contrary), how.
 * It stays open, following the ability, until tapped again.
 */

var ABILITY_CALC_TIPS = {
	Simple: "In the calculator: one Calm Mind or Swords Dance is +2, so press + twice.",
	Contrary: "In the calculator: a move that lowers its stats raises them instead, so press + for it."
};

function updateAbilityInfo(panel) {
	var info = panel.find(".ability-info");
	if (!info.is(":visible")) return;
	var ability = panel.find("select.ability").val() || "";
	info.empty().append($("<b></b>").text(ability ? ability + ": " : ""),
		document.createTextNode(ABILITY_DESCRIPTIONS[ability] || (ability ? "No description available." : "No ability.")));
	if (ABILITY_CALC_TIPS[ability]) info.append($('<span class="ability-tip"></span>').text(ABILITY_CALC_TIPS[ability]));
}

$(document).ready(function () {
	// The descriptions are the game's (games.js): none yet for other games.
	if (!hasGameFeature("abilityText")) return;
	$(".poke-info").each(function () {
		var panel = $(this);
		var select = panel.find("select.ability");
		var info = $('<div class="ability-info" role="note"></div>').hide();
		$('<button type="button" class="ability-help" aria-expanded="false" title="What does this ability do?">?</button>')
			.click(function () {
				var open = !info.is(":visible");
				info.toggle(open);
				$(this).attr("aria-expanded", open);
				updateAbilityInfo(panel);
			})
			.insertAfter(select);
		info.insertAfter(select.parent());
		select.change(function () {
			updateAbilityInfo(panel);
		});
	});
	// Loading a set sets the ability without a change event.
	$(document).on("calc:done", function () {
		$(".poke-info").each(function () {
			updateAbilityInfo($(this));
		});
	});
});
