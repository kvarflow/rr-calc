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
	]},
	{version: "1.10", notes: [
		"Settings \u2192 Theme: Light, Dark or Black (true black, for OLED screens like the AYN Thor's)",
		"Settings \u2192 Tabs: the tab bar at the top or the bottom of the screen",
		"In the Pcalc app: the game's save is imported by itself each time it changes (Import / Export \u2192 " +
			"Auto-import), the tabs start at the bottom, and the full-screen and Install buttons are gone",
		"In the Pcalc app: emulator sync is on from the start and connects to RetroArch by itself"
	]},
	{version: "1.11", notes: [
		"Arcs end with their boss: what comes after a gym leader is in the next arc (Route 9, Rock Tunnel, Morty and Route 8 lead up to Erika)",
		"50 route trainers that were missing, with the moves the game gives them (Rock Tunnel's Hikers Lucas, Allen and Dudley among them)",
		"Mastersheet \u2192 Reorder: \u25B2 / \u25BC now carry a trainer past boss fights, and each place has a menu to move all its trainers before another fight. Copy order changes sends your order in",
		"Copy AI report (beside What's new): when the trainer's AI did something else than predicted, it copies the fight as it stands to send in"
	], fixes: [
		"Route 10 comes on both sides of Rock Tunnel, and the S.S. Anne's sailors with the rest of the ship"
	]},
	{version: "1.12", notes: [
		"Turn (beside the foe's moves): tell the trainer's AI what has happened this battle. Tap the move each side used last turn " +
			"and tick what applies: a Choice lock, Encore, Disable, Taunt, Protects in a row, a Substitute, Yawn, Perish Song, " +
			"recharging, locked into Outrage and more",
		"The AI switches out of Yawn and on Perish Song's last turn, stays in behind a Substitute or with Destiny Bond up, " +
			"and won't use a status move into your Substitute",
		"Emulator sync sends the battle's history too, so Turn fills itself in (sync script 2: fetch the script again)",
		"Minimal Grinding (Settings; set by importing your .sav): with it on the game gives trainers' Pok\u00e9mon no EVs, and so does the calc now"
	], fixes: [
		"70 boss Pok\u00e9mon had EVs a few points off the game's (4 Def where it has 6 HP); Falkner's Rufflet and Brock's Onix were missing theirs",
		"Hardcore: the route trainers added in 1.11 had EVs the game does not give them"
	]},
	{version: "1.13", notes: [
		"Double battles, a first version: Doubles (beside Turn) shows both Pok\u00e9mon on each side, and for each of the trainer's two how " +
			"often it uses each move on each of yours, with the damage. Pick who is out beside the two in the calculator",
		"In a double battle the chances on Battle are the doubles ones. Not predicted yet: switching, and moves aimed at its own partner"
	]},
	{version: "1.14", notes: [
		"Double battles: status moves follow the doubles rules. Trick Room when its side is the slower one, Fake Out on the bigger threat, " +
			"Protect and Wide Guard (from its own partner's Earthquake too), Follow Me, Tailwind, Icy Wind and the like for speed control, " +
			"a sleep move on both of yours, and no repeating what its partner is already doing"
	]},
	{version: "1.15", notes: [
		"Emulator sync follows double battles: the Pok\u00e9mon beside each one come from the game, with their HP, status, stat changes and history",
		"Double battles: the trainer's Pok\u00e9mon can switch out (to absorb your move, when its moves do nothing to either of yours, " +
			"asleep, Yawn, Leech Seed, lowered attacking stats), shown in Doubles and on Battle"
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
	// The original calculator's links to Pokémon Showdown's site (Home, Replays, Ladder, Forum) aren't the app's.
	$(".header .nav a[href*='pokemonshowdown.com']").closest("li").remove();
});

var LAST_CHANGELOG_KEY = "lastChangelogVersion";

var CREDITS = [
	"Original calculator by Honko, maintained by Austin and Kris; Radical Red edition by Karthik.",
	"Team/Box, color coding, crit chances, Range Compare, Export All and more ported from SylmarDev's syl-rnb-calc (MIT).",
	"Pokémon sprites from May8th1995/sprites; trainer pictures from Pokémon Showdown; Professor Oak from " +
		"smogon/sprites; item icons from PokéAPI's sprites (CC0). All are kept with the calculator.",
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
	// Normal Mode: Minimal Grinding, which takes the EVs off every trainer's Pokémon (trainer_controls.js).
	if (typeof isMinimalGrindingOn === "function" && getPageMode() === "normal" && typeof TRAINER_ORDER !== "undefined" && TRAINER_ORDER.length) {
		$('<label title="The choice you made when the game started. With it on, trainers\' Pok\u00e9mon have no EVs. Importing your .sav sets it."></label>')
			.append($('<input type="checkbox" id="minimal-grinding" />').prop("checked", isMinimalGrindingOn()).change(function () {
				writeSetting(MINIMAL_GRINDING_KEY, this.checked);
				window.location.reload();
			}), " Minimal Grinding (trainers have no EVs)").appendTo(panel);
	}
	panel.append(
		$('<button type="button" id="show-changelog">What\'s new</button>').click(showChangelog),
		" ",
		$('<button type="button" id="show-credits">Credits</button>').click(showCredits));
	// A wrong prediction from the trainer's AI: the fight as it stands, to send in.
	if (typeof copyAIReport === "function" && typeof TRAINER_ORDER !== "undefined" && TRAINER_ORDER.length) {
		panel.append(" ", $('<button type="button" id="copy-ai-report" title="A prediction was wrong? This copies the fight as it stands now (both Pok\u00e9mon, HP, the field, what was predicted) to send in.">Copy AI report</button>')
			.click(function () {
				copyAIReport($(this));
			}));
	}
	$(".credits").append(panel);
	if (readSetting(LAST_CHANGELOG_KEY) !== getLatestVersion()) showChangelog();
});
