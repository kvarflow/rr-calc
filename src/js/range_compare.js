/*
 * Range Compare, after SylmarDev's syl-rnb-calc (MIT). Pick a target, add moves from the
 * other side with the "+" next to each damage result, and see how much HP the target has
 * left after all of them: a chart of every outcome, the chance it survives, and the chance
 * its HP ends at, above or below a value. Each move counts its normal and critical rolls
 * (weighted by its crit chance), and the target's berry or Leftovers heals between hits.
 */

var RC_ITEMS = {
	none: {label: "No item"},
	oran: {label: "Oran Berry", at: 1 / 2, heal: function () {
		return 10;
	}},
	sitrus: {label: "Sitrus Berry", at: 1 / 2, heal: function (max) {
		return Math.floor(max / 4);
	}},
	pinch: {label: "Figy / Iapapa / ... Berry", at: 1 / 4, heal: function (max) {
		return Math.floor(max / 3);
	}},
	leftovers: {label: "Leftovers", every: true, heal: function (max) {
		return Math.max(1, Math.floor(max / 16));
	}}
};

var rangeCompare = {target: "p2", moves: []};

// All the totals a damage result can deal, one entry per equally likely roll.
function getDamageRolls(damage) {
	if (typeof damage === "number") return [damage];
	if (typeof damage[0] === "number" && damage.length > 2) return damage.slice();
	if (typeof damage[0] === "number") return [damage[0] + (damage[1] || 0)]; // fixed damage in two hits
	// Two parts (Parental Bond, or a hit and its follow-up): every combination.
	var rolls = [];
	var first = typeof damage[0] === "number" ? [damage[0]] : damage[0];
	var second = typeof damage[1] === "number" ? [damage[1]] : damage[1];
	first.forEach(function (a) {
		second.forEach(function (b) {
			rolls.push(a + b);
		});
	});
	return rolls;
}

// Damage -> probability for one move, mixing normal and critical rolls.
function getMoveDistribution(move) {
	var dist = {};
	var add = function (rolls, weight) {
		rolls.forEach(function (roll) {
			dist[roll] = (dist[roll] || 0) + weight / rolls.length;
		});
	};
	add(move.rolls, 1 - move.critChance);
	if (move.critChance > 0) add(move.critRolls, move.critChance);
	return dist;
}

// HP left -> probability after every added move, healing as the item allows.
function getHealthDistribution(moves, currentHP, maxHP, itemKey) {
	var item = RC_ITEMS[itemKey] || RC_ITEMS.none;
	var states = {};
	states[currentHP + "|0"] = 1; // "HP|berry eaten"
	moves.forEach(function (move) {
		var dist = getMoveDistribution(move);
		var next = {};
		Object.keys(states).forEach(function (key) {
			var hp = parseInt(key);
			var eaten = key.slice(-1) === "1";
			Object.keys(dist).forEach(function (damage) {
				var left = Math.max(0, hp - damage);
				var nowEaten = eaten;
				if (left > 0 && item.every) {
					left += item.heal(maxHP);
				} else if (left > 0 && item.at && !eaten && left <= Math.floor(maxHP * item.at)) {
					left += item.heal(maxHP);
					nowEaten = true;
				}
				var nextKey = Math.min(left, maxHP) + "|" + (nowEaten ? 1 : 0);
				next[nextKey] = (next[nextKey] || 0) + states[key] * dist[damage];
			});
		});
		states = next;
	});
	var health = {};
	Object.keys(states).forEach(function (key) {
		var hp = parseInt(key);
		health[hp] = (health[hp] || 0) + states[key];
	});
	return health;
}

function chanceWhere(health, test) {
	return Object.keys(health).reduce(function (sum, hp) {
		return test(parseInt(hp)) ? sum + health[hp] : sum;
	}, 0);
}

function formatChance(chance) {
	return parseFloat((chance * 100).toFixed(2)) + "%";
}

// The side whose moves hit the target: Pokémon 1's results are on the left.
function getAttackingSide() {
	return rangeCompare.target === "p2" ? "L" : "R";
}

