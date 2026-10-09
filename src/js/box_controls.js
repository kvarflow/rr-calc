/*
 * Team/Box panel, ported from SylmarDev's syl-rnb-calc (MIT).
 *
 * Every imported set is shown as a sprite in one of three sections (Team, Box, Box 2);
 * clicking a sprite loads that set into Pokémon 1, and sprites can be dragged between
 * and within sections. The sets themselves live in the per-mode custom set storage
 * (see moveset_import.js); this file only stores which section each set sits in, and
 * in what order, under `boxlayout:<mode>`.
 */

var BOX_SECTIONS = [
	{key: "team", label: "Team"},
	{key: "box", label: "Box"},
	{key: "box2", label: "Box 2"},
	// Sets waiting to be deleted with "Delete Pokémon in Trash". They are not transferred
	// to the other mode.
	{key: "trash", label: "Trash"}
];
// Sets not placed anywhere yet (e.g. freshly imported) go to this section.
var DEFAULT_BOX_SECTION = "box";
// Only these modes have a box that can be carried over when switching between them.
var BOX_TRANSFER_MODES = {normal: "Normal Mode", hardcore: "Hardcore Mode"};

function getBoxLayoutKey(mode) {
	return "boxlayout:" + (mode || getPageMode());
}

function readBoxLayout(mode) {
	try {
		return JSON.parse(localStorage.getItem(getBoxLayoutKey(mode))) || {};
	} catch (e) {
		return {};
	}
}

function writeBoxLayout(layout, mode) {
	localStorage.setItem(getBoxLayoutKey(mode), JSON.stringify(layout));
}

// Moves the given sets to the end of a section; takes effect on the next render.
function moveSetsToSection(setIds, sectionKey) {
	var layout = readBoxLayout();
	BOX_SECTIONS.forEach(function (section) {
		layout[section.key] = (layout[section.key] || []).filter(function (id) {
			return setIds.indexOf(id) === -1;
		});
	});
	layout[sectionKey] = layout[sectionKey].concat(setIds);
	writeBoxLayout(layout);
}

function getSetId(pokemonName, setName) {
	return pokemonName + " (" + setName + ")";
}

function getSetIds(customsets) {
	var ids = [];
	for (var pokemonName in customsets) {
		for (var setName in customsets[pokemonName]) {
			// addToDex mirrors every Aegislash-Blade set onto Aegislash-Shield; show it once.
			if (pokemonName === "Aegislash-Shield" &&
				customsets["Aegislash-Blade"] && customsets["Aegislash-Blade"][setName]) {
				continue;
			}
			ids.push(getSetId(pokemonName, setName));
		}
	}
	return ids;
}

/*
 * Assigns every stored set to a section, keeping the saved order and dropping saved
 * entries whose set no longer exists. Returns {team: [ids], box: [ids], box2: [ids]}.
 */
function resolveBoxLayout(customsets, savedLayout) {
	var remaining = {};
	getSetIds(customsets).forEach(function (id) {
		remaining[id] = true;
	});
	var layout = {};
	BOX_SECTIONS.forEach(function (section) {
		layout[section.key] = (savedLayout[section.key] || []).filter(function (id) {
			if (!remaining[id]) return false;
			delete remaining[id];
			return true;
		});
	});
	layout[DEFAULT_BOX_SECTION] = layout[DEFAULT_BOX_SECTION].concat(Object.keys(remaining));
	return layout;
}

// Showdown sprite ids are the base species id plus the forme id, e.g. "charizard-megax".
function getSpriteId(pokemonName) {
	var species = calc.SPECIES[gen][pokemonName];
	var baseSpecies = species && species.baseSpecies;
	if (baseSpecies && pokemonName.indexOf(baseSpecies + "-") === 0) {
		return calc.toID(baseSpecies) + "-" + calc.toID(pokemonName.slice(baseSpecies.length + 1));
	}
	return calc.toID(pokemonName);
}

function getSpriteUrl(pokemonName) {
	return "https://play.pokemonshowdown.com/sprites/gen5/" + getSpriteId(pokemonName) + ".png";
}

function getPokemonName(setId) {
	return splitSetId(setId).pokemonName;
}

function createBoxSprite(setId) {
	var pokemonName = getPokemonName(setId);
	var sprite = $('<div class="box-pokemon" draggable="true"></div>')
		.attr({title: setId, "data-set-id": setId});
	$("<img />")
		.attr({src: getSpriteUrl(pokemonName), alt: pokemonName})
		.on("error", function () {
			// Radical Red-only formes have no Showdown sprite: show the name instead.
			$(this).replaceWith($('<span class="box-pokemon-name"></span>').text(pokemonName));
		})
		.appendTo(sprite);
	return sprite;
}

// Layout follows syl-rnb-calc: a Team/Box panel (with a search box in its header) and,
// after Pokémon 1, a second panel holding the Trash and the color coding controls.
function buildBoxSection(section) {
	return $('<div class="box-section"></div>')
		.append($('<div class="box-section-label"></div>').text(section.label))
		.append($('<div class="box-dropzone"></div>').attr("data-section", section.key));
}

