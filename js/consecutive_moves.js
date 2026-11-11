/*
 * Moves that get stronger each turn in a row: pick which use this is and the base power follows,
 * as Radical Red works it out (CFRU): Echoed Voice +40 a use up to 200, Fury Cutter doubles up to
 * 160, Rollout and Ice Ball double over their 5 hits (and double again after Defense Curl).
 */

var CONSECUTIVE_MOVES = {
	"Echoed Voice": {uses: 5, power: function (bp, use) {
		return Math.min(200, bp + 40 * (use - 1));
	}},
	"Fury Cutter": {uses: 4, power: function (bp, use) {
		return Math.min(160, bp * Math.pow(2, use - 1));
	}},
	"Rollout": {uses: 5, defenseCurl: true, power: function (bp, use, curled) {
		return bp * Math.pow(2, use - 1) * (curled ? 2 : 1);
	}},
	"Ice Ball": {uses: 5, defenseCurl: true, power: function (bp, use, curled) {
		return bp * Math.pow(2, use - 1) * (curled ? 2 : 1);
	}}
};
var USE_LABELS = ["1st use", "2nd in a row", "3rd in a row", "4th in a row", "5th in a row"];

function getConsecutiveBasePower(moveName, choice) {
	var info = CONSECUTIVE_MOVES[moveName];
	var move = calc.MOVES[gen][moveName];
	var bp = move ? move.bp : 0;
	var use = parseInt(choice) || 1;
	return info.power(bp, use, /c$/.test(choice));
}

function updateConsecutiveSelect(moveGroup) {
	var moveName = moveGroup.children("select.move-selector").val();
	var select = moveGroup.children(".move-uses");
	var info = CONSECUTIVE_MOVES[moveName];
	if (!info) {
		select.hide();
		return;
	}
	select.empty();
	[false, true].forEach(function (curled) {
		if (curled && !info.defenseCurl) return;
		for (var use = 1; use <= info.uses; use++) {
			var value = use + (curled ? "c" : "");
			select.append($("<option></option>").val(value).text(
				USE_LABELS[use - 1] + (curled ? ", Defense Curl" : "") + " (" + getConsecutiveBasePower(moveName, value) + ")"));
		}
	});
	select.val("1").show();
}

$(document).ready(function () {
	$(".poke-info select.move-selector").each(function () {
		var moveGroup = $(this).parent();
		var select = $('<select class="move-uses" title="How many turns in a row has this move been used, this turn included?"></select>')
			.hide()
			.change(function () {
				var moveName = moveGroup.children("select.move-selector").val();
				if (!CONSECUTIVE_MOVES[moveName]) return;
				moveGroup.children(".move-bp").val(getConsecutiveBasePower(moveName, $(this).val())).change();
			});
		var after = moveGroup.children(".metronome");
		if (after.length) select.insertAfter(after);
		else select.appendTo(moveGroup);
		// After the calculator's own handler, which sets the move's base power.
		$(this).change(function () {
			updateConsecutiveSelect(moveGroup);
		});
		updateConsecutiveSelect(moveGroup);
	});
});
