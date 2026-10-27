/*
 * The games this calculator covers. Each has the generation whose mechanics (and base data) it
 * follows, its modes, and which of the calculator's features it has data for. A mode is one page
 * ("normal.html"), whose mode id is also where that mode's box, KOs and settings are saved, so a
 * mode id is never reused: Radical Red's are "normal" and "hardcore", as before there were others.
 *
 * A game's own Pokémon, moves, abilities and items (`data`, from its ROM: rr-rom's extractors) go
 * on top of its generation's own with calc.setGameData before the page starts. Radical Red's are
 * gen 9's built-in data.
 *
 * Features (each module checks its own with hasGameFeature):
 *  - saveImport: the save format the .sav import reads ("cfru": Radical Red's).
 *  - trainerAI: the battle AI the likely-move port follows ("cfru").
 *  - encounters: wild encounter data (the Encounters tab, Nuzlocke dupes).
 *  - abilityText / itemText: the game's own ability and item descriptions.
 *  - trainers: boss fights in game order with level caps (the trainer panel and progress).
 *
 * A game whose status is "planned" has no pages yet: the game picker lists it as coming soon.
 */

var GAMES = [
	{
		id: "radicalred",
		name: "Radical Red",
		version: "4.1",
		title: "Pok\u00e9mon Radical Red Damage Calculator",
		links: {dex: "//dex.radicalred.net", play: "//play.radicalred.net/"},
		gen: 9,
		engine: "Complete Fire Red Upgrade (FireRed)",
		// Its One vs One page (index.html) uses its data.
		oneVsOne: true,
		status: "ready",
		modes: [
			{id: "normal", label: "Normal Mode", page: "normal", sets: "normal", trainers: "normal"},
			{id: "hardcore", label: "Hardcore Mode", page: "hardcore", sets: "hardcore", trainers: "hardcore"}
		],
		features: {saveImport: "cfru", trainerAI: "cfru", encounters: true, abilityText: true, itemText: true, trainers: true}
	},
	{
		id: "runbun",
		name: "Run & Bun",
		// pokeemerald-expansion: the generation its battle settings follow comes from the ROM.
		gen: 8,
		engine: "pokeemerald-expansion (Emerald)",
		status: "planned",
		modes: [{id: "runbun", label: "Run & Bun", page: "runbun"}],
		features: {}
	},
	{
		id: "emeraldkaizo",
		name: "Emerald Kaizo",
		gen: 3,
		engine: "pokeemerald (Emerald)",
		status: "planned",
		modes: [{id: "emeraldkaizo", label: "Emerald Kaizo", page: "emeraldkaizo"}],
		features: {}
	},
	{
		id: "platinumkaizo",
		name: "Platinum Kaizo",
		gen: 4,
		engine: "Platinum (DS)",
		status: "planned",
		modes: [{id: "platinumkaizo", label: "Platinum Kaizo", page: "platinumkaizo"}],
		features: {}
	}
];

function getGame(id) {
	for (var i = 0; i < GAMES.length; i++) {
		if (GAMES[i].id === id) return GAMES[i];
	}
	return null;
}

// The game a mode belongs to, and that mode.
function findGameMode(modeId) {
	for (var i = 0; i < GAMES.length; i++) {
		for (var j = 0; j < GAMES[i].modes.length; j++) {
			if (GAMES[i].modes[j].id === modeId) return {game: GAMES[i], mode: GAMES[i].modes[j]};
		}
	}
	return null;
}

// The game this page is for: its <html data-game>, else the game of its mode. The One vs One page
// is Radical Red's.
function getCurrentGame() {
	var id = document.documentElement.getAttribute("data-game");
	if (id && getGame(id)) return getGame(id);
	var found = typeof getPageMode === "function" ? findGameMode(getPageMode()) : null;
	return found ? found.game : GAMES[0];
}

function hasGameFeature(name) {
	return !!getCurrentGame().features[name];
}

// The modes of this page's game, as {id: label}: where a box can move between.
function getGameModeLabels() {
	var labels = {};
	getCurrentGame().modes.forEach(function (mode) {
		labels[mode.id] = mode.label;
	});
	return labels;
}

/*
 * The game picker, beside the mode buttons (under More on small screens): opens the game's first
 * mode. Games still to come are listed, greyed out.
 */
function buildGamePicker() {
	var current = getCurrentGame();
	var select = $('<select id="game-picker" aria-label="Game"></select>');
	GAMES.forEach(function (game) {
		var ready = game.status === "ready";
		select.append($("<option></option>").val(game.id).prop("disabled", !ready)
			.text(game.name + (ready ? "" : " (coming soon)")));
	});
	select.val(current.id).change(function () {
		var game = getGame($(this).val());
		if (!game || game === current) return;
		if (typeof navigateToMode === "function") navigateToMode(game.modes[0].id);
		else window.location.href = game.modes[0].page + linkExtension;
	});
	return $('<span class="gameSelection" title="Choose the game"></span>').append(select);
}

$(document).ready(function () {
	if ($(".modeSelection").length) buildGamePicker().insertBefore(".modeSelection");
});