function buildBoxPanel() {
	var panel = $(
		'<fieldset id="box-panel"><legend class="box-legend">' +
		'<span>Team/Box</span>' +
		'<input type="search" id="box-search" placeholder="Search" aria-label="Search the box" />' +
		'</legend></fieldset>');
	BOX_SECTIONS.forEach(function (section) {
		if (section.key === "trash") return;
		panel.append(buildBoxSection(section));
		if (section.key === "team") panel.append("<hr />");
	});
	panel.append('<div class="box-empty-hint">Imported sets appear here. Click a Pok&eacute;mon to load it as Pok&eacute;mon 1, or drag it between sections.</div>');
	return panel;
}

function buildBoxTools() {
	var trash = BOX_SECTIONS.filter(function (section) {
		return section.key === "trash";
	})[0];
	return $('<fieldset id="box-tools"></fieldset>')
		.append(buildBoxSection(trash))
		.append(
			'<div class="box-tool-buttons">' +
			'<button type="button" id="box-delete-trash">Delete Pok&eacute;mon in Trash</button>' +
			'<button type="button" id="box-clear-all">Remove Pok&eacute;mon from all boxes</button>' +
			'</div>' +
			'<label class="box-position-option"><input type="checkbox" id="box-on-top" /> Team/Box above Pok&eacute;mon 1</label>' +
			'<hr />');
}

// Whether the Team/Box panel sits above Pokémon 1 (the default) or below it.
var BOX_ON_TOP_KEY = "boxOnTop";

function isBoxOnTop() {
	try {
		return localStorage.getItem(BOX_ON_TOP_KEY) !== "false";
	} catch (e) {
		return true;
	}
}

function placeBoxPanel(onTop) {
	if (onTop) {
		$("#p1").before($("#box-panel"));
	} else {
		$("#p1").after($("#box-panel"));
	}
}

// Hides box sprites whose set name does not contain the search text.
function filterBox() {
	var term = ($("#box-search").val() || "").trim().toLowerCase();
	$(".box-pokemon").each(function () {
		$(this).toggle(!term || $(this).attr("data-set-id").toLowerCase().indexOf(term) !== -1);
	});
}

function renderBox() {
	var layout = resolveBoxLayout(readCustomSets(), readBoxLayout());
	var total = 0;
	BOX_SECTIONS.forEach(function (section) {
		var zone = $('.box-dropzone[data-section="' + section.key + '"]').empty();
		layout[section.key].forEach(function (setId) {
			zone.append(createBoxSprite(setId));
		});
		total += layout[section.key].length;
	});
	$("#box-panel .box-empty-hint").toggle(total === 0);
	filterBox();
	writeBoxLayout(layout);
	$(document).trigger("box:rendered");
}

// Reads the current section and order of every sprite back from the page.
function saveBoxLayoutFromPage() {
	var layout = {};
	$(".box-dropzone").each(function () {
		layout[$(this).attr("data-section")] = $(this).children(".box-pokemon").map(function () {
			return $(this).attr("data-set-id");
		}).get();
	});
	writeBoxLayout(layout);
}

function deleteTrashedSets() {
	var trashed = $('.box-dropzone[data-section="trash"] .box-pokemon').map(function () {
		return $(this).attr("data-set-id");
	}).get();
	if (!trashed.length) return;
	var what = trashed.length === 1 ? trashed[0] : trashed.length + " Pok\u00e9mon";
	if (confirm("Permanently delete " + what + " from the Trash? This cannot be undone.")) {
		deleteCustomSets(trashed);
	}
}

function loadSetIntoPokemon1(setId) {
	var setSelector = $("#p1 input.set-selector");
	setSelector.val(setId).change();
	$("#p1 .select2-chosen").text(setId);
}

function bindBoxEvents() {
	// Sprites can be dragged between both panels (Team/Box and the Trash).
	var panel = $("#box-panel, #box-tools");
	var dragged = null;

	$("#box-delete-trash").click(deleteTrashedSets);
	$("#box-clear-all").click(confirmClearCustomSets);
	$("#box-search").on("input", filterBox);
	$("#box-on-top").prop("checked", isBoxOnTop()).change(function () {
		try {
			localStorage.setItem(BOX_ON_TOP_KEY, this.checked);
		} catch (e) {
			// Storage unavailable (e.g. private browsing): the choice lasts until reload.
		}
		placeBoxPanel(this.checked);
	});
	panel.on("click", ".box-pokemon", function () {
		loadSetIntoPokemon1($(this).attr("data-set-id"));
	});
	panel.on("dragstart", ".box-pokemon", function (ev) {
		dragged = $(this);
		// Firefox will not start a drag without some data attached.
		ev.originalEvent.dataTransfer.setData("text/plain", dragged.attr("data-set-id"));
	});
	panel.on("dragend", ".box-pokemon", function () {
		dragged = null;
		panel.find(".box-drag-over").removeClass("box-drag-over");
	});
	panel.on("dragover", ".box-dropzone", function (ev) {
		if (!dragged) return;
		ev.preventDefault();
		$(this).addClass("box-drag-over");
	});
	panel.on("dragleave", ".box-dropzone", function () {
		$(this).removeClass("box-drag-over");
	});
	panel.on("drop", ".box-dropzone", function (ev) {
		if (!dragged) return;
		ev.preventDefault();
		// Dropping onto another sprite places the dragged one just before it.
		var target = $(ev.target).closest(".box-pokemon");
		if (target.length && target[0] !== dragged[0]) {
			target.before(dragged);
		} else if (!target.length) {
			$(this).append(dragged);
		}
		saveBoxLayoutFromPage();
	});
}

