/*
 * Run sheets, after hzla's Dynamic Calc: full-screen views beside the calc, built from this mode's
 * own data and your run. The Mastersheet (mastersheet.js) lists every place in game order with its
 * trainers' teams and wild Pokémon; the Frag sheet (fragsheet.js) lists every Pokémon of your run
 * with its KOs. Each registers itself with registerSheet. Tapping a trainer or one of its Pokémon
 * closes the sheet and loads it in the calc.
 *
 * The view is one history entry, so a phone's back gesture closes it.
 */

var SHEETS = [];
var SHEET_KEY = "lastSheet";
var openSheetKey = null;

// {key, label, render(body)}: render fills the sheet's body each time it is shown.
function registerSheet(sheet) {
	SHEETS.push(sheet);
}

/*
 * Sections that fold when their header is tapped (the Dex's cards, the Frag sheet's groups). There
 * is no arrow: the header itself is the control, and a folded section shows only its header. Which
 * ones are folded is remembered, so a folded Dex section stays folded from one Pokémon to the next.
 */
var SHEET_FOLDS_KEY = "sheetFolds";

function readSheetFolds() {
	try {
		return JSON.parse(readSetting(SHEET_FOLDS_KEY)) || {};
	} catch (e) {
		return {};
	}
}

// Folds `section` (adds "sheet-folded") when `head` is tapped; `key` names it in the saved folds.
function makeFoldable(section, head, key) {
	var apply = function (folded) {
		section.toggleClass("sheet-folded", folded);
		head.attr("aria-expanded", !folded);
	};
	head.addClass("sheet-fold-head").attr({role: "button", tabindex: 0});
	apply(!!readSheetFolds()[key]);
	head.on("click keydown", function (ev) {
		if (ev.type === "keydown" && ev.key !== "Enter" && ev.key !== " ") return;
		ev.preventDefault();
		var folded = !section.hasClass("sheet-folded");
		apply(folded);
		var folds = readSheetFolds();
		if (folded) folds[key] = true;
		else delete folds[key];
		writeSetting(SHEET_FOLDS_KEY, JSON.stringify(folds));
	});
}

function getSheet(key) {
	return SHEETS.filter(function (sheet) {
		return sheet.key === key;
	})[0];
}

function buildSheetView() {
	var view = $('<div id="sheet-view" class="sheet-view" role="dialog" aria-modal="true"></div>');
	var bar = $('<div class="sheet-bar"></div>').appendTo(view);
	var tabs = $('<div class="sheet-tabs" role="tablist"></div>').appendTo(bar);
	SHEETS.forEach(function (sheet) {
		$('<button type="button" class="sheet-tab" role="tab"></button>').attr("data-sheet", sheet.key).text(sheet.label)
			.click(function () {
				showSheet(sheet.key);
			}).appendTo(tabs);
	});
	$('<button type="button" class="sheet-close" aria-label="Close" title="Back to the calc (Esc)">✕</button>')
		.click(closeSheet).appendTo(bar);
	$('<div class="sheet-body"></div>').appendTo(view);
	return view.appendTo("body");
}

function showSheet(key) {
	var sheet = getSheet(key) || SHEETS[0];
	var view = $("#sheet-view").length ? $("#sheet-view") : buildSheetView();
	openSheetKey = sheet.key;
	writeSetting(SHEET_KEY, sheet.key);
	view.attr("aria-label", sheet.label).find(".sheet-tab").each(function () {
		var active = $(this).attr("data-sheet") === sheet.key;
		$(this).toggleClass("sheet-tab-active", active).attr("aria-selected", active);
	});
	var body = view.find(".sheet-body").empty().scrollTop(0);
	sheet.render(body);
}

function openSheet(key) {
	if (!openSheetKey && window.history && window.history.pushState) {
		window.history.pushState({sheet: true}, document.title);
	}
	$("html").addClass("sheet-open");
	showSheet(key || readSetting(SHEET_KEY));
	$("#sheet-view").show();
}

// Closes the view; `fromHistory` when the back gesture already took its history entry.
function closeSheet(fromHistory) {
	if (!openSheetKey) return;
	openSheetKey = null;
	$("html").removeClass("sheet-open");
	$("#sheet-view").hide();
	if (fromHistory !== true && window.history.state && window.history.state.sheet) window.history.back();
}

// From a sheet to the calc: that trainer (and one of its Pokémon) in Pokémon 2, on the Battle tab.
function openTrainerInCalc(index, setId, slot) {
	closeSheet();
	showTrainer(index);
	if (setId !== undefined) loadTrainerPokemon(setId, slot);
	if ($("html").hasClass("small-screen") && typeof showSmallScreenTab === "function") showSmallScreenTab("results");
}

// The sheets' buttons, in the Progress box.
function buildSheetButtons() {
	var row = $('<div class="sheet-buttons"></div>');
	SHEETS.forEach(function (sheet) {
		$('<button type="button" class="sheet-open-button"></button>').text(sheet.icon + " " + sheet.label)
			.attr("data-sheet", sheet.key).click(function () {
				openSheet(sheet.key);
			}).appendTo(row);
	});
	return row;
}

$(window).on("popstate", function () {
	closeSheet(true);
});

$(document).on("keydown", function (ev) {
	if (ev.key === "Escape" && openSheetKey && !$(".box-dialog-backdrop").length) closeSheet();
});

$(document).ready(function () {
	if (!SHEETS.length || !$("#run-progress").length) return;
	$("#run-progress").append(buildSheetButtons());
});
