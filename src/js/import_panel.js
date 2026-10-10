/*
 * The Import / Export panel: the custom set text box folds away behind a small toggle
 * (remembered per browser) so "Import .sav" stays in view, and Fight Notes below it
 * keep your plan for the next fight, saved per mode as you type.
 */

var CUSTOM_SET_OPEN_KEY = "customSetOpen";

function getFightNotesKey() {
	return "fightNotes:" + getPageMode();
}

function setCustomSetOpen(open) {
	$("#import-1_wrapper .import-team, #import").toggle(open);
	$("#custom-set-toggle")
		.attr("aria-expanded", open)
		.text((open ? "▾" : "▸") + " Custom set");
}

$(document).ready(function () {
	var wrapper = $("#import-1_wrapper");
	var toggle = $('<button type="button" id="custom-set-toggle" class="bs-btn bs-btn-default" aria-controls="import-1_wrapper"></button>');
	// The toggle and "Import .sav" share the top row, so the save import never needs a click to reach.
	$('<div class="import-actions"></div>').append(toggle, $("#import-save")).prependTo(wrapper);
	toggle.click(function () {
		var open = $(this).attr("aria-expanded") !== "true";
		setCustomSetOpen(open);
		writeSetting(CUSTOM_SET_OPEN_KEY, open);
	});
	setCustomSetOpen(readSetting(CUSTOM_SET_OPEN_KEY) === "true");

	var notes = $('<textarea id="fight-notes" rows="3" placeholder="Leads, switches, items, hazards, set-up, win conditions..."></textarea>')
		.val(readSetting(getFightNotesKey()) || "")
		.on("input change blur", function () {
			writeSetting(getFightNotesKey(), $(this).val());
		});
	$('<div class="fight-notes"></div>')
		.append('<label for="fight-notes">Fight Notes</label>', notes)
		.insertAfter(wrapper);
});
