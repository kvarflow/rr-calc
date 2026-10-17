/*
 * Small-screen layout, for a handheld's second screen such as the AYN Thor's lower screen
 * (3.92", 1240 x 1080): the panels become tabs (Battle, You, Foe, Advanced, Box, Wild, More) with
 * big touch targets, one shown at a time. The Battle tab shows your Pokémon's moves beside the
 * trainer's, then your team and his as cards (yours color coded), so switching is one tap: drag
 * your team into order, mark the trainer's Pokémon KO'd and move on to the next trainer there.
 *
 * It turns on by itself on small screens; the footer's "Layout" setting forces it on or off
 * (saved per device). Without a viewport tag phones and handhelds lay the page out about 980px
 * wide and shrink it, so for the small layout the page's <head> writes one (it only takes
 * effect before the page is laid out, which is why changing the setting reloads the page).
 */

var SMALL_SCREEN_KEY = "smallScreenLayout"; // "auto", "on" or "off"
var SMALL_SCREEN_TAB_KEY = "smallScreenTab";
// Screens up to this many CSS pixels on their shorter side count as small (the Thor's lower
// screen gives the page 537 x 468 at 2.31x scaling).
var SMALL_SCREEN_MAX = 640;
// (The Battle and Advanced tabs keep their first names, "results" and "field", as keys: a tab
// saved on a device opens again.)
var SMALL_SCREEN_TABS = [
	{key: "results", label: "Battle", parts: ".move-result-group, .main-result-group, #ss-quick"},
	{key: "you", label: "You", parts: "#p1"},
	{key: "foe", label: "Foe", parts: "#p2"},
	{key: "field", label: "Advanced", short: "Adv.", parts: "#trainer-nav, #run-progress, .field-info"},
	{key: "box", label: "Box", parts: "#box-panel, #box-tools"},
	{key: "more", label: "More", parts: ".poke-import, #range-compare, #ss-page-settings, .credits"}
];

function getSmallScreenSetting() {
	var setting = readSetting(SMALL_SCREEN_KEY);
	return setting === "on" || setting === "off" ? setting : "auto";
}

function isSmallDevice() {
	return Math.min(screen.width, screen.height) <= SMALL_SCREEN_MAX;
}

function isSmallScreenOn() {
	var setting = getSmallScreenSetting();
	return setting === "on" || (setting === "auto" && isSmallDevice());
}

function showSmallScreenTab(key) {
	writeSetting(SMALL_SCREEN_TAB_KEY, key);
	$("html").attr("data-ss-tab", key);
	$("#ss-tabs .ss-tab").each(function () {
		var active = $(this).attr("data-tab") === key;
		$(this).toggleClass("ss-tab-active", active).attr("aria-selected", active);
	});
	window.scrollTo(0, 0);
}

function applySmallScreenLayout() {
	var on = isSmallScreenOn();
	$("html").toggleClass("small-screen", on);
	if (on) {
		var saved = readSetting(SMALL_SCREEN_TAB_KEY);
		// A tab this page does not have (Wild is not on desktop) opens Results instead.
		showSmallScreenTab($('#ss-tabs .ss-tab[data-tab="' + saved + '"]').length ? saved : "results");
	}
	updateViewportReadout();
}

// One side's team as a card of sprites; tapping one does what tapping the original does.
// Your team keeps the color coding the box gives it; the trainer's shows its KOs.
function buildTeamCard(label, originals, activeIndex) {
	var card = $('<div class="ss-quick-side"></div>')
		.append($('<div class="ss-quick-head"></div>').append($('<span class="ss-quick-label"></span>').text(label)));
	var grid = $('<div class="ss-quick-grid"></div>').appendTo(card);
	originals.each(function (i) {
		var original = $(this);
		var colors = (original.attr("class") || "").split(/\s+/).filter(function (name) {
			return /^cc-/.test(name);
		});
		$('<button type="button" class="ss-quick-mon"></button>')
			.addClass(colors.join(" "))
			.toggleClass("ss-quick-active", i === activeIndex)
			.toggleClass("ss-quick-ko", original.hasClass("trainer-pokemon-ko"))
			.attr({title: original.attr("data-set-id"), "data-set-id": original.attr("data-set-id")})
			.append(original.find("img").first().clone().attr("draggable", "false"))
			.click(function () {
				if (dragJustEnded) return; // the tap that ended a drag
				original.click();
			})
			.appendTo(grid);
	});
	return card;
}

