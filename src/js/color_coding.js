/*
 * Matchup color coding, ported from SylmarDev's syl-rnb-calc (MIT).
 *
 * Each box sprite (and, optionally, the sprite in the Pokémon 1 header) is compared
 * against the current Pokémon 2 by running all four moves both ways on the current field:
 *  - Border: is it faster than, tied with, or slower than Pokémon 2 (Speed stat only).
 *  - Background, left half: can it OHKO Pokémon 2 (green: every roll, yellow: some rolls).
 *  - Background, right half: can Pokémon 2 OHKO it (red: every roll, orange: some rolls).
 *  - Whole background blue instead when it "walls" Pokémon 2: Pokémon 2's best max roll
 *    is under a third of its HP (so at worst a 4HKO) and its own best move does more
 *    (light blue if that best move can also OHKO).
 * Percentages are of full HP; crits, priority, Sturdy/Focus Sash and current HP are not
 * considered, so the colors are a guide only.
 */

var MATCHUP_CLASSES = [
	"cc-speed-faster", "cc-speed-tie", "cc-speed-slower",
	"cc-deal-always", "cc-deal-might", "cc-take-always", "cc-take-might",
	"cc-wall", "cc-hard-counter"
].join(" ");

// Best-case and worst-case OHKO information for one side's four moves.
function summarizeDamage(results, defender) {
	var summary = {alwaysOHKO: false, mightOHKO: false, bestMaxPercent: 0};
	results.forEach(function (result) {
		var range = result.range();
		var hits = result.move.hits || 1;
		var minPercent = range[0] * hits / defender.stats.hp * 100;
		var maxPercent = range[1] * hits / defender.stats.hp * 100;
		summary.alwaysOHKO = summary.alwaysOHKO || minPercent >= 100;
		summary.mightOHKO = summary.mightOHKO || maxPercent >= 100;
		summary.bestMaxPercent = Math.max(summary.bestMaxPercent, maxPercent);
	});
	return summary;
}

// Returns {speed: class, damage: [classes]} for `pokemon` against `opponent`.
function getMatchupClasses(pokemon, opponent) {
	var field = createField();
	// calculateAllMoves comes from index_randoms_controls.js. It applies the "+1 all stats"
	// toggles by mutating both Pokémon, so callers must pass fresh objects.
	var results = calculateAllMoves(gen, pokemon, field, opponent, field.clone().swap());
	pokemon = results[0][0].attacker;
	opponent = results[1][0].attacker;

	var ownSpeed = pokemon.stats.spe;
	var opponentSpeed = opponent.stats.spe;
	var speed = ownSpeed > opponentSpeed ? "cc-speed-faster" :
		ownSpeed === opponentSpeed ? "cc-speed-tie" : "cc-speed-slower";

	var dealt = summarizeDamage(results[0], opponent);
	var taken = summarizeDamage(results[1], pokemon);
	if (taken.bestMaxPercent * 3 < 100 && dealt.bestMaxPercent > taken.bestMaxPercent) {
		return {speed: speed, damage: [dealt.bestMaxPercent > 100 ? "cc-hard-counter" : "cc-wall"]};
	}
	var damage = [];
	if (dealt.alwaysOHKO) damage.push("cc-deal-always");
	else if (dealt.mightOHKO) damage.push("cc-deal-might");
	if (taken.alwaysOHKO) damage.push("cc-take-always");
	else if (taken.mightOHKO) damage.push("cc-take-might");
	return {speed: speed, damage: damage};
}

function applyMatchupClasses(element, pokemon, opponent) {
	element.removeClass(MATCHUP_CLASSES);
	var classes;
	try {
		classes = getMatchupClasses(pokemon, opponent);
	} catch (e) {
		// A set the calc cannot handle (e.g. an unknown move) is left uncolored.
		return;
	}
	if ($("#cc-speed-border").prop("checked")) element.addClass(classes.speed);
	if ($("#cc-ohko-color").prop("checked")) element.addClass(classes.damage.join(" "));
}

function isColorCodingShown() {
	return $("#cc-controls").hasClass("cc-shown");
}

function colorCodeBox() {
	if (!isColorCodingShown()) return;
	var opponent = createPokemon($("#p2"));
	$("#box-panel .box-pokemon").each(function () {
		applyMatchupClasses($(this), createPokemon($(this).attr("data-set-id")), opponent.clone());
	});
}

function colorCodeHeader() {
	var header = $("#p1-header-sprite");
	if (!isColorCodingShown() || !$("#cc-mon-header").prop("checked")) {
		header.removeClass(MATCHUP_CLASSES);
		return;
	}
	applyMatchupClasses(header, createPokemon($("#p1")), createPokemon($("#p2")));
}

function refreshColorCoding() {
	colorCodeBox();
	colorCodeHeader();
}

function clearColorCoding() {
	$("#box-panel .box-pokemon, #p1-header-sprite").removeClass(MATCHUP_CLASSES);
}

