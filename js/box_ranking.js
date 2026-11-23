/*
 * Box ranking (an idea from hzla's Dynamic Calc): the Box and Box 2 in order of how each Pokémon
 * does against the current Pokémon 2 (the most damage dealt, the least damage taken, or the
 * fastest), each with its figure under its sprite. The figures come from the matchups the color
 * coding works out (color_coding.js); "At level cap" works them out as if each were at your
 * level cap, for planning when your box is behind. The Team keeps its own order.
 */

var BOX_RANK_KEY = "boxRank";
var BOX_RANK_CAP_KEY = "boxRankAtCap";
var BOX_RANKS = [
	{key: "", label: "Box order"},
	{key: "dealt", label: "Damage dealt"},
	{key: "taken", label: "Damage taken"},
	{key: "speed", label: "Speed"}
];
var RANKED_SECTIONS = ["box", "box2"];

function getBoxRank() {
	var rank = readSetting(BOX_RANK_KEY) || "";
	return BOX_RANKS.some(function (option) {
		return option.key === rank;
	}) ? rank : "";
}

function getLevelCapForRanking() {
	return typeof getProgressLevelCap === "function" ? parseInt(getProgressLevelCap()) || 0 : 0;
}

// The level the matchups put box Pokémon at, or 0 for their own.
function getBoxRankLevel() {
	return readSetting(BOX_RANK_CAP_KEY) === "true" ? getLevelCapForRanking() : 0;
}

function isBoxRankingActive() {
	return !!getBoxRank() || !!getBoxRankLevel();
}

function formatRankPercent(percent) {
	return (percent >= 100 ? Math.round(percent) : Math.round(percent * 10) / 10) + "%";
}

// The figure shown under a sprite, its sort value (higher first) and its tooltip.
function describeBoxMatchup(matchup, rank) {
	var dealt = matchup.dealt;
	var taken = matchup.taken;
	var title = "Deals up to " + formatRankPercent(dealt.bestMaxPercent) + (dealt.bestMove ? " (" + dealt.bestMove + ")" : "") +
		" · takes up to " + formatRankPercent(taken.bestMaxPercent) + (taken.bestMove ? " (" + taken.bestMove + ")" : "") +
		" · " + (matchup.speed === matchup.opponentSpeed ? "speed tie" : matchup.movesFirst ? "moves first" : "moves second");
	if (rank === "dealt") return {label: formatRankPercent(dealt.bestMaxPercent), value: dealt.bestMaxPercent, title: title};
	if (rank === "taken") return {label: formatRankPercent(taken.bestMaxPercent), value: -taken.bestMaxPercent, title: title};
	if (rank === "speed") return {label: String(matchup.speed), value: matchup.speed, title: title};
	return {label: "", value: 0, title: title};
}

function rankBox() {
	var rank = getBoxRank();
	$("#box-panel .box-rank-value").remove();
	RANKED_SECTIONS.forEach(function (section) {
		var zone = $('#box-panel .box-dropzone[data-section="' + section + '"]');
		var sprites = zone.children(".box-pokemon").get().map(function (element, index) {
			var matchup = $(element).data("matchup");
			var shown = matchup ? describeBoxMatchup(matchup, rank) : null;
			$(element).attr("title", $(element).attr("data-set-id") + (shown ? " — " + shown.title : ""));
			if (shown && shown.label) $(element).append($('<span class="box-rank-value"></span>').text(shown.label));
			return {element: element, index: index, value: shown ? shown.value : -Infinity};
		});
		if (!rank) return;
		// Highest first; ties (and Pokémon the calc cannot work out) keep the box order.
		sprites.sort(function (a, b) {
			return b.value - a.value || a.index - b.index;
		}).forEach(function (sprite) {
			zone.append(sprite.element);
		});
	});
	$(document).trigger("box:ranked");
}

function updateBoxRankCapLabel() {
	var cap = getLevelCapForRanking();
	$("#box-rank-cap-label").toggle(!!cap).find(".box-rank-cap-level").text(cap ? "Lv " + cap : "");
}

$(document).ready(function () {
	if (!$("#box-panel").length) return;
	var select = $('<select id="box-rank" aria-label="Rank the box"></select>');
	BOX_RANKS.forEach(function (option) {
		select.append($("<option></option>").val(option.key).text(option.label));
	});
	select.val(getBoxRank()).change(function () {
		writeSetting(BOX_RANK_KEY, $(this).val());
		// Back to the box's own order, or ranked from fresh matchups.
		renderBox();
	});
	var cap = $('<label id="box-rank-cap-label" class="box-rank-cap"><input type="checkbox" id="box-rank-cap" /> ' +
		'At level cap (<span class="box-rank-cap-level"></span>)</label>');
	cap.find("input").prop("checked", readSetting(BOX_RANK_CAP_KEY) === "true").change(function () {
		writeSetting(BOX_RANK_CAP_KEY, this.checked);
		renderBox();
	});
	$('<div class="box-rank"></div>').append($('<label class="box-rank-label">Rank </label>').append(select), cap)
		.insertAfter("#box-panel > legend");
	updateBoxRankCapLabel();
	$(document).on("trainer:progress trainer:shown customsets:changed", updateBoxRankCapLabel);
	$(document).on("colorcoding:changed", rankBox);
	// The color coding ran before this was listening.
	if (isBoxRankingActive()) colorCodeBox();
	else rankBox();
});
