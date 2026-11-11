/*
 * "This turn": what has happened in the battle so far, which the trainer's AI reads (trainer_ai.js's
 * `vol`): the move each side used last (so a Choice lock, Encore, Disable, Protects in a row), whether
 * a Pokémon has just come in, a Substitute, Taunt, Yawn and so on. You set it from the Turn button
 * beside the foe's moves (tap the move each side used, tick what applies); emulator sync fills it in
 * from the game when it sends it. It is kept until that side's Pokémon changes.
 */
var battleHistory = {p1: null, p2: null};

// What can be ticked, in the order shown.
var BATTLE_HISTORY_FLAGS = [
	{key: "sub", label: "Substitute"},
	{key: "taunt", label: "Taunted"},
	{key: "encore", label: "Encored", title: "Into the move it used last"},
	{key: "torment", label: "Tormented"},
	{key: "healBlock", label: "Heal Block"},
	{key: "yawn", label: "Yawned", title: "Falls asleep at the end of next turn"},
	{key: "confused", label: "Confused"},
	{key: "infatuated", label: "Infatuated"},
	{key: "wrapped", label: "Bound", title: "Bind, Wrap, Fire Spin, Whirlpool..."},
	{key: "noEscape", label: "Can't escape", title: "Mean Look, Block, Spider Web"},
	{key: "perish", label: "Perish Song"},
	{key: "perishLast", label: "Perish: last turn", title: "It faints at the end of this turn"},
	{key: "destinyBond", label: "Destiny Bond up", title: "It used Destiny Bond last turn"},
	{key: "recharge", label: "Must recharge", title: "After Hyper Beam and the like"},
	{key: "locked", label: "Locked in", title: "Into the move it used last: Outrage, Petal Dance, a move it is charging"},
	{key: "wish", label: "Wish coming"}
];

function getBattleHistoryPanel(key) {
	return $(key === "p1" ? "#p1" : "#p2");
}

// Which Pokémon a side's history belongs to: it starts again when another is sent out.
function getBattleHistorySetId(key) {
	return getBattleHistoryPanel(key).find("input.set-selector").val() || "";
}

// A side's history for the AI, or null when nothing has been set (a fresh battle is assumed).
function getBattleVolatile(key) {
	var entry = battleHistory[key];
	if (!entry) return null;
	if (entry.setId !== getBattleHistorySetId(key)) {
		battleHistory[key] = null;
		return null;
	}
	return entry.vol;
}

function ensureBattleVolatile(key) {
	if (!getBattleVolatile(key)) {
		battleHistory[key] = {setId: getBattleHistorySetId(key), vol: $.extend({}, AI_VOLATILE_DEFAULTS)};
	}
	return battleHistory[key].vol;
}

function clearBattleHistory(key) {
	if (key) battleHistory[key] = null;
	else battleHistory = {p1: null, p2: null};
}

// A side's moves as the panel has them now.
function getBattleHistoryMoves(key) {
	return getBattleHistoryPanel(key).find("select.move-selector").map(function () {
		return $(this).val();
	}).get().filter(function (name) {
		return name && name !== "(No Move)";
	});
}

/*
 * A side used a move (or `""`: it did nothing, recharged or was just switched in): it is no longer
 * on its first turn, and what follows from the move is set: Protects in a row, Destiny Bond, a
 * recharge turn, the Stockpile count, a Wish, its Substitute.
 */
function logBattleMove(key, name) {
	var vol = ensureBattleVolatile(key);
	var data = name ? getAIMoveData({name: name}) : null;
	vol.firstTurn = false;
	vol.lastMove = name || "";
	vol.protectUses = data && data.effect === E.PROTECT ? vol.protectUses + 1 : 0;
	vol.destinyBond = name === "Destiny Bond";
	vol.recharge = !!data && data.effect === E.RECHARGE;
	if (!name) vol.locked = false;
	if (name === "Stockpile") vol.stockpile = Math.min(3, vol.stockpile + 1);
	else if (name === "Spit Up" || name === "Swallow") vol.stockpile = 0;
	if (name === "Wish") vol.wish = true;
	if (name === "Substitute" || name === "Shed Tail") vol.sub = true;
}

// How many things are set on either side (shown on the Turn button).
function countBattleHistory() {
	var count = 0;
	["p1", "p2"].forEach(function (key) {
		var vol = getBattleVolatile(key);
		if (!vol) return;
		Object.keys(AI_VOLATILE_DEFAULTS).forEach(function (field) {
			if (field !== "firstTurn" && vol[field] !== AI_VOLATILE_DEFAULTS[field]) count++;
		});
		if (vol.firstTurn === false && !vol.lastMove) count++;
	});
	return count;
}

function refreshBattleHistory() {
	if (typeof performCalculations === "function") performCalculations();
}

