/*
 * Pokémon imported from your .sav: their type, base stats, IVs, EVs, nature, level and ability
 * come from the save, so they are locked. Stat stages (the − / + buttons), item, status, current
 * HP and moves stay editable. "Edit anyway" unlocks them until another set is loaded.
 */

var SAVE_LOCKED_FIELDS = ".type1, .type2, .level, .nature, .ability, .base, .ivs, .evs";

// The set loaded into a Pokémon panel, or null for a set that is not saved (e.g. a blank one).
function getLoadedSet(panel) {
	var setId = panel.find("input.set-selector").val() || "";
	var split = setId.indexOf(" (");
	if (split === -1) return null;
	var sets = setdex[setId.slice(0, split)];
	return (sets && sets[setId.slice(split + 2, -1)]) || null;
}

function setSaveLock(panel, locked) {
	var fromSave = !!(getLoadedSet(panel) || {}).fromSave;
	panel.toggleClass("save-locked", fromSave && locked);
	panel.find(SAVE_LOCKED_FIELDS).prop("disabled", fromSave && locked);
	panel.find(".save-lock-note")
		.toggle(fromSave)
		.toggleClass("save-lock-open", !locked)
		.find(".save-lock-text").text(locked ? "🔒 From your save" : "Unlocked: these may differ from your save");
	panel.find(".save-lock-toggle").text(locked ? "Edit anyway" : "Lock");
}

$(document).ready(function () {
	$(".poke-info").each(function () {
		var panel = $(this);
		$('<div class="save-lock-note"><span class="save-lock-text"></span> <button type="button" class="save-lock-toggle"></button></div>')
			.insertAfter(panel.find("input.set-selector").first())
			.find("button").click(function () {
				setSaveLock(panel, !panel.hasClass("save-locked"));
			});
		// After the calculator's own handler has filled in the new set: a new set is locked again.
		panel.find("input.set-selector").change(function () {
			setSaveLock(panel, true);
		});
		setSaveLock(panel, true);
	});
});
