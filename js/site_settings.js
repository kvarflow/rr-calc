/*
 * The footer's settings (saved per browser), and the "What's new" and "Credits" popups,
 * after syl-rnb-calc. "What's new" opens by itself once after an update.
 */

var SITE_SETTINGS = [
	{key: "showBoxSearch", label: "Show box search", hideClass: "hide-box-search"},
	{key: "showRangeCompare", label: "Show Range Compare", hideClass: "hide-range-compare"},
	{key: "showCritRates", label: "Show crit chances", hideClass: "hide-crit-rates"}
];

// Newest last. Bump the version to show "What's new" again; keep each entry to a few short lines.
var CHANGELOG = [
	{version: "1.0", notes: [
		"Team / Box panel and .sav import, with matchup colour coding"
	]},
	{version: "1.1", notes: [
		"Previous / Next through every boss, rival teams per starter, Professor Oak's new run"
	]},
	{version: "1.2", notes: [
		"Crit chances, Range Compare, Export All, Fight Notes and ability info"
	]},
	{version: "1.3", notes: [
		"Small-screen layout for the Thor and phones, the Wild tab, offline and install"
	]},
	{version: "1.4", notes: [
		"Trainer AI: how likely each move is, and when the foe switches"
	]},
	{version: "1.5", notes: [
		"KO and fight tracking, run progress, level caps from your save"
	]},
	{version: "1.6", notes: [
		"Protean, consecutive-use moves, box ranking and item info"
	]},
	{version: "1.7", notes: [
		"Trainer AI: the rest of Radical Red's move scoring"
	]},
	{version: "1.8", notes: [
		"Every trainer in the order you walk to them, with sprites",
		"Mastersheet, Frag sheet and Dex",
		"Suggested EVs, and genders as in the game",
		"Battle tab: the foe's likely switch-in, and drag between team and Box",
		"Fainted section: your dead stay out after a .sav import",
		"Desktop: a modern look (Classic under Settings)"
	], fixes: [
		"Rivalry against the other gender, Unburden in the box, frostbite and the Toxic counter"
	]},
	{version: "1.9", notes: [
		"Faster: calculations and trainer changes in about half the time, and half as much to load",
		"Backup (Import / Export): everything as one file, to restore here or on another device",
		"Trainer pictures on the Battle tab, item icons, and type badges",
		"Tap a heading in the Dex, Mastersheet or Frag sheet to fold it; the Frag sheet groups Team, Box and Fainted",
		"In the Pcalc app: RetroArch sync built in, and automatic backups"
	], fixes: [
		"Small screens: Rivalry never applied (genders were read as genderless)",
		"Small screens: Metronome's use count was ignored on the Battle tab",
		"A Pok\u00e9mon with no sprite keeps its place in the Dex"
	]}
];
// Inside the Pcalc app (kvarflow/Pcalc) the app's own name heads the page, whichever game is open.
function isInPcalc() {
	return /\bPcalc\//.test(navigator.userAgent);
}

$(document).ready(function () {
	if (!isInPcalc()) return;
	document.title = "Pcalc";
	$(".title-text").text("Pcalc");
});

var LAST_CHANGELOG_KEY = "lastChangelogVersion";

var CREDITS = [
	"Original calculator by Honko, maintained by Austin and Kris; Radical Red edition by Karthik.",
	"Team/Box, color coding, crit chances, Range Compare, Export All and more ported from SylmarDev's syl-rnb-calc (MIT).",
	"Pokémon sprites from May8th1995/sprites; trainer pictures and Professor Oak from smogon/sprites; " +
		"item icons from PokéAPI's sprites (CC0).",
	".sav names from Rad-Red-4.1-Team-Exporter; growth rates from PokéAPI.",
	"Trainer data from the Radical Red 4.1 Default and Hardcore Mode boss documents, checked against the game.",
	"Ability descriptions from the game, and from Pokémon Showdown (@pkmn/dex, MIT) for the rest.",
	"Wild encounters from the game; floor names from pret's pokefirered, and post-game area names from the " +
		"Pokémon Locations & Raid Dens v4.1 sheet.",
	"Trainer AI ported from Complete Fire Red Upgrade's battle AI (Skeli789 and contributors), which Radical Red is built on.",
	"Further improved with QOL features by kvarflow."
];

function isSettingOn(setting) {
	return readSetting(setting.key) !== "false";
}

function applySiteSetting(setting) {
	$("body").toggleClass(setting.hideClass, !isSettingOn(setting));
}

// A popup with a heading and a list, styled like the other dialogs.
function showListDialog(title, sections, onClose) {
	var dialog = $('<div class="box-dialog-backdrop"><div class="box-dialog info-dialog" role="dialog" aria-modal="true" aria-labelledby="info-dialog-title"></div></div>');
	var body = dialog.find(".box-dialog");
	$('<h3 id="info-dialog-title"></h3>').text(title).appendTo(body);
	sections.forEach(function (section) {
		if (section.heading) $("<h4></h4>").text(section.heading).appendTo(body);
		var list = $("<ul></ul>").appendTo(body);
		section.items.forEach(function (item) {
			$("<li></li>").text(item).appendTo(list);
		});
	});
	var close = function () {
		dialog.remove();
		$(document).off("keydown.infoDialog");
		if (onClose) onClose();
	};
	$('<div class="box-dialog-buttons"></div>').append($('<button type="button">Close</button>').click(close)).appendTo(body);
	dialog.click(function (ev) {
		if (ev.target === this) close();
	});
	$(document).on("keydown.infoDialog", function (ev) {
		if (ev.key === "Escape") close();
	});
	$("body").append(dialog);
}

function getLatestVersion() {
	return CHANGELOG[CHANGELOG.length - 1].version;
}

// Newest first; a version's bug fixes under their own heading (some versions only fix bugs).
function showChangelog() {
	var sections = [];
	CHANGELOG.slice().reverse().forEach(function (entry) {
		if (entry.notes) sections.push({heading: "Version " + entry.version, items: entry.notes});
		if (entry.fixes) sections.push({heading: "Version " + entry.version + ": bug fixes", items: entry.fixes});
	});
	showListDialog("What's new", sections, function () {
		writeSetting(LAST_CHANGELOG_KEY, getLatestVersion());
	});
}

function showCredits() {
	showListDialog("Credits", [{items: CREDITS}]);
}

$(document).ready(function () {
	var panel = $('<div class="site-settings"><b>Settings</b></div>');
	SITE_SETTINGS.forEach(function (setting) {
		$("<label></label>")
			.append($('<input type="checkbox" />').attr("id", setting.key).prop("checked", isSettingOn(setting)).change(function () {
				writeSetting(setting.key, this.checked);
				applySiteSetting(setting);
				if (setting.key === "showCritRates") performCalculations(); // shows or hides them
			}), " " + setting.label)
			.appendTo(panel);
		applySiteSetting(setting);
	});
	panel.append(
		$('<button type="button" id="show-changelog">What\'s new</button>').click(showChangelog),
		" ",
		$('<button type="button" id="show-credits">Credits</button>').click(showCredits));
	$(".credits").append(panel);
	if (readSetting(LAST_CHANGELOG_KEY) !== getLatestVersion()) showChangelog();
});