// One side's controls in the dialog.
function buildBattleHistorySide(key, title, redraw) {
	var vol = getBattleVolatile(key) || AI_VOLATILE_DEFAULTS;
	var moves = getBattleHistoryMoves(key);
	var change = function (apply) {
		apply(ensureBattleVolatile(key));
		refreshBattleHistory();
		redraw();
	};
	var side = $('<fieldset class="bh-side"></fieldset>').append($("<legend></legend>").text(title));
	// The move it used last: tap one each turn.
	var used = $('<div class="bh-row"></div>').append($('<span class="bh-label">Used last turn</span>'));
	var buttons = $('<span class="bh-moves"></span>').appendTo(used);
	moves.forEach(function (name) {
		$('<button type="button" class="bh-move"></button>').text(name + (vol.lastMove === name && vol.protectUses > 1 ? " ×" + vol.protectUses : ""))
			.attr("aria-pressed", vol.lastMove === name).click(function () {
				logBattleMove(key, name);
				refreshBattleHistory();
				redraw();
			}).appendTo(buttons);
	});
	$('<button type="button" class="bh-move bh-move-none">No move</button>').attr("title", "It did not move: it recharged, flinched, or was sent in")
		.attr("aria-pressed", vol.firstTurn === false && !vol.lastMove).click(function () {
			logBattleMove(key, "");
			refreshBattleHistory();
			redraw();
		}).appendTo(buttons);
	side.append(used);
	var firstTurn = $('<label class="bh-flag"></label>').attr("title", "Fake Out and First Impression work; the AI waits a turn before switching again")
		.append($('<input type="checkbox" />').prop("checked", vol.firstTurn === true)
			.prop("indeterminate", vol.firstTurn === null).change(function () {
				var on = this.checked;
				change(function (v) {
					v.firstTurn = on;
				});
			}), " Just came in");
	var flags = $('<div class="bh-flags"></div>').append(firstTurn);
	BATTLE_HISTORY_FLAGS.forEach(function (flag) {
		$('<label class="bh-flag"></label>').attr("title", flag.title || null)
			.append($('<input type="checkbox" />').prop("checked", !!vol[flag.key]).change(function () {
				var on = this.checked;
				change(function (v) {
					v[flag.key] = on;
					if (flag.key === "perishLast" && on) v.perish = true;
				});
			}), " " + flag.label).appendTo(flags);
	});
	side.append(flags);
	var disabled = $('<select class="bh-select" aria-label="Disabled move"></select>').append('<option value="">—</option>');
	moves.forEach(function (name) {
		disabled.append($("<option></option>").val(name).text(name));
	});
	disabled.val(vol.disabled || "").change(function () {
		var name = $(this).val();
		change(function (v) {
			v.disabled = name;
		});
	});
	var stockpile = $('<select class="bh-select" aria-label="Stockpile"><option>0</option><option>1</option><option>2</option><option>3</option></select>')
		.val(String(vol.stockpile || 0)).change(function () {
			var count = +$(this).val();
			change(function (v) {
				v.stockpile = count;
			});
		});
	side.append($('<div class="bh-row"></div>').append($('<label class="bh-inline">Disabled move </label>').append(disabled),
		$('<label class="bh-inline">Stockpile </label>').append(stockpile),
		$('<button type="button" class="bh-clear">Clear</button>').click(function () {
			clearBattleHistory(key);
			refreshBattleHistory();
			redraw();
		})));
	return side;
}

function showBattleHistory() {
	$(".bh-backdrop").remove();
	var dialog = $('<div class="box-dialog-backdrop bh-backdrop"><div class="box-dialog bh-dialog" role="dialog" aria-modal="true" aria-labelledby="bh-title"></div></div>');
	var body = dialog.find(".box-dialog");
	var close = function () {
		dialog.remove();
		$(document).off("keydown.battleHistory");
	};
	var draw = function () {
		var scroll = body.scrollTop();
		body.empty().append($('<h3 id="bh-title">This turn</h3>'),
			$('<p class="bh-help"></p>').text("What has happened so far in this battle, for the trainer's AI. Tap the move each side used " +
				"last turn and tick what applies. It starts again when that side's Pokémon changes."),
			buildBattleHistorySide("p2", "Foe: " + (getBattleHistorySetId("p2").replace(/ \(.*/, "") || "Pokémon 2"), draw),
			buildBattleHistorySide("p1", "You: " + (getBattleHistorySetId("p1").replace(/ \(.*/, "") || "Pokémon 1"), draw),
			$('<div class="box-dialog-buttons"></div>').append(
				$('<button type="button">New battle</button>').attr("title", "Clear both sides").click(function () {
					clearBattleHistory();
					refreshBattleHistory();
					draw();
				}), $('<button type="button">Done</button>').click(close)));
		body.scrollTop(scroll);
	};
	draw();
	dialog.click(function (ev) {
		if (ev.target === dialog[0]) close();
	});
	$(document).on("keydown.battleHistory", function (ev) {
		if (ev.key === "Escape") close();
	});
	$("body").append(dialog);
}

// The Turn button, with how many things are set.
function buildBattleHistoryButton() {
	var count = countBattleHistory();
	return $('<button type="button" class="bh-button"></button>').text("Turn" + (count ? " · " + count : ""))
		.toggleClass("bh-button-set", count > 0)
		.attr("title", "What has happened this battle (moves used, Protect, Substitute, Taunt...), for the trainer's AI")
		.click(showBattleHistory);
}
