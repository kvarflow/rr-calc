/*
 * Pokémon 1 and 2 panel extras, from SylmarDev's syl-rnb-calc (MIT):
 *  - A row of toggles folds away a panel's Type, Stats, HP or Moves block (remembered per side).
 *  - Type & base stat overrides: after editing Pokémon 1's base stats or types (for runs that
 *    change them), "Save override" keeps them for that species, and they are put back every
 *    time it is loaded into Pokémon 1. "Reset override" restores the Pokédex values.
 *  - A note under the stats when the ability changes how boosts add up (Simple, Contrary),
 *    since the boost boxes take the stage the Pokémon is really at.
 *  - Stat stages as − / + buttons (one tap per stage from a move like Swords Dance), in place
 *    of the -6 to +6 dropdown, which stays (hidden) as what the calculator reads.
 */

var PANEL_SECTIONS = [
	{key: "type", label: "Type", find: function (panel) {
		return panel.find(".info-group.top");
	}},
	{key: "stats", label: "Stats", find: function (panel) {
		return panel.find("tr.hp").closest(".info-group");
	}},
	{key: "hp", label: "HP", find: function (panel) {
		return panel.find(".hpbar").closest(".info-group");
	}},
	{key: "moves", label: "Moves", find: function (panel) {
		return panel.children(".move1, .move2, .move3, .move4");
	}}
];
var OVERRIDES_KEY = "baseStatOverrides";
var BOOST_NOTES = {
	Simple: "Simple doubles stat changes: after one Calm Mind or Swords Dance, set +2.",
	Contrary: "Contrary reverses stat changes: a stat-lowering move raises it instead."
};

function getCollapsedKey(side) {
	return "collapsedSections:" + side;
}

function readCollapsed(side) {
	try {
		return JSON.parse(readSetting(getCollapsedKey(side))) || [];
	} catch (e) {
		return [];
	}
}

function setSectionCollapsed(panel, section, collapsed) {
	section.find(panel).toggle(!collapsed);
	panel.find('.panel-toggle[data-section="' + section.key + '"]')
		.attr("aria-expanded", !collapsed)
		.text((collapsed ? "▸ " : "▾ ") + section.label);
}

function buildPanelToggles(panel) {
	var side = panel.attr("id");
	var collapsed = readCollapsed(side);
	var bar = $('<div class="panel-toggles"></div>');
	PANEL_SECTIONS.forEach(function (section) {
		$('<button type="button" class="panel-toggle"></button>')
			.attr({"data-section": section.key, title: "Show or hide " + section.label})
			.click(function () {
				var list = readCollapsed(side).filter(function (key) {
					return key !== section.key;
				});
				var nowCollapsed = $(this).attr("aria-expanded") === "true";
				if (nowCollapsed) list.push(section.key);
				writeSetting(getCollapsedKey(side), JSON.stringify(list));
				setSectionCollapsed(panel, section, nowCollapsed);
			})
			.appendTo(bar);
	});
	panel.children("legend").after(bar);
	PANEL_SECTIONS.forEach(function (section) {
		setSectionCollapsed(panel, section, collapsed.indexOf(section.key) !== -1);
	});
}

var BOOST_LIMIT = 6;

function updateBoostStepper(select) {
	var stage = ~~select.val();
	var stepper = select.next(".boost-stepper");
	stepper.find(".boost-value")
		.text(stage > 0 ? "+" + stage : String(stage))
		.toggleClass("boost-up", stage > 0)
		.toggleClass("boost-down", stage < 0);
	stepper.find(".boost-dec").prop("disabled", stage <= -BOOST_LIMIT);
	stepper.find(".boost-inc").prop("disabled", stage >= BOOST_LIMIT);
}

function buildBoostSteppers(panel) {
	panel.find("select.boost").each(function () {
		var select = $(this).addClass("boost-select");
		var stat = select.closest("tr").find("th label").text();
		var stepper = $('<span class="boost-stepper"></span>').append(
			$('<button type="button" class="boost-dec">\u2212</button>').attr("aria-label", "Lower " + stat),
			'<span class="boost-value" aria-live="polite"></span>',
			$('<button type="button" class="boost-inc">+</button>').attr("aria-label", "Raise " + stat));
		stepper.find("button").click(function () {
			var stage = ~~select.val() + ($(this).hasClass("boost-inc") ? 1 : -1);
			select.val(Math.max(-BOOST_LIMIT, Math.min(BOOST_LIMIT, stage))).change();
		});
		select.after(stepper).change(function () {
			updateBoostStepper(select);
		});
		updateBoostStepper(select);
	});
}

function readOverrides() {
	try {
		return JSON.parse(readSetting(OVERRIDES_KEY)) || {};
	} catch (e) {
		return {};
	}
}

