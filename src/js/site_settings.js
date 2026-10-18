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
var CHANGELOG = [
	{version: "1.0", notes: [
		"Team / Box / Box 2 / Trash panel with sprites, kept separately for Normal and Hardcore Mode",
		"Import your party and PC boxes from a Radical Red .sav file",
		"Matchup color coding for your box against Pokémon 2"
	]},
	{version: "1.1", notes: [
		"Previous / Next Trainer through every boss fight, with Professor Oak to start a new run",
		"The rival's team follows your starter; boss battle effects are set on the Field"
	]},
	{version: "1.2", notes: [
		"Trainer data checked against the game itself",
		"Sprites that load on every site"
	]},
	{version: "1.3", notes: [
		"Battle effects (Brock's sand, Lt. Surge's terrain...) are locked for the whole fight",
		"KO'd and Defeated tracking with level-cap arc and game progress bars",
		"Fight Notes, and the custom set box folds away"
	]},
	{version: "1.4", notes: [
		"Trick Room and Focus Energy on the Field",
		"Each move's crit chance, and Crit buttons on the damage results",
		"Range Compare: how much HP a Pokémon has left after several hits",
		"Export All, click the damage rolls to copy them, Escape clears the box search",
		"Fold away parts of the Pokémon panels; save base stat and type overrides",
		"\"Base form\" for a trainer's Mega before it Mega Evolves",
		"Trainer above Pokémon 2, and these settings",
		"A trainer's weather and terrain (Thwackey's Grassy Surge) stay up when it switches out",
		"A note when Simple or Contrary changes how stat boosts add up",
		"Every rival fight has his team for each starter, taken from the game",
		"Importing a .sav sets your starter and locks it until Professor Oak starts a new run",
		"Swamp battle effects quarter your Pokémon's Speed; each rival team has its own battle effect"
	]},
	{version: "1.5", notes: [
		"Small-screen layout for a handheld's second screen, such as the AYN Thor's lower screen: " +
			"tabs for Results, You, Foe, Field, Box and More, with both sides' moves on one screen " +
			"and tap-to-switch strips of your team and the trainer's",
		"It turns on by itself on small screens; Layout in the footer settings forces it on or off",
		"Pokémon from your .sav keep the save's type, stats, level and ability, locked " +
			"(\"Edit anyway\" unlocks them); stat stages are now \u2212 / + buttons",
		"Color coding is on unless you turn it off, and shows on your team in the small layout",
		"Works offline: once opened online, the calculator keeps working with no connection " +
			"(the footer settings say when it is ready)",
		"A ? beside each Pokémon's ability says what it does, in Radical Red's own words where the game has them",
		"Phones get the same tabbed layout: held upright, the tabs sit at the bottom within thumb reach",
		"On the Thor and phones, a Wild tab lists every location's wild Pokémon by method, " +
			"day and night, read from the game; it opens where your next trainer is"
	]},
	{version: "1.6", notes: [
		"Wild tab: places in the order you reach them, and grass beside fishing, then surfing; " +
			"tick Nuzlocke for one encounter per location, " +
			"filled in from where your .sav's Pokémon were caught, with dupes (anything in a caught " +
			"Pokémon's evolution family) blacked out",
		"Small layout: Results is now Battle, where you can drag your team into order, KO the trainer's " +
			"Pokémon and go on to the next trainer",
		"You and Foe each fit one screen, with a slimmer HP bar; the trainer, Professor Oak and the " +
			"progress bars move to Advanced (was Field), now in clear sections",
		"Wild shows the Pokémon first, with its options under them; More has sliding selectors for " +
			"the mode and the notation, lower down with the other settings",
		"Double-tap a move on Battle to make it a crit (and again to undo); the small layout is red " +
			"now, with other accent colors under More"
	], fixes: [
		"A trainer's Hidden Power could change type after its first load (Catcher Sammy's Volbeat " +
			"showed Hidden Power Rock instead of Bug, a third of its damage to Grass types)",
		"A Basculin from your .sav is the right stripe, with its own abilities, and Pumpkaboo and " +
			"Gourgeist keep their size"
	]},
	{version: "1.7", notes: [
		"Battle updates the moment you change something on You, Foe, Box or Advanced, and the move you " +
			"tapped stays shown",
		"Fainted (on your team's card) and KOs credited to your Pokémon in Pokémon 1; Advanced's " +
			"This run card shows your top fraggers, the fallen, your personal best and past runs",
		"Swipe left or right to change tabs; Text size under More",
		"Install it as an app (More \u2192 Install, or Add to Home screen): full screen, offline, " +
			"opening on the mode you used last",
		"The foe's move that hits you hardest is marked on Battle, tagged KO when it can knock you out"
	], fixes: [
		"Typing HP on an on-screen keyboard (the Thor's, a phone's) did not update the results until " +
			"you left the field",
		"Loading a Pokémon from the Box recalculated many times over"
	]},
	{version: "1.8", notes: [
		"Trainer AI: on Battle, each of the foe's moves shows how often the trainer picks it, from " +
			"Radical Red's own battle AI (Complete Fire Red Upgrade's), with each trainer's AI level and " +
			"every move's data read from the game",
		"The likeliest move gets the red stripe, tagged KO when it can knock you out"
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

// Newest first; a version's bug fixes under their own heading.
function showChangelog() {
	var sections = [];
	CHANGELOG.slice().reverse().forEach(function (entry) {
		sections.push({heading: "Version " + entry.version, items: entry.notes});
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