// The trainer's card: Previous / Next trainer beside his name, and KO'd for the Pokémon you
// face (it loads his next one still standing). Once his whole team is KO'd, Next stands out.
function buildTrainerCard() {
	var foe = $("#trainer-team .pokemon-sprite");
	var card = buildTeamCard($("#trainer-name").text() || "Trainer", foe, typeof activeTrainerSlot === "number" ? activeTrainerSlot : -1);
	if (typeof toggleActiveKO !== "function") return card;
	var defeated = isTrainerDefeated(currentTrainerIndex);
	var step = function (label, original, text) {
		return $('<button type="button" class="ss-quick-step"></button>').attr("aria-label", label).text(text)
			.prop("disabled", $(original).prop("disabled"))
			.click(function () {
				$(original).click();
			});
	};
	card.addClass("ss-quick-trainer").toggleClass("ss-quick-defeated", defeated);
	card.find(".ss-quick-head").prepend(step("Previous trainer", "#previous-trainer", "\u25C0")).append(
		defeated ? '<span class="ss-quick-badge">Defeated \u2713</span>' : "",
		step("Next trainer", "#next-trainer", "\u25B6").toggleClass("ss-quick-next", defeated),
		$('<button type="button" class="ss-quick-ko-btn"></button>')
			.text($("#trainer-ko").text() === "Undo KO" ? "Undo KO" : "KO")
			.attr("title", "Mark the Pokémon you face as KO'd and load his next one")
			.click(toggleActiveKO));
	return card;
}

// Your team's order, by dragging a card onto another's place (a tap still loads it). The new
// order is the Team section's, as on the Box tab.
var dragJustEnded = false;

function moveTeamMember(from, to) {
	var layout = readBoxLayout();
	var team = (layout.team || []).slice();
	if (from === to || from < 0 || to < 0 || from >= team.length || to >= team.length) return;
	team.splice(to, 0, team.splice(from, 1)[0]);
	layout.team = team;
	writeBoxLayout(layout);
	renderBox();
}

// (jQuery 1.9 does not copy pointer events' fields, so these read the browser's event.)
function bindTeamDrag(quick) {
	var drag = null;
	// The browser's own image drag would cancel the pointer.
	quick.on("dragstart", function (ev) {
		ev.preventDefault();
	});
	quick.on("pointerdown", ".ss-quick-team .ss-quick-mon", function (event) {
		var ev = event.originalEvent;
		if (ev.button !== 0) return;
		drag = {card: $(this), x: ev.clientX, y: ev.clientY, moving: false, pointer: ev.pointerId};
	});
	$(document).on("pointermove", function (event) {
		var ev = event.originalEvent;
		if (!drag || ev.pointerId !== drag.pointer) return;
		var dx = ev.clientX - drag.x;
		var dy = ev.clientY - drag.y;
		if (!drag.moving) {
			if (Math.abs(dx) + Math.abs(dy) < 8) return;
			drag.moving = true;
			drag.card.addClass("ss-dragging");
		}
		ev.preventDefault();
		drag.card.css("transform", "translate(" + dx + "px, " + dy + "px)");
		var under = $(document.elementFromPoint(ev.clientX, ev.clientY)).closest(".ss-quick-team .ss-quick-mon");
		quick.find(".ss-drop-target").removeClass("ss-drop-target");
		if (under.length && under[0] !== drag.card[0]) under.addClass("ss-drop-target");
	});
	$(document).on("pointerup pointercancel", function (event) {
		var ev = event.originalEvent;
		if (!drag || ev.pointerId !== drag.pointer) return;
		var moved = drag.moving;
		var target = quick.find(".ss-drop-target");
		var cards = quick.find(".ss-quick-team .ss-quick-mon");
		var from = cards.index(drag.card);
		var to = target.length && ev.type === "pointerup" ? cards.index(target) : -1;
		drag.card.removeClass("ss-dragging").css("transform", "");
		target.removeClass("ss-drop-target");
		drag = null;
		if (!moved) return;
		// The click that follows the drag must not load the Pokémon.
		dragJustEnded = true;
		setTimeout(function () {
			dragJustEnded = false;
		}, 0);
		if (to !== -1) moveTeamMember(from, to);
	});
}

