/*
 * Small-screen layout, for a handheld's second screen such as the AYN Thor's lower screen
 * (3.92", 1240 x 1080): the panels become tabs (Results, You, Foe, Field, Box, More) with
 * big touch targets, one shown at a time. The Results tab shows your Pokémon's moves beside the
 * trainer's, then your team and his as cards (yours color coded), so switching is one tap.
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
var SMALL_SCREEN_TABS = [
	{key: "results", label: "Results", parts: ".move-result-group, .main-result-group, #ss-quick"},
	{key: "you", label: "You", parts: "#p1"},
	{key: "foe", label: "Foe", parts: "#p2, #trainer-nav, #run-progress"},
	{key: "field", label: "Field", parts: ".field-info"},
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
	if (on) showSmallScreenTab(readSetting(SMALL_SCREEN_TAB_KEY) || "results");
	updateViewportReadout();
}

// One side's team as a card of sprites; tapping one does what tapping the original does.
// Your team keeps the color coding the box gives it.
function buildTeamCard(label, originals, activeIndex) {
	var card = $('<div class="ss-quick-side"></div>').append($('<span class="ss-quick-label"></span>').text(label));
	var grid = $('<div class="ss-quick-grid"></div>').appendTo(card);
	originals.each(function (i) {
		var original = $(this);
		var colors = (original.attr("class") || "").split(/\s+/).filter(function (name) {
			return /^cc-/.test(name);
		});
		$('<button type="button" class="ss-quick-mon"></button>')
			.addClass(colors.join(" "))
			.toggleClass("ss-quick-active", i === activeIndex)
			.attr("title", original.attr("data-set-id"))
			.append(original.find("img").first().clone())
			.click(function () {
				original.click();
			})
			.appendTo(grid);
	});
	return card;
}

function renderQuickStrips() {
	if (!$("html").hasClass("small-screen")) return;
	var quick = $("#ss-quick").empty();
	var team = $('.box-dropzone[data-section="team"] .box-pokemon');
	var p1Set = $("#p1 input.set-selector").val();
	var yours = buildTeamCard("Your team", team, team.map(function () {
		return $(this).attr("data-set-id");
	}).get().indexOf(p1Set));
	if (!team.length) yours.append('<p class="ss-quick-empty">Import your .sav under More to see your team here.</p>');
	quick.append(yours);
	var foe = $("#trainer-team .pokemon-sprite");
	if (foe.length) {
		quick.append(buildTeamCard($("#trainer-name").text() || "Trainer", foe, typeof activeTrainerSlot === "number" ? activeTrainerSlot : -1));
	}
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
	SMALL_SCREEN_TABS.forEach(function (tab) {
		$(tab.parts).attr("data-ss-part", function (i, parts) {
			return (parts ? parts + " " : "") + tab.key;
		});
		$('<button type="button" class="ss-tab" role="tab"></button>')
			.attr("data-tab", tab.key)
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
		$('<button type="button" class="panel-toggle ss-stats-toggle" aria-expanded="false">Base / IVs / EVs</button>')
			.click(function () {
				var full = !panel.hasClass("ss-stats-full");
				panel.toggleClass("ss-stats-full", full);
				$(this).attr("aria-expanded", full);
			})
			.appendTo(panel.children(".panel-toggles"));
	});
	// The mode and notation switches, shown under More.
	$(".wrapper > div").first().attr("id", "ss-page-settings").attr("data-ss-part", "more");
	$('<div id="ss-quick" class="ss-quick" data-ss-part="results"></div>').insertAfter(".main-result-group");

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

	$(document).on("calc:done", function (event, p1, p2) {
		if ($("html").hasClass("small-screen")) compactResults(p1.name, p2.name);
	});
	$(document).on("calc:done trainer:shown trainer:active customsets:changed colorcoding:changed", renderQuickStrips);
	applySmallScreenLayout();
	renderQuickStrips();
	// The page may have calculated before this script was ready (One vs One does).
	if ($("html").hasClass("small-screen") && damageResults) {
		compactResults(damageResults[0][0].attacker.name, damageResults[1][0].attacker.name);
	}
});