function addRangeMove(side, index) {
	var result = damageResults[side === "L" ? 0 : 1][index];
	if (!result || result.move.category === "Status") return;
	var critMove = result.move.clone();
	critMove.isCrit = true;
	var crit = calc.calculate(gen, result.attacker, result.defender, critMove, result.field);
	var chance = getCritChance(result.attacker, result.defender, result.move, $(side === "L" ? "#focusEnergyL" : "#focusEnergyR").prop("checked"));
	var rolls = getDamageRolls(result.damage);
	rangeCompare.moves.push({
		name: result.attacker.name + " " + result.move.name,
		rolls: rolls,
		critRolls: getDamageRolls(crit.damage),
		critChance: result.move.isCrit ? 0 : chance || 0
	});
	if (rangeCompare.moves.length === 1) resetRangeHP();
	renderRangeCompare();
}

// The target's HP as it is in its panel.
function resetRangeHP() {
	var panel = $("#" + rangeCompare.target);
	$("#rc-current-hp").val(panel.find(".current-hp").val());
	$("#rc-max-hp").val(panel.find(".max-hp").text());
}

function renderRangeMoves() {
	var list = $("#rc-moves").empty();
	if (!rangeCompare.moves.length) {
		list.append('<div class="rc-empty">Add moves with the + next to the damage results above.</div>');
	}
	rangeCompare.moves.forEach(function (move, index) {
		var min = Math.min.apply(null, move.rolls);
		var max = Math.max.apply(null, move.rolls);
		var card = $('<div class="rc-move"></div>');
		$('<span class="rc-move-name"></span>').text((index + 1) + ". " + move.name).appendTo(card);
		$('<span class="rc-move-damage"></span>')
			.text(min + "-" + max + (move.critChance ? " (crit " + formatChance(move.critChance) + ")" : ""))
			.appendTo(card);
		var controls = $('<span class="rc-move-controls"></span>').appendTo(card);
		[["↑", "Hit earlier", -1], ["↓", "Hit later", 1]].forEach(function (button) {
			var to = index + button[2];
			$('<button type="button"></button>').text(button[0]).attr("title", button[1])
				.prop("disabled", to < 0 || to >= rangeCompare.moves.length)
				.click(function () {
					rangeCompare.moves.splice(to, 0, rangeCompare.moves.splice(index, 1)[0]);
					renderRangeCompare();
				}).appendTo(controls);
		});
		$('<button type="button" title="Remove">×</button>').click(function () {
			rangeCompare.moves.splice(index, 1);
			renderRangeCompare();
		}).appendTo(controls);
		list.append(card);
	});
}

// A bar per HP value (or per range of values when there are many), red for fainting.
function renderRangeChart(health, maxHP) {
	var chart = $("#rc-chart").empty();
	if (!rangeCompare.moves.length) return;
	var values = Object.keys(health).map(Number);
	var low = Math.min.apply(null, values);
	var high = Math.max.apply(null, values);
	var bins = [];
	if (low === 0) bins.push({from: 0, to: 0});
	var start = Math.max(low, 1);
	var width = Math.max(1, Math.ceil((high - start + 1) / 24));
	for (var from = start; from <= high; from += width) bins.push({from: from, to: Math.min(high, from + width - 1)});
	bins.forEach(function (bin) {
		bin.chance = chanceWhere(health, function (hp) {
			return hp >= bin.from && hp <= bin.to;
		});
	});
	var tallest = Math.max.apply(null, bins.map(function (bin) {
		return bin.chance;
	}));
	bins.forEach(function (bin) {
		var label = bin.to === 0 ? "Fainted" : (bin.from === bin.to ? bin.from : bin.from + "-" + bin.to) + " HP";
		$('<div class="rc-bar"></div>')
			.toggleClass("rc-bar-fainted", bin.to === 0)
			.attr("title", label + ": " + formatChance(bin.chance))
			.append($('<div class="rc-bar-fill"></div>').css("height", (tallest ? 100 * bin.chance / tallest : 0) + "%"))
			.append($('<div class="rc-bar-label"></div>').text(bin.to === 0 ? "KO" : bin.from))
			.appendTo(chart);
	});
	$('<div class="rc-chart-axis"></div>').text("HP left (of " + maxHP + ")").appendTo(chart);
}

