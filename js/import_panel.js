/*
 * The Import / Export panel: the custom set text box folds away behind a small toggle
 * (remembered per browser) so "Import .sav" stays in view, and Fight Notes below it
 * keep your plan for the next fight, saved per mode as you type. "Export All" (from
 * syl-rnb-calc) shows the whole box as Showdown text to copy.
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

// A dialog showing text to copy, styled like the other box dialogs.
function showExportDialog(title, text) {
	var dialog = $('<div class="box-dialog-backdrop"><div class="box-dialog export-dialog" role="dialog" aria-modal="true" aria-labelledby="export-dialog-title"></div></div>');
	var body = dialog.find(".box-dialog");
	$('<h3 id="export-dialog-title"></h3>').text(title).appendTo(body);
	var area = $('<textarea class="export-dialog-text" readonly></textarea>').val(text || "Your box is empty.").appendTo(body);
	var buttons = $('<div class="box-dialog-buttons"></div>').appendTo(body);
	var close = function () {
		dialog.remove();
		$(document).off("keydown.exportDialog");
	};
	$('<button type="button" class="box-dialog-primary">Copy</button>').prop("disabled", !text).click(function () {
		var button = $(this);
		area.select();
		var copied = navigator.clipboard ? navigator.clipboard.writeText(text) : $.Deferred().reject().promise();
		$.when(copied).then(function () {
			button.text("Copied!");
		}, function () {
			button.text("Press Ctrl+C to copy");
		});
	}).appendTo(buttons);
	$('<button type="button">Close</button>').click(close).appendTo(buttons);
	$(document).on("keydown.exportDialog", function (ev) {
		if (ev.key === "Escape") close();
	});
	$("body").append(dialog);
	area.focus().select();
}

$(document).ready(function () {
	$('<button id="exportAll" title="Show every Pok\u00e9mon in your Team and Box as Showdown text">Export All</button>')
		.click(function () {
			showExportDialog("Export All", exportAllSets());
		})
		.insertAfter("#exportL");
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