/*
 * Copies the source mode's box into the target mode. Sets with the same species and
 * name are overwritten by the source copy; nothing is removed from either mode.
 */
// Every set in a mode's box except those in the Trash.
function getTransferableSetIds(mode) {
	var layout = resolveBoxLayout(readCustomSets(mode), readBoxLayout(mode));
	return [].concat(layout.team, layout.box, layout.box2);
}

function transferBox(fromMode, toMode) {
	var source = readCustomSets(fromMode);
	var target = readCustomSets(toMode);
	var transferred = getTransferableSetIds(fromMode);
	transferred.forEach(function (setId) {
		var set = splitSetId(setId);
		target[set.pokemonName] = target[set.pokemonName] || {};
		target[set.pokemonName][set.setName] = source[set.pokemonName][set.setName];
	});
	writeCustomSets(target, toMode);

	var sourceLayout = resolveBoxLayout(source, readBoxLayout(fromMode));
	sourceLayout.trash = [];
	var targetLayout = readBoxLayout(toMode);
	BOX_SECTIONS.forEach(function (section) {
		// Transferred sets take the section they had in the source box.
		var kept = (targetLayout[section.key] || []).filter(function (id) {
			return transferred.indexOf(id) === -1;
		});
		targetLayout[section.key] = kept.concat(sourceLayout[section.key]);
	});
	writeBoxLayout(targetLayout, toMode);
}

/*
 * Shows a modal with a title, a message and a column of choices, plus Cancel (also on
 * Escape). `choices` is [{label, action, primary}]; the dialog closes before any action
 * runs. Used instead of confirm() because these questions have more than two answers.
 */
function showChoiceDialog(title, message, choices, onCancel) {
	var dialog = $('<div class="box-dialog-backdrop"><div class="box-dialog" role="dialog" aria-modal="true" aria-labelledby="box-dialog-title"></div></div>');
	var body = dialog.find(".box-dialog");
	$('<h3 id="box-dialog-title"></h3>').text(title).appendTo(body);
	$("<p></p>").text(message).appendTo(body);
	var buttons = $('<div class="box-dialog-buttons"></div>').appendTo(body);
	var close = function () {
		dialog.remove();
		$(document).off("keydown.boxDialog");
	};
	var cancel = function () {
		close();
		if (onCancel) onCancel();
	};
	choices.concat([{label: "Cancel", action: cancel}]).forEach(function (choice) {
		$('<button type="button"></button>')
			.text(choice.label)
			.toggleClass("box-dialog-primary", !!choice.primary)
			.click(function () {
				close();
				choice.action();
			})
			.appendTo(buttons);
	});
	$(document).on("keydown.boxDialog", function (ev) {
		if (ev.key === "Escape") cancel();
	});
	$("body").append(dialog);
	buttons.find("button").first().focus();
}

/*
 * Called before navigating to another mode. Between Normal and Hardcore, when the current
 * box has anything in it, asks whether to carry the box over or use the other mode's own
 * box. Neither choice deletes anything: both boxes stay stored per mode.
 */
function confirmModeSwitch(fromMode, toMode, proceed, cancel) {
	var fromSets = getTransferableSetIds(fromMode);
	if (!BOX_TRANSFER_MODES[fromMode] || !BOX_TRANSFER_MODES[toMode] || !fromSets.length) {
		proceed();
		return;
	}
	var toCount = getSetIds(readCustomSets(toMode)).length;
	var fromLabel = BOX_TRANSFER_MODES[fromMode];
	var toLabel = BOX_TRANSFER_MODES[toMode];
	showChoiceDialog(
		"Switching to " + toLabel,
		"Do you want to transfer your box (" + fromSets.length + " Pok\u00e9mon) to " + toLabel +
			", or keep the two boxes separate? Your " + fromLabel + " box is kept either way, so it will still be here when you switch back.",
		[{
			label: "Transfer box to " + toLabel,
			primary: true,
			action: function () {
				transferBox(fromMode, toMode);
				proceed();
			}
		}, {
			label: toCount ? "Use " + toLabel + "'s own box (" + toCount + " Pok\u00e9mon)" : "Start fresh",
			action: proceed
		}],
		cancel);
}

$(document).ready(function () {
	$("#p1").after(buildBoxTools()).before(buildBoxPanel());
	placeBoxPanel(isBoxOnTop());
	bindBoxEvents();
	renderBox();
	$(document).on("customsets:changed", renderBox);
});
