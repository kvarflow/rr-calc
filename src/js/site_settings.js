/*
 * The footer's settings (saved per browser), and the "What's new" and "Credits" popups,
 * after syl-rnb-calc. "What's new" opens by itself once after an update.
 */

var SITE_SETTINGS = [
	{key: "showBoxSearch", label: "Show box search", hideClass: "hide-box-search"},
	{key: "showRangeCompare", label: "Show Range Compare", hideClass: "hide-range-compare"},
	{key: "showCritRates", label: "Show crit chances", hideClass: "hide-crit-rates"}
];

// Newest last. Bump the version to show "What's new" again.
// Versions grouped by what they cover (earlier releases 1.0 to 1.15 were merged into these).
var CHANGELOG = [
	{version: "1.0", notes: [
		"Team / Box / Trash panel, kept per mode",
		"Import your party and boxes from a .sav (stats locked; your starter set from it)",
		"Matchup color coding for your box against Pokémon 2"
	], fixes: [
		"Basculin's stripe and Pumpkaboo / Gourgeist sizes from a .sav"
	]},
	{version: "1.1", notes: [
		"Previous / Next through every boss fight, with Professor Oak to start a run",
		"Every rival team for each starter, from the game",
		"Boss battle effects set and locked on the Field",
		"“Base form” for a trainer's Mega before it evolves"
	], fixes: [
		"A trainer's Hidden Power could change type"
	]},
	{version: "1.2", notes: [
		"Trick Room, Focus Energy, crit chances and Crit buttons",
		"Range Compare: HP left after several hits",
		"Export All, copy damage rolls, fold panels, Fight Notes",
		"A ? beside abilities says what they do"
	]},
	{version: "1.3", notes: [
		"Small-screen layout (AYN Thor, phones) with Battle, You, Foe, Advanced, Box, Wild and More tabs",
		"Wild tab: every location's encounters, with Nuzlocke dupes",
		"Works offline and installs as an app"
	], fixes: [
		"On-screen keyboard HP entry; repeated recalculations"
	]},
	{version: "1.4", notes: [
		"Trainer AI: how often the foe picks each move, from Radical Red's own AI",
		"Switching: how often it switches out, to whom, and who comes in after a KO"
	], fixes: [
		"The Route 22 rival used the basic AI"
	]},
	{version: "1.5", notes: [
		"KO'd / Defeated tracking, arc and game progress, frags and the fainted",
		"A .sav marks the fights you've won and starts new runs",
		"Level caps and “Highest Lv” levels follow your progress",
		"“Skip for now” for fights you can do around a gym"
	]},
	{version: "1.6", notes: [
		"Protean changes type with the move picked",
		"Echoed Voice, Fury Cutter, Rollout: pick the use in a row",
		"Rank the box by damage dealt, taken or Speed",
		"A ? beside items; Loaded Dice counts 5 hits",
		"Neater small-screen result card and Battle tab"
	]},
	{version: "1.7", notes: [
		"Trainer AI: the rest of Radical Red's move scoring"
	]},
	{version: "1.8", notes: [
		"Route trainers: every trainer in the game, before the boss they lead to",
		"Route trainers in the order you walk to them; Reorder on the Mastersheet to fix any",
		"Trainer sprites on the trainer panel and Mastersheet",
		"Mastersheet: the whole game in order, with every team and wild Pokémon",
		"Frag sheet: your run's KOs per Pokémon and arc",
		"Dex: stats, evolutions, abilities, level-up / TM / tutor / egg moves, locations",
		"Suggested EVs: a generic spread and one for the arc's boss",
		"Genders as in the game (for Rivalry); a ♂ / ♀ button on small screens",
		"Battle tab: the foe's likely switch-in marked on its team (⇄ 75%, ↪ next)",
		"Battle tab: drag between your team and the Box",
		"Fainted section in the Box: your dead stay out of the team, boxes and Pok\u00e9mon 1's list, even after a new .sav import",
		"Draining moves and Shell Bell show what they heal",
		"Trainer AI: Z-Moves (Hardcore) and the last move cases",
		"Emulator sync with RetroArch and mGBA",
		"A game picker, ready for more games"
	], fixes: [
		"An Unburden Pok\u00e9mon in your box showed as faster than it is (Speed doubled as if its item were gone)",
		"Rivalry now weakens moves against the other gender (0.75×)",
		"Trainer AI treated frostbite as freeze",
		"The Toxic counter always counted as turn one",
		"Frostbite, Bad Dreams and Kee / Maranga Berry with multi-hit moves",
		"Mega Absol's ability; Ability Shield / Clear Amulet / Mirror Herb text",
		"Status moves listed as Physical in the Dex",
		"Works with site data blocked (private browsing)"
	]}
];
var LAST_CHANGELOG_KEY = "lastChangelogVersion";

var CREDITS = [
	"Original calculator by Honko, maintained by Austin and Kris; Radical Red edition by Karthik.",
	"Team/Box, color coding, crit chances, Range Compare, Export All and more ported from SylmarDev's syl-rnb-calc (MIT).",
	"Pokémon sprites from May8th1995/sprites; Professor Oak from smogon/sprites.",
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
