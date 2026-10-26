/*
 * The run so far, saved per mode: KOs ("frags") each of your Pokémon has made, which of them have
 * fainted (and to whom), and, when Professor Oak starts a new run, a record of how far the last
 * one got. The best of those is your personal best.
 *
 * A Pokémon from your .sav is known by its personality value, which stays the same however often
 * you re-import and wherever you move it in the game; any other set by its set id.
 */

var RUN_RECORD_KEY = "runRecord";
var RUN_HISTORY_KEY = "runHistory";

function readRunData(key) {
	try {
		return JSON.parse(readSetting(key + ":" + getPageMode())) || null;
	} catch (e) {
		return null;
	}
}

function writeRunData(key, value) {
	writeSetting(key + ":" + getPageMode(), JSON.stringify(value));
}

// {started: ms, mons: {key: {name, fainted, faintedBy}}, frags: [{trainer, slot, mon}]}
function readRunRecord() {
	var record = readRunData(RUN_RECORD_KEY) || {};
	record.started = record.started || Date.now();
	record.mons = record.mons || {};
	record.frags = record.frags || [];
	return record;
}

function writeRunRecord(record) {
	writeRunData(RUN_RECORD_KEY, record);
	$(document).trigger("run:changed");
}

function getYourSet(setId) {
	if (!setId || setId.indexOf(" (") === -1) return null;
	var id = splitSetId(setId);
	var sets = readCustomSets()[id.pokemonName];
	return sets && sets[id.setName] ? sets[id.setName] : null;
}

// The key a set's record is kept under, or null for a set that is not yours (a trainer's).
function getRunKey(setId) {
	var set = getYourSet(setId);
	if (!set) return null;
	return set.pid !== undefined ? "pid:" + set.pid : "set:" + setId;
}

// What the run knows about one of your sets: {frags, fainted, faintedBy}.
function getRunMon(setId, record) {
	record = record || readRunRecord();
	var key = getRunKey(setId);
	var mon = (key && record.mons[key]) || {};
	return {
		frags: key ? record.frags.filter(function (frag) {
			return frag.mon === key;
		}).length : 0,
		fainted: !!mon.fainted,
		faintedBy: mon.faintedBy || ""
	};
}

// A Pokémon from your save came back with a new personality value (its nature or ability was
// changed): its KOs and fainting move to it. {old pid: new pid}
function moveRunRecordPids(changed) {
	var record = readRunRecord();
	var moved = false;
	Object.keys(changed).forEach(function (oldPid) {
		var from = "pid:" + oldPid;
		var to = "pid:" + changed[oldPid];
		record.frags.forEach(function (frag) {
			if (frag.mon === from) {
				frag.mon = to;
				moved = true;
			}
		});
		if (record.mons[from]) {
			record.mons[to] = $.extend(record.mons[to] || {}, record.mons[from]);
			delete record.mons[from];
			moved = true;
		}
	});
	if (moved) writeRunRecord(record);
}

$(document).on("save:pidsChanged", function (event, changed) {
	moveRunRecordPids(changed);
});

// Credits (or, on Undo KO, takes back) a trainer's Pokémon's KO to the Pokémon in Pokémon 1.
function recordFrag(trainerIndex, slot, added) {
	var record = readRunRecord();
	record.frags = record.frags.filter(function (frag) {
		return !(frag.trainer === trainerIndex && frag.slot === slot);
	});
	var setId = $("#p1 input.set-selector").val();
	var key = getRunKey(setId);
	if (added && key) {
		record.frags.push({trainer: trainerIndex, slot: slot, mon: key});
		record.mons[key] = $.extend(record.mons[key] || {}, {name: splitSetId(setId).pokemonName});
	}
	writeRunRecord(record);
}

// Marks the Pokémon in Pokémon 1 as fainted, to the Pokémon in Pokémon 2, or revives it.
function toggleYourFaint() {
	var setId = $("#p1 input.set-selector").val();
	var key = getRunKey(setId);
	if (!key) return;
	var record = readRunRecord();
	var mon = record.mons[key] = record.mons[key] || {};
	mon.name = splitSetId(setId).pokemonName;
	mon.fainted = !mon.fainted;
	var foe = splitSetId($("#p2 input.set-selector").val() || " ()").pokemonName;
	mon.faintedBy = mon.fainted ? (($("#trainer-name").text() || "A trainer") + "'s " + foe) : "";
	mon.faintedAt = mon.fainted ? currentTrainerIndex : undefined;
	writeRunRecord(record);
}

// Where the run stands: how far it got and how many of your team are still standing.
function summarizeRun() {
	var record = readRunRecord();
	var defeated = 0;
	var furthest = -1;
	TRAINER_ORDER.forEach(function (trainer, index) {
		if (isTrainerDefeated(index)) {
			defeated++;
			furthest = index;
		}
	});
	var team = resolveBoxLayout(readCustomSets(), readBoxLayout()).team;
	var standing = team.filter(function (setId) {
		return !getRunMon(setId, record).fainted;
	}).length;
	var fainted = Object.keys(record.mons).filter(function (key) {
		return record.mons[key].fainted;
	}).map(function (key) {
		return {name: record.mons[key].name, by: record.mons[key].faintedBy};
	});
	var fraggers = {};
	record.frags.forEach(function (frag) {
		var name = (record.mons[frag.mon] || {}).name || "?";
		fraggers[frag.mon] = fraggers[frag.mon] || {name: name, frags: 0};
		fraggers[frag.mon].frags++;
	});
	return {
		started: record.started,
		defeated: defeated,
		// The fight you are on (where a run ends is the fight it ends in).
		reached: TRAINER_ORDER[currentTrainerIndex] ? TRAINER_ORDER[currentTrainerIndex].name : "",
		furthest: furthest === -1 ? "" : TRAINER_ORDER[furthest].name,
		standing: standing,
		teamSize: team.length,
		fainted: fainted,
		topFraggers: Object.keys(fraggers).map(function (key) {
			return fraggers[key];
		}).sort(function (a, b) {
			return b.frags - a.frags;
		})
	};
}

