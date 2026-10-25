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
		"Team / Box / Box 2 / Trash panel with sprites, kept separately for Normal and Hardcore Mode",
		"Import your party and PC boxes from a Radical Red .sav: Pok\u00e9mon keep the save's type, stats, level " +
			"and ability, locked (\"Edit anyway\" unlocks them), and your starter is set from the save",
		"Importing another save of the same game just says how many Pok\u00e9mon came in",
		"Matchup color coding for your box against Pok\u00e9mon 2, on unless you turn it off"
	], fixes: [
		"A Basculin from your .sav is the right stripe, with its own abilities, and Pumpkaboo and " +
			"Gourgeist keep their size"
	]},
	{version: "1.1", notes: [
		"Previous / Next Trainer through every boss fight, checked against the game, with Professor Oak to " +
			"start a new run",
		"Every rival fight has his team for each starter, taken from the game, with its own battle effect",
		"Boss battle effects (Brock's sand, Lt. Surge's terrain, swamps quartering Speed...) are set on the Field " +
			"and locked for the fight; a trainer's weather and terrain stay up when it switches out",
		"\"Base form\" for a trainer's Mega before it Mega Evolves"
	], fixes: [
		"A trainer's Hidden Power could change type after its first load (Catcher Sammy's Volbeat " +
			"showed Hidden Power Rock instead of Bug)"
	]},
	{version: "1.2", notes: [
		"Trick Room and Focus Energy on the Field; each move's crit chance and Crit buttons on the damage results",
		"Range Compare: how much HP a Pok\u00e9mon has left after several hits",
		"Export All, click the damage rolls to copy them, Escape clears the box search",
		"Fold away parts of the Pok\u00e9mon panels; save base stat and type overrides; Fight Notes",
		"A ? beside each Pok\u00e9mon's ability says what it does, in Radical Red's own words where the game has them",
		"A note when Simple or Contrary changes how stat boosts add up",
		"Trainer above Pok\u00e9mon 2, and the footer settings"
	]},
	{version: "1.3", notes: [
		"Small-screen layout for a handheld's second screen (the AYN Thor's) and phones: tabs for Battle, You, " +
			"Foe, Advanced, Box, Wild and More, on by itself on small screens (Layout in the footer settings forces it)",
		"Battle: both sides' moves on one screen, drag your team into order, KO the trainer's Pok\u00e9mon and go on " +
			"to the next trainer; double-tap a move to make it a crit",
		"Battle updates the moment you change something on another tab; swipe to change tabs; Text size and " +
			"accent colors under More",
		"Wild tab: every location's wild Pok\u00e9mon by method, day and night, read from the game, in the order " +
			"you reach them; tick Nuzlocke for one encounter per location, filled in from your .sav, with dupes " +
			"blacked out",
		"Works offline once opened online, and installs as an app (full screen, opening on the mode you used last)"
	], fixes: [
		"Typing HP on an on-screen keyboard did not update the results until you left the field",
		"Loading a Pok\u00e9mon from the Box recalculated many times over"
	]},
	{version: "1.4", notes: [
		"Trainer AI: on Battle, each of the foe's moves shows how often the trainer picks it, from Radical " +
			"Red's own battle AI (Complete Fire Red Upgrade's) with every move's data read from the game; the " +
			"likeliest move gets the red stripe, tagged KO when it can knock you out, and the move that hits you " +
			"hardest is marked too",
		"Switching: how often the foe switches out and to whom (the reason in the tooltip), and who it sends " +
			"out next after a KO",
		"Checked line by line against Radical Red's AI code, decompiled from the game: every trainer uses the " +
			"full AI; KOs, the strongest move, set-up (+2 going first, +3 going second), Taunt, screens, " +
			"hazards, Protect, Counter, multi-hit moves, Sucker Punch, Pursuit, Quick Claw and the turn a boss " +
			"Mega Evolves follow the game, including its coin flips (switch checks skipped a quarter of turns, " +
			"Low Sweep's bonus half the time)"
	], fixes: [
		"The Route 22 rival and a few optional trainers were treated as the basic AI",
		"A slower foe used Tackle while the calculator said Low Sweep 100%"
	]},
	{version: "1.5", notes: [
		"KO'd and Defeated tracking with level-cap arc and game progress bars; Fainted and KOs credited to your " +
			"Pok\u00e9mon, with your top fraggers, the fallen, your personal best and past runs",
		"Importing a .sav marks every boss fight you have won as Defeated (the game keeps a flag for each " +
			"trainer beaten), with the team you actually fought, and a save from a new game starts a new run " +
			"with Professor Oak first",
		"Trainers' Pok\u00e9mon whose level follows yours (\"Highest Lv -3\" in the boss documents) take it from " +
			"your highest-level party Pok\u00e9mon in the last .sav; a beaten fight keeps the levels it had",
		"The level cap shown follows your badges or the gym leaders you mark Defeated",
		"\"Skip for now\" on fights you can do before or after a gym (Nugget Bridge to the S.S. Anne around " +
			"Misty, Route 9 to the Celadon gym around Lt. Surge, the rematches around Sabrina): Previous / Next " +
			"bring it up after the rest of its group, at the cap after the gym",
		"Teams the documents leave out, read from the game: Bugsy's after Lt. Surge (picked by your Thunder " +
			"Badge), and the three teams Jasmine (Default) and Pryce (Hardcore) pick from at random"
	], fixes: [
		"KOs and fainting stay with a Pok\u00e9mon after you change its nature or ability"
	]},
	{version: "1.6", notes: [
		"Protean: picking a Protean Pok\u00e9mon's move turns it into that move's type, so the other side's moves " +
			"hit it as that type (Misty's Frogadier); Reset type brings its own back. Its own damage already has " +
			"STAB on every move",
		"Nuzlocke dupes last the whole run: a Pok\u00e9mon that fainted, went to the Trash, was deleted or was " +
			"released still makes its family a dupe until Professor Oak starts a new run",
		"Your level is your Team's highest-level Pok\u00e9mon, from a .sav or made by hand; with no Team, the " +
			"cap you are at",
		"The level cap follows the fights you have beaten, story fights included (Archer at Mt. Moon, the first " +
			"Giovanni, Silph Co.), not just badges",
		"Levels that follow yours follow your progress too: a fight you left for later (Bugsy after Lt. Surge) " +
			"comes at the cap you are at, a fight ahead at its own cap, a beaten one keeps the level and cap it was " +
			"beaten at"
	]},
	{version: "1.7", notes: [
		"Trainer AI: the last part of Radical Red's move scoring, checked against the game's code: Reflect and " +
			"Light Screen (+15), Knock Off, flinching moves, stat-lowering attacks (Snarl, Lunge), Explosion, Fake Out, " +
			"Shed Tail, burns, paralysis and poison (with Hex and Venoshock), Sheer Force and Serene Grace chances, " +
			"draining moves, Rest and Wish, trapping moves and Salt Cure, Defog and Rapid Spin, and many more"
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