/*
 * You and Foe on one screen each (only in the small layout; the desktop panels are left as they
 * are): the set's name with its sprite, the save lock and the Base / IVs / EVs button on one line,
 * and Current HP as one line with a slim bar and Salt Cure.
 * Elements are moved, not copied, so the calculator's handlers keep working.
 */
function compactPokemonPanel(panel, statsToggle) {
	// Only the set dropdown moves: the calculator finds the forme from the set input's siblings.
	var selector = panel.find(".select2-container.set-selector").first();
	$('<div class="ss-panel-head"></div>')
		.insertBefore(selector)
		.append(panel.find(".header-sprite"), selector, panel.find(".save-lock-note"), statsToggle);

	var hp = panel.find(".current-hp").parent().addClass("ss-hp");
	hp.contents().filter(function () {
		return this.nodeType === 3; // "/", "(", "%)" and "Health"
	}).remove();
	hp.children("br").remove();
	hp.children("label").first().text("HP");
	panel.find(".max-hp").before('<span class="ss-hp-sep">/</span>');
	panel.find(".percent-hp").after('<span class="ss-hp-sep">%</span>');
	var saltCure = panel.find(".saltcure").closest(".left");
	saltCure.parent().addClass("ss-moved-out");
	hp.append(saltCure);
}

/*
 * Advanced (the Field panel, small layout only): the battle format, weather, terrain and rooms
 * each in a section of their own, then your side's and the foe's conditions side by side as
 * buttons (both in the same order), then Export. The buttons are moved, not copied.
 */
function compactFieldPanel(field) {
	var section = function (title, parts) {
		return $('<section class="ss-field-section"></section>').append($("<h4></h4>").text(title), parts);
	};
	var group = function (selector) {
		return field.children("div").filter(function () {
			return $(this).find(selector).length > 0;
		});
	};
	// The foe's side is laid out mirrored ("3 Spikes 2 1 0"): put its buttons in your side's order.
	var mirror = function (side) {
		side.children("input").get().reverse().forEach(function (input) {
			side.append($(input).add($(input).next("label")));
		});
		return side;
	};
	var yours = $('<div class="ss-field-chips"></div>');
	var foes = $('<div class="ss-field-chips"></div>');
	var exports = $('<div class="ss-field-chips"></div>');
	field.find("table.field tbody tr").each(function () {
		var row = $(this);
		if (row.hasClass("gen-specific") && !row.hasClass("g" + gen)) return; // another generation's
		var left = row.find(".left").first();
		var right = row.find(".right").first();
		if (left.find("#exportL").length) {
			left.find("#exportL").text("Export yours");
			right.find("#exportR").text("Export the foe's");
			exports.append(left, right);
			return;
		}
		yours.append(left);
		foes.append(mirror(right));
	});
	field.append(
		section("Battle", [group("[name=format]"), group("[name=ruin]")]),
		section("Weather", field.children('div[aria-labelledby="selectWeatherInstruction"]')),
		section("Terrain", group("[name=terrain]")),
		section("Rooms and gravity", [group("#magicroom"), group("#trickroom")]),
		$('<div class="ss-field-sides"></div>').append(section("Your side", yours), section("Foe's side", foes)),
		section("Export", exports));
	field.children("table.field, hr, div:has([name=gscWeather])").addClass("ss-moved-out");
}