/*
 * Recolors after the inputs change. One change (e.g. picking a set) fires dozens of input
 * events, and each recolor runs 8 damage calcs per Pokémon, so the events are merged into
 * one recolor that runs after the calc's own handlers have updated the inputs.
 */
var colorRefreshPending = false;

function scheduleColorRefresh() {
	if (colorRefreshPending) return;
	colorRefreshPending = true;
	setTimeout(function () {
		colorRefreshPending = false;
		if ($("#cc-auto-refresh").prop("checked")) colorCodeBox();
		colorCodeHeader();
	}, 0);
}

function updatePokemon1HeaderSprite() {
	var setId = $("#p1 input.set-selector").val() || "";
	var pokemonName = setId.indexOf(" (") === -1 ? setId : getPokemonName(setId);
	var header = $("#p1-header-sprite").empty();
	if (!calc.SPECIES[gen][pokemonName]) return;
	header.append($("<img />").attr({src: getSpriteUrl(pokemonName), alt: pokemonName}).on("error", function () {
		$(this).remove();
	}));
}

function buildColorCodingControls() {
	return $(
		'<div id="cc-controls">' +
		'<div class="box-section-label">Color Coding</div>' +
		'<div class="cc-buttons">' +
		'<button type="button" id="cc-toggle">Show color coding</button> ' +
		'<button type="button" id="cc-refresh" class="cc-when-shown">Refresh</button> ' +
		'<button type="button" id="cc-explain" class="cc-when-shown">Color code explanation</button>' +
		'</div>' +
		'<div class="cc-when-shown cc-options">' +
		'<label><input type="checkbox" id="cc-speed-border" checked /> Speed border</label> ' +
		'<label><input type="checkbox" id="cc-ohko-color" checked /> OHKO color</label> ' +
		'<label><input type="checkbox" id="cc-auto-refresh" /> Auto-refresh</label> ' +
		'<label><input type="checkbox" id="cc-mon-header" checked /> Color Coding Mon Header</label>' +
		'</div>' +
		'<div id="cc-explanation" class="cc-explanation">' +
		'<p>Every Pok&eacute;mon in the box is compared against the current Pok&eacute;mon 2.</p>' +
		'<b>Border (Speed)</b>' +
		'<ul>' +
		'<li><span class="cc-swatch cc-speed-faster"></span> Faster</li>' +
		'<li><span class="cc-swatch cc-speed-tie"></span> Speed tie</li>' +
		'<li><span class="cc-swatch cc-speed-slower"></span> Slower</li>' +
		'</ul>' +
		'<b>Background (left half: you hit them, right half: they hit you)</b>' +
		'<ul>' +
		'<li><span class="cc-swatch cc-deal-always"></span> Always OHKOs</li>' +
		'<li><span class="cc-swatch cc-deal-might"></span> Might OHKO</li>' +
		'<li><span class="cc-swatch cc-take-always"></span> Always gets OHKO\'d</li>' +
		'<li><span class="cc-swatch cc-take-might"></span> Might get OHKO\'d</li>' +
		'<li><span class="cc-swatch cc-wall"></span> Walls (takes a 4HKO at worst and does more damage)</li>' +
		'<li><span class="cc-swatch cc-hard-counter"></span> Hard counter (walls and may OHKO)</li>' +
		'</ul>' +
		'<p>The Mon Header option applies the same colors to the sprite next to &quot;Pok&eacute;mon 1&quot;. ' +
		'Crits, priority, Sturdy/Focus Sash and current HP are not considered.</p>' +
		'</div>' +
		'</div>'
	);
}

function bindColorCodingEvents() {
	$("#cc-toggle").click(function () {
		var shown = !isColorCodingShown();
		$("#cc-controls").toggleClass("cc-shown", shown);
		$(this).text(shown ? "Hide color coding" : "Show color coding");
		if (shown) {
			refreshColorCoding();
		} else {
			clearColorCoding();
			$("#cc-auto-refresh").prop("checked", false);
		}
	});
	$("#cc-refresh").click(refreshColorCoding);
	$("#cc-explain").click(function () {
		$("#cc-explanation").toggle();
	});
	$("#cc-speed-border, #cc-ohko-color").change(refreshColorCoding);
	$("#cc-mon-header").change(colorCodeHeader);

	$(document).on("change keyup", ".calc-trigger", scheduleColorRefresh);
	$("#p1 input.set-selector").change(updatePokemon1HeaderSprite);
	$(document).on("box:rendered", function () {
		if ($("#cc-auto-refresh").prop("checked")) colorCodeBox();
	});
}

$(document).ready(function () {
	$("#p1 > legend").append(' <span id="p1-header-sprite" class="header-sprite"></span>');
	$("#box-tools").append(buildColorCodingControls());
	bindColorCodingEvents();
	updatePokemon1HeaderSprite();
});