function renderRangeCompare() {
	$(".rc-add").each(function () {
		$(this).toggle($(this).attr("data-side") === getAttackingSide());
	});
	renderRangeMoves();
	var currentHP = Math.max(0, ~~$("#rc-current-hp").val());
	var maxHP = Math.max(1, ~~$("#rc-max-hp").val());
	var health = getHealthDistribution(rangeCompare.moves, Math.min(currentHP, maxHP), maxHP, $("#rc-item").val());
	renderRangeChart(health, maxHP);
	if (!rangeCompare.moves.length) {
		$("#rc-results").hide();
		return;
	}
	var survives = chanceWhere(health, function (hp) {
		return hp > 0;
	});
	$("#rc-survival").text(formatChance(survives))
		.attr("class", survives >= 1 ? "rc-sure" : survives >= 0.5 ? "rc-likely" : survives > 0 ? "rc-unlikely" : "rc-never");
	var op = $("#rc-op").val();
	var value = ~~$("#rc-value").val();
	var tests = {
		"<=": function (hp) {
			return hp <= value;
		},
		">=": function (hp) {
			return hp >= value;
		},
		"=": function (hp) {
			return hp === value;
		}
	};
	$("#rc-compare-result").text(formatChance(chanceWhere(health, tests[op])));
	$("#rc-results").show();
}

function buildRangeComparePanel() {
	return $(
		'<fieldset id="range-compare">' +
		'<legend align="center">Range Compare</legend>' +
		'<div class="rc-row">Target: ' +
		'<input class="visually-hidden" type="radio" name="rc-target" id="rc-target-p1" value="p1" /><label class="btn btn-wide btn-left" for="rc-target-p1">Pokémon 1</label>' +
		'<input class="visually-hidden" type="radio" name="rc-target" id="rc-target-p2" value="p2" checked="checked" /><label class="btn btn-wide btn-right" for="rc-target-p2">Pokémon 2</label>' +
		'</div>' +
		'<div id="rc-moves"></div>' +
		'<div class="rc-row">HP <input id="rc-current-hp" class="rc-number" type="number" min="0" /> / <input id="rc-max-hp" class="rc-number" type="number" min="1" /> ' +
		'<select id="rc-item" aria-label="Target\'s item"></select></div>' +
		'<div id="rc-chart" class="rc-chart"></div>' +
		'<div id="rc-results">' +
		'<div class="rc-row">Survives: <b id="rc-survival"></b></div>' +
		'<div class="rc-row">Chance HP ends <select id="rc-op"><option value="<=">&le;</option><option value=">=">&ge;</option><option value="=">=</option></select> ' +
		'<input id="rc-value" class="rc-number" type="number" min="0" value="0" />: <b id="rc-compare-result"></b></div>' +
		'</div>' +
		'<div class="rc-row"><button type="button" id="rc-reset-hp">Use panel HP</button> <button type="button" id="rc-clear">Clear all moves</button></div>' +
		'</fieldset>');
}

$(document).ready(function () {
	var panel = buildRangeComparePanel().insertAfter(".poke-import");
	Object.keys(RC_ITEMS).forEach(function (key) {
		$("<option></option>").val(key).text(RC_ITEMS[key].label).appendTo("#rc-item");
	});
	// A "+" beside each result row, after its Crit button.
	$(".small-crit-btn").each(function () {
		var suffix = $(this).attr("for").slice(7); // "L1"
		$('<button type="button" class="rc-add" title="Add to Range Compare">+</button>')
			.attr({"data-side": suffix[0], "data-index": suffix[1] - 1})
			.click(function () {
				addRangeMove($(this).attr("data-side"), +$(this).attr("data-index"));
			})
			.insertAfter(this);
	});
	panel.find("input[name='rc-target']").change(function () {
		rangeCompare.target = this.value;
		rangeCompare.moves = [];
		resetRangeHP();
		renderRangeCompare();
	});
	panel.find("#rc-current-hp, #rc-max-hp, #rc-value").on("input", renderRangeCompare);
	panel.find("#rc-item, #rc-op").change(renderRangeCompare);
	$("#rc-reset-hp").click(function () {
		resetRangeHP();
		renderRangeCompare();
	});
	$("#rc-clear").click(function () {
		rangeCompare.moves = [];
		renderRangeCompare();
	});
	// Until a move is added, follow the target's HP as its panel changes.
	$(document).on("calc:done", function () {
		if (!rangeCompare.moves.length) resetRangeHP();
	});
	resetRangeHP();
	renderRangeCompare();
});