/*
 * More (small layout only): the import, Fight Notes and Range Compare first, then a Settings card
 * lower down: the calculator's mode and its notation as sliding selectors, the layout, the theme
 * and the display switches. The credits close the tab.
 */
function segmentedSelector(group) {
	var labels = group.children("label");
	var update = function () {
		var index = labels.index(group.find("input:checked").next("label"));
		// (jQuery 1.9 cannot set custom properties.)
		group[0].style.setProperty("--seg-count", labels.length);
		group[0].style.setProperty("--seg-index", Math.max(0, index));
		group.toggleClass("ss-segmented-none", index === -1);
	};
	group.addClass("ss-segmented").find("input").change(update);
	update();
	return group;
}

function buildSettingsCard() {
	var row = function (title, control) {
		return $('<div class="ss-setting"></div>').append($('<span class="ss-setting-label"></span>').text(title), control);
	};
	var page = $("#ss-page-settings");
	var siteSettings = $(".site-settings");
	var layout = $(".ss-layout-setting");
	layout.contents().filter(function () {
		return this.nodeType === 3; // its "Layout" label: the row has its own
	}).remove();
	var card = $('<fieldset id="ss-settings" class="ss-settings" data-ss-part="more"><legend align="center">Settings</legend></fieldset>').append(
		row("Mode", segmentedSelector(page.find(".modeSelection"))),
		row("Damage as", segmentedSelector(page.find(".notationSelection"))),
		row("Layout", layout),
		row("Theme", $("#dark-theme-toggle")),
		$('<div class="ss-setting-switches"></div>').append(siteSettings.children("label").not(layout)));
	page.attr("data-ss-part", "none"); // what is left of it (the generation) stays hidden
	siteSettings.children("b").remove();
	card.insertBefore(".credits");
	// Range Compare's target, as a sliding selector too.
	var target = $('<span class="rc-target"></span>').insertBefore("#rc-target-p1");
	target.append($("#rc-target-p1, #rc-target-p1 + label, #rc-target-p2, #rc-target-p2 + label"));
	segmentedSelector(target);
}

function renderQuickStrips() {
	if (!$("html").hasClass("small-screen")) return;
	var quick = $("#ss-quick").empty();
	var team = $('.box-dropzone[data-section="team"] .box-pokemon');
	var p1Set = $("#p1 input.set-selector").val();
	var yours = buildTeamCard("Your team", team, team.map(function () {
		return $(this).attr("data-set-id");
	}).get().indexOf(p1Set)).addClass("ss-quick-team");
	if (!team.length) yours.append('<p class="ss-quick-empty">Import your .sav under More to see your team here.</p>');
	else yours.find(".ss-quick-mon").attr("title", function (i, title) {
		return title + " (drag to reorder)";
	});
	quick.append(yours);
	if ($("#trainer-team .pokemon-sprite").length) quick.append(buildTrainerCard());
}

