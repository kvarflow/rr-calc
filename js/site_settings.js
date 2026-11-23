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
		"Team / Box panel and .sav import, with matchup colour coding",
		"Previous / Next through every boss, rival teams per starter, Professor Oak's new run",
		"Crit chances, Range Compare, Export All, Fight Notes and ability info",
		"Small-screen layout for the Thor and phones, the Wild tab, offline and install"
	]},
	{version: "1.1", notes: [
		"Trainer AI: how likely each move is and when the foe switches, with Radical Red's move scoring",
		"KO and fight tracking, run progress, level caps from your save",
		"Protean, consecutive-use moves, box ranking and item info"
	]},
	{version: "1.2", notes: [
		"Every trainer in the order you walk to them, with sprites",
		"Mastersheet, Frag sheet and Dex",
		"Suggested EVs, and genders as in the game",
		"Battle tab: the foe's likely switch-in, and drag between team and Box",
		"Fainted section: your dead stay out after a .sav import",
		"Desktop: a modern look (Classic under Settings)"
	], fixes: [
		"Rivalry against the other gender, Unburden in the box, frostbite and the Toxic counter"
	]},
	{version: "1.3", notes: [
		"Faster: calculations and trainer changes in about half the time, and half as much to load",
		"Backup (Import / Export): everything as one file, to restore here or on another device",
		"Trainer pictures on the Battle tab, item icons, and type badges",
		"Settings \u2192 Theme: Light, Dark or Black (true black, for OLED screens), and the tab bar at the top or the bottom",
		"In the Pcalc app: RetroArch sync built in and on from the start, the save imported by itself each time it changes, and automatic backups"
	], fixes: [
		"Small screens: Rivalry never applied, and Metronome's use count was ignored on the Battle tab"
	]},
	{version: "1.4", notes: [
		"Arcs follow the game's routing and end with their boss (Route 9, Rock Tunnel, Morty and Route 8 lead up to Erika), " +
			"with 50 route trainers that were missing",
		"Mastersheet \u2192 Reorder: move any trainer or boss fight, optional ones included, before another fight; " +
			"it then counts for that arc and level cap. Copy order changes sends your order in",
		"Turn (beside the foe's moves): tell the AI what has happened this battle (Choice lock, Encore, Taunt, Substitute, " +
			"Fly / Dig and more). Emulator sync fills it in, with the benched Pok\u00e9mon's real HP (sync script 2)",
		"Double battles: Doubles (beside Turn) shows how often each of the trainer's two uses each move on each of yours, " +
			"its switches and moves on its own partner, checked against Radical Red's own code",
		"The AI uses the game's ability ratings; Mirror Move and Copycat are scored as the move they copy",
		"Boss Pok\u00e9mon have the game's own EVs and natures; Hardcore and Minimal Grinding give no EVs, as the game does",
		"Copy AI report (beside What's new): when the AI did something else than predicted, send in the fight"
	]},
	{version: "1.5", notes: [
		"Toxic Spikes and Sticky Web on each side of the field (Advanced): the trainer AI's switching reads them. " +
			"Emulator sync fills in both sides' hazards and screens (sync script 3: fetch the script again)",
		"Dex: hold a Pok\u00e9mon on the Wild tab (or right-click it on a computer) for its base stats and evolution line. " +
			"All Pok\u00e9mon lists every one, to find by name or ability, filter by type and sort by any stat",
		"Your dead from the game: every Pok\u00e9mon in Box 25 (Settings \u2192 Dead box), or with the PC marking you choose (Dead marker), " +
			"goes to Fainted when you import your .sav",
		"24 route trainers have the teams the game really gives them (the Sevii Swimmers and Tubers, Red, the rematches)",
		"In the Pcalc app: the calculator updates itself whenever you open the app with a connection, with no new app to install",
		"Small screens: More is tidier. Your save, Emulator sync, Backup and Fight Notes each have a heading, and how they work folds away behind ?. In the Pcalc app, Settings \u2192 Calculator updates shows the version in use, with Check now"
	], fixes: [
		".sav import reads boxes 23 to 25 (they were left out)",
		"Boss Pok\u00e9mon match the game again: Radical Red builds its bosses from tables of its own, and 1.4's EV and nature " +
			"changes had read an older copy. Natures, EVs and abilities now come from the right one, in both modes"
	]},
	{version: "1.6", notes: [
		"Pledge combos on each side of the field (Advanced): Swamp (Grass + Water Pledge) quarters that side's Speed, Sea of Fire " +
			"(Fire + Grass) burns 1/8 a turn, Rainbow (Water + Fire) doubles added effect chances. Who moves first, the colours and " +
			"the trainer AI all count them",
		"Emulator sync fills them in, with how many turns are left (sync script 4: fetch the script again)"
	], fixes: [
		"The route trainers whose teams come from the game's own tables had their levels below your highest wrong"
	]},
	{version: "1.7", notes: [
		"Wild tab: each location's recommended encounter from the run's encounter tracker, starred in the list. " +
			"\"Starter Egg\" means wait until Cerulean City, get the Starter Egg and hatch it there, Fire, Water or Grass as the tracker has it",
		"Plan (beside Day / Night): every recommended encounter in the order you reach them, with what you got there. Tap one to open it",
		"Nuzlocke: Viridian Forest's Expansion is a location of its own, from your .sav too (the Expansion's own Pok\u00e9mon, or one hatched there)"
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

// The latest version only; its bug fixes under their own heading (some versions only fix bugs).
function showChangelog() {
	var sections = [];
	var entry = CHANGELOG[CHANGELOG.length - 1];
	if (entry.notes) sections.push({heading: "Version " + entry.version, items: entry.notes});
	if (entry.fixes) sections.push({heading: "Version " + entry.version + ": bug fixes", items: entry.fixes});
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
	// The PC marking your dead carry, for .sav imports (save_import.js).
	if (typeof DEAD_MARKINGS !== "undefined" && typeof TRAINER_ORDER !== "undefined" && TRAINER_ORDER.length) {
		var marking = $('<select id="dead-marking"></select>');
		DEAD_MARKINGS.forEach(function (m) {
			marking.append($("<option></option>").val(m.key).text(m.label));
		});
		marking.val(readSetting(DEAD_MARKING_KEY) || "").change(function () {
			writeSetting(DEAD_MARKING_KEY, this.value);
		});
		$('<label title="Mark your dead with this marking in the game\'s PC (Summary or the box\'s Mark option): importing your .sav moves them to Fainted."></label>')
			.append("Dead marker (PC marking) ", marking).appendTo(panel);
		var deadBox = $('<select id="dead-box"><option value="0">None</option></select>');
		for (var box = 1; box <= TOTAL_BOXES; box++) deadBox.append($("<option></option>").val(String(box)).text("Box " + box));
		deadBox.val(String(getDeadBox())).change(function () {
			writeSetting(DEAD_BOX_KEY, this.value);
		});
		$('<label title="Every Pok\u00e9mon in this PC box is dead: importing your .sav moves them to Fainted."></label>')
			.append("Dead box ", deadBox).appendTo(panel);
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