function getP1SpeciesName() {
	var setId = $("#p1 input.set-selector").val() || "";
	return setId.indexOf(" (") === -1 ? setId : setId.slice(0, setId.indexOf(" ("));
}

function readP1BaseStats() {
	var bs = {};
	LEGACY_STATS_GSC.forEach(function (stat) {
		bs[stat] = ~~$("#p1 ." + stat + " .base").val();
	});
	return bs;
}

function readP1Types() {
	return [$("#p1 .type1").val() || "", $("#p1 .type2").val() || ""];
}

function sameStats(a, b) {
	return LEGACY_STATS_GSC.every(function (stat) {
		return a[stat] === b[stat];
	});
}

function sameTypes(a, b) {
	return a[0] === (b[0] || "") && a[1] === (b[1] || "");
}

// Save shows when the panel differs from both the Pokédex and the saved override; Reset when one exists.
function updateOverrideButtons() {
	var dex = pokedex[getP1SpeciesName()];
	var override = readOverrides()[getP1SpeciesName()];
	var bs = readP1BaseStats();
	var types = readP1Types();
	var matchesDex = !!dex && sameStats(bs, dex.bs) && sameTypes(types, dex.types);
	var matchesOverride = !!override && sameStats(bs, override.bs || (dex && dex.bs) || {}) &&
		sameTypes(types, override.types || (dex && dex.types) || []);
	$("#save-override").toggle(!!dex && !matchesDex && !matchesOverride);
	$("#reset-override").toggle(!!override);
}

function refreshP1Stats() {
	calcHP($("#p1"));
	calcStats($("#p1"));
	$("#p1 .hp .base").change(); // recalculate
	updateOverrideButtons();
}

// Puts a saved override back after Pokémon 1's set is loaded.
function applyP1Override() {
	var override = readOverrides()[getP1SpeciesName()];
	if (override && override.bs) {
		LEGACY_STATS_GSC.forEach(function (stat) {
			$("#p1 ." + stat + " .base").val(override.bs[stat]);
		});
	}
	if (override && override.types) {
		$("#p1 .type1").val(override.types[0]);
		$("#p1 .type2").val(override.types[1]);
	}
	if (override) refreshP1Stats();
	else updateOverrideButtons();
}

function saveP1Override() {
	var name = getP1SpeciesName();
	var dex = pokedex[name];
	var overrides = readOverrides();
	var entry = {};
	var bs = readP1BaseStats();
	var types = readP1Types();
	if (!sameStats(bs, dex.bs)) entry.bs = bs;
	if (!sameTypes(types, dex.types)) entry.types = types;
	if (entry.bs || entry.types) overrides[name] = entry;
	else delete overrides[name];
	writeSetting(OVERRIDES_KEY, JSON.stringify(overrides));
	updateOverrideButtons();
}

function resetP1Override() {
	var name = getP1SpeciesName();
	var dex = pokedex[name];
	var overrides = readOverrides();
	delete overrides[name];
	writeSetting(OVERRIDES_KEY, JSON.stringify(overrides));
	LEGACY_STATS_GSC.forEach(function (stat) {
		$("#p1 ." + stat + " .base").val(dex.bs[stat]);
	});
	$("#p1 .type1").val(dex.types[0] || "");
	$("#p1 .type2").val(dex.types[1] || "");
	refreshP1Stats();
}

$(document).ready(function () {
	$("#p1, #p2").each(function () {
		buildPanelToggles($(this));
		buildBoostSteppers($(this));
	});
	// Loading a set resets the stages without a change event, so follow every calculation.
	$(document).on("calc:done", function () {
		$("select.boost-select").each(function () {
			updateBoostStepper($(this));
		});
	});
	$('<div class="override-buttons">' +
		'<button type="button" id="save-override" title="Keep these base stats and types for this species">Save override</button> ' +
		'<button type="button" id="reset-override" title="Go back to the Pokédex base stats and types">Reset override</button>' +
		'</div>').insertAfter($("#p1 tr.hp").closest("table"));
	$("#p1, #p2").each(function () {
		$('<p class="boost-note"></p>').hide().insertAfter($(this).find("tr.hp").closest("table"));
	});
	$(document).on("calc:done", function (event, p1, p2) {
		[["#p1", p1], ["#p2", p2]].forEach(function (side) {
			var note = BOOST_NOTES[side[1].ability];
			$(side[0] + " .boost-note").text(note || "").toggle(!!note);
		});
	});
	$("#save-override").click(saveP1Override);
	$("#reset-override").click(resetP1Override);
	$("#p1 .base, #p1 .type1, #p1 .type2").on("change keyup", updateOverrideButtons);
	// After the calculator's own handler has filled in the new set.
	$("#p1 input.set-selector").change(applyP1Override);
	applyP1Override();
});