// Shorter results text that fits beside each move.
function compactResults(p1Name, p2Name) {
	// Just the names: "(select one to show detailed results)" does not fit.
	$("#resultHeaderL").empty().append('<span class="ss-side-label">You</span>', document.createTextNode(p1Name));
	$("#resultHeaderR").empty().append('<span class="ss-side-label">Foe</span>', document.createTextNode(p2Name));
	// Just the damage range, as "21.2–27.2%"; recoil and recovery are in the detailed result below.
	$('.move-result-subgroup span[id^="resultDamage"]').text(function (i, text) {
		return text.replace(/ \(.*$/, "").replace(" - ", "\u2013");
	});
}

function toggleFullscreen() {
	if (document.fullscreenElement) {
		document.exitFullscreen();
	} else {
		document.documentElement.requestFullscreen().catch(function () {
			// Refused (e.g. not allowed in this browser): nothing to undo.
		});
	}
}

function updateViewportReadout() {
	$("#ss-viewport").text("Screen " + window.innerWidth + " × " + window.innerHeight +
		" at ×" + (Math.round(window.devicePixelRatio * 100) / 100));
}

$(document).ready(function () {
	var tabs = $('<nav id="ss-tabs" class="ss-tabs" role="tablist" aria-label="Calculator sections"></nav>');
	// The wild encounters (encounters.js), before More.
	var tabList = SMALL_SCREEN_TABS.slice();
	if ($("#encounters").length) tabList.splice(tabList.length - 1, 0, {key: "wild", label: "Wild", parts: "#encounters"});
	tabList.forEach(function (tab) {
		$(tab.parts).attr("data-ss-part", function (i, parts) {
			return (parts ? parts + " " : "") + tab.key;
		});
		$('<button type="button" class="ss-tab" role="tab"></button>')
			.attr({"data-tab": tab.key, "data-short": tab.short}) // the short label: upright phones
			.text(tab.label)
			.click(function () {
				showSmallScreenTab(tab.key);
			})
			.appendTo(tabs);
	});
	// Full screen hides the browser's address bar, which otherwise takes part of a small screen.
	if (document.documentElement.requestFullscreen) {
		$('<button type="button" id="ss-fullscreen" class="ss-tab ss-fullscreen" aria-pressed="false" title="Full screen (hides the address bar)">\u26F6</button>')
			.click(toggleFullscreen)
			.appendTo(tabs);
		$(document).on("fullscreenchange", function () {
			$("#ss-fullscreen").attr("aria-pressed", !!document.fullscreenElement)
				.attr("title", document.fullscreenElement ? "Leave full screen" : "Full screen (hides the address bar)");
			updateViewportReadout();
		});
	}
	$(".wrapper").prepend(tabs);
	// The You and Foe tabs show each stat's value and stage buttons; this shows the full table.
	$("#p1, #p2").each(function () {
		var panel = $(this);
		var toggle = $('<button type="button" class="panel-toggle ss-stats-toggle" aria-expanded="false">Base / IVs / EVs</button>')
			.click(function () {
				var full = !panel.hasClass("ss-stats-full");
				panel.toggleClass("ss-stats-full", full);
				$(this).attr("aria-expanded", full);
			})
			.appendTo(panel.children(".panel-toggles"));
		if (isSmallScreenOn()) compactPokemonPanel(panel, toggle);
	});
	if (isSmallScreenOn()) compactFieldPanel($(".field-info"));
	// The mode and notation switches, shown under More.
	$(".wrapper > div").first().attr("id", "ss-page-settings").attr("data-ss-part", "more");
	bindTeamDrag($('<div id="ss-quick" class="ss-quick" data-ss-part="results"></div>').insertAfter(".main-result-group"));

	var layout = $('<label class="ss-layout-setting">Layout <select id="ss-layout">' +
		'<option value="auto">Automatic</option><option value="on">Small screen</option><option value="off">Desktop</option>' +
		'</select></label>');
	layout.find("select").val(getSmallScreenSetting()).change(function () {
		writeSetting(SMALL_SCREEN_KEY, $(this).val());
		// The viewport tag is written while the page loads (see the page's <head>).
		window.location.reload();
	});
	$(".site-settings").append(layout, ' <span id="ss-viewport" class="ss-viewport"></span>');
	$(window).on("resize orientationchange", updateViewportReadout);
	if (isSmallScreenOn()) buildSettingsCard();

	$(document).on("calc:done", function (event, p1, p2) {
		if ($("html").hasClass("small-screen")) compactResults(p1.name, p2.name);
	});
	$(document).on("calc:done trainer:shown trainer:active trainer:progress customsets:changed colorcoding:changed box:rendered", renderQuickStrips);
	applySmallScreenLayout();
	renderQuickStrips();
	// The page may have calculated before this script was ready (One vs One does).
	if ($("html").hasClass("small-screen") && damageResults) {
		compactResults(damageResults[0][0].attacker.name, damageResults[1][0].attacker.name);
	}
});
