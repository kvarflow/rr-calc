/*
 * Pokémon 1 and 2 panel extras, from SylmarDev's syl-rnb-calc (MIT):
 *  - A row of toggles folds away a panel's Type, Stats, HP or Moves block (remembered per side).
 *  - Type & base stat overrides: after editing Pokémon 1's base stats or types (for runs that
 *    change them), "Save override" keeps them for that species, and they are put back every
 *    time it is loaded into Pokémon 1. "Reset override" restores the Pokédex values.
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
	});
	$('<div class="override-buttons">' +
		'<button type="button" id="save-override" title="Keep these base stats and types for this species">Save override</button> ' +
		'<button type="button" id="reset-override" title="Go back to the Pokédex base stats and types">Reset override</button>' +
		'</div>').insertAfter($("#p1 tr.hp").closest("table"));
	$("#save-override").click(saveP1Override);
	$("#reset-override").click(resetP1Override);
	$("#p1 .base, #p1 .type1, #p1 .type2").on("change keyup", updateOverrideButtons);
	// After the calculator's own handler has filled in the new set.
	$("#p1 input.set-selector").change(applyP1Override);
	applyP1Override();
});