// Better runs beat more trainers; between equal ones, more Pokémon standing wins.
function isBetterRun(a, b) {
	return !b || a.defeated > b.defeated || (a.defeated === b.defeated && a.standing > b.standing);
}

function getPersonalBest(history) {
	var best = null;
	(history || readRunData(RUN_HISTORY_KEY) || []).forEach(function (run) {
		if (isBetterRun(run, best)) best = run;
	});
	return best;
}

// Professor Oak's new run: the run that ends goes into the history, then a new record starts.
function endRun() {
	var run = summarizeRun();
	if (run.defeated || run.fainted.length || readRunRecord().frags.length) {
		run.ended = Date.now();
		var history = readRunData(RUN_HISTORY_KEY) || [];
		history.push(run);
		writeRunData(RUN_HISTORY_KEY, history.slice(-50));
	}
	writeRunData(RUN_RECORD_KEY, {started: Date.now()});
}

function formatRunDate(ms) {
	return new Date(ms).toLocaleDateString(undefined, {day: "numeric", month: "short"});
}

function describeRun(run) {
	return "Reached " + (run.reached || "the start") + " · " + run.defeated + " defeated · " +
		run.standing + " Pokémon left";
}

// Fainted Pokémon greyed out in the Box too.
function markFaintedSprites() {
	var record = readRunRecord();
	$(".box-pokemon").each(function () {
		$(this).toggleClass("run-fainted", getRunMon($(this).attr("data-set-id"), record).fainted);
	});
}

function renderRunRecord() {
	var panel = $("#run-record");
	if (!panel.length) return;
	var run = summarizeRun();
	var history = readRunData(RUN_HISTORY_KEY) || [];
	var best = getPersonalBest(history);
	var list = function (title, items) {
		return $('<div class="run-record-group"></div>').append($("<h4></h4>").text(title),
			items.length ? $("<ul></ul>").append(items.map(function (item) {
				return $("<li></li>").text(item);
			})) : $('<p class="run-record-empty"></p>').text("None yet"));
	};
	// Your Pokémon as a grid of sprites, each with its name and a note under it.
	var grid = function (title, mons, className) {
		return $('<div class="run-record-group"></div>').addClass(className || "").append($("<h4></h4>").text(title),
			mons.length ? $('<div class="run-record-grid"></div>').append(mons.map(function (mon) {
				return $('<div class="run-record-mon"></div>').attr("title", mon.name + (mon.note ? " — " + mon.note : "")).append(
					createSpriteImage(mon.name, function () {
						$(this).remove();
					}).addClass("run-record-sprite"),
					$('<span class="run-record-name"></span>').text(mon.name),
					$('<span class="run-record-note"></span>').text(mon.note));
			})) : $('<p class="run-record-empty"></p>').text("None yet"));
	};
	panel.find(".run-record-body").empty().append(
		$('<p class="run-record-now"></p>').text(describeRun(run) + " (of " + run.teamSize + ") · since " + formatRunDate(run.started)),
		grid("Top fraggers", run.topFraggers.slice(0, 6).map(function (mon) {
			return {name: mon.name, note: mon.frags + " KO" + (mon.frags === 1 ? "" : "s")};
		})),
		grid("Fainted", run.fainted.map(function (mon) {
			return {name: mon.name, note: mon.by ? "to " + mon.by : ""};
		}), "run-record-fainted"),
		$('<div class="run-record-group run-record-best"></div>').append($("<h4></h4>").text("Personal best"),
			$("<p></p>").text(best ? describeRun(best) + " (" + formatRunDate(best.ended) + ")" : "Finish a run with Professor Oak to set one")),
		history.length ? list("Past runs", history.slice(-5).reverse().map(function (past) {
			return formatRunDate(past.ended) + ": " + describeRun(past);
		})) : "");
}

$(document).ready(function () {
	if (typeof TRAINER_ORDER === "undefined" || !TRAINER_ORDER.length) return;
	$('<fieldset id="run-record" class="run-record"><legend align="center">This run</legend><div class="run-record-body"></div></fieldset>')
		.insertAfter("#run-progress");
	$(document).on("trainer:ko", function (event, trainerIndex, slot, added) {
		recordFrag(trainerIndex, slot, added);
	});
	$(document).on("run:end", endRun);
	$(document).on("run:changed run:new trainer:progress trainer:shown customsets:changed box:rendered", renderRunRecord);
	$(document).on("run:changed box:rendered", markFaintedSprites);
	renderRunRecord();
	markFaintedSprites();
});
