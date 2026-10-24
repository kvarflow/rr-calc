/*
 * Critical hits, ported from SylmarDev's syl-rnb-calc (MIT). Each move's Crit button shows
 * the chance that move crits (click it to toggle Crit), and every result row at the top gets
 * a Crit button of its own, kept in step with the move's.
 *
 * Chances use the Gen 7+ table Radical Red follows: 1/24, 1/8, 1/2, then always, by stage.
 */

var CRIT_STAGE_CHANCES = [1 / 24, 1 / 8, 1 / 2, 1];
var SHOW_CRIT_RATES_KEY = "showCritRates";
// Moves with a raised critical hit ratio (+1 stage).
var HIGH_CRIT_MOVES = [
	"Aeroblast", "Air Cutter", "Aqua Cutter", "Attack Order", "Blaze Kick", "Crabhammer",
	"Cross Chop", "Cross Poison", "Dire Claw", "Drill Run", "Esper Wing", "Ivy Cudgel",
	"Karate Chop", "Leaf Blade", "Night Slash", "Poison Tail", "Psycho Cut", "Razor Leaf",
	"Razor Shell", "Razor Wind", "Shadow Claw", "Sky Attack", "Slash", "Snipe Shot",
	"Spacial Rend", "Stone Edge", "Triple Arrows"
];
var CRIT_BLOCKING_ABILITIES = ["Battle Armor", "Shell Armor"];
var MOLD_BREAKER_ABILITIES = ["Mold Breaker", "Teravolt", "Turboblaze"];

function isCritRateShown() {
	return readSetting(SHOW_CRIT_RATES_KEY) !== "false";
}

// The chance (0-1) that `attacker`'s move crits `defender`, or null for status moves.
function getCritChance(attacker, defender, move, focusEnergy) {
	if (!move || move.name === "(No Move)" || move.category === "Status") return null;
	var blocked = CRIT_BLOCKING_ABILITIES.indexOf(defender.ability) !== -1 &&
		MOLD_BREAKER_ABILITIES.indexOf(attacker.ability) === -1;
	if (blocked) return 0;
	// A forced Crit, an always-crit move (Frost Breath...), or Merciless against poison.
	if (move.isCrit || (attacker.ability === "Merciless" && /^(psn|tox)$/.test(defender.status))) return 1;
	var stage = 0;
	if (HIGH_CRIT_MOVES.indexOf(move.originalName || move.name) !== -1) stage++;
	if (attacker.item === "Scope Lens" || attacker.item === "Razor Claw") stage++;
	if (attacker.ability === "Super Luck") stage++;
	if (/^(Farfetch’d|Sirfetch’d)/.test(attacker.name) && (attacker.item === "Leek" || attacker.item === "Leek Stick")) stage += 2;
	if (attacker.name === "Chansey" && attacker.item === "Lucky Punch") stage += 2;
	if (focusEnergy) stage += 2;
	return CRIT_STAGE_CHANCES[Math.min(stage, CRIT_STAGE_CHANCES.length - 1)];
}

function formatCritChance(chance) {
	return chance === null ? "" : parseFloat((chance * 100).toFixed(2)) + "%";
}

function updateCritRates(p1, p2) {
	$(".crit-rate").toggle(isCritRateShown());
	if (!isCritRateShown()) return;
	[["L", p1, p2, "#focusEnergyL"], ["R", p2, p1, "#focusEnergyR"]].forEach(function (side) {
		for (var i = 0; i < 4; i++) {
			var chance = getCritChance(side[1], side[2], side[1].moves[i], $(side[3]).prop("checked"));
			$("#critRate" + side[0] + (i + 1)).text(formatCritChance(chance)).toggle(chance !== null);
		}
	});
}

$(document).ready(function () {
	$(".move-crit").each(function () {
		var suffix = this.id.slice(4); // "L1"
		// The chance, next to the move's own Crit button; clicking it toggles Crit too.
		$('<span class="crit-rate" title="Chance this move lands a critical hit (click to toggle Crit)"></span>')
			.attr("id", "critRate" + suffix)
			.click(function () {
				$("#crit" + suffix).click();
			})
			.insertAfter($(this).next(".crit-btn"));
		// A Crit button on the matching result row at the top.
		$("#resultDamage" + suffix).after(
			$('<input type="checkbox" class="top-crit visually-hidden" />').attr("id", "critTop" + suffix),
			$('<label class="btn small-crit-btn" title="Force this attack to be a critical hit?">Crit</label>').attr("for", "critTop" + suffix));
	});
	// The result row to show once the recalculation a Crit change causes has picked its move.
	var pendingResult = null;
	$(".top-crit").change(function () {
		var suffix = this.id.slice(7);
		var crit = $("#crit" + suffix);
		pendingResult = "#resultMove" + suffix;
		$(pendingResult).prop("checked", true).change();
		if (crit.prop("checked") !== this.checked) crit.prop("checked", this.checked).change();
	});
	$(".move-crit").change(function () {
		$("#critTop" + this.id.slice(4)).prop("checked", this.checked);
	});
	$(document).on("calc:done", function (event, p1, p2) {
		updateCritRates(p1, p2);
		if (pendingResult) {
			$(pendingResult).prop("checked", true).change();
			pendingResult = null;
		}
	});
});
