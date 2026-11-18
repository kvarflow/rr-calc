/*
 * The More tab's Import / Export card, tidied for the small layout (the Thor, phones, the Pcalc app).
 * The parts are built by their own scripts (save_import.js, emulator_sync.js, backup_panel.js); this
 * only arranges them, into one group each (Your save, Emulator sync, Backup, Fight Notes) with a
 * heading row. How each one works folds away behind "?". In the Pcalc app it also adds Calculator
 * updates to Settings: the calculator in use, and Check now.
 */

function buildMoreGroup(title, help) {
	var group = $('<section class="more-group"></section>');
	var head = $('<div class="more-head"></div>').appendTo(group);
	$('<h3 class="more-title"></h3>').text(title).appendTo(head);
	$('<span class="more-state"></span>').appendTo(head);
	if (help && help.length) {
		help.addClass("more-help");
		$('<button type="button" class="more-help-toggle" aria-expanded="false" aria-label="How it works">?</button>').click(function () {
			var open = !group.hasClass("more-help-open");
			group.toggleClass("more-help-open", open);
			$(this).attr("aria-expanded", open);
		}).appendTo(head);
	}
	$('<div class="more-body"></div>').appendTo(group);
	return group;
}

function tidyImportCard() {
	var card = $("fieldset.poke-import");
	var wrapper = card.find("#import-1_wrapper");
	var actions = wrapper.children(".import-actions");
	if (!card.length || !actions.length || card.hasClass("more-tidy")) return;
	card.addClass("more-tidy");

	// Your save: Import .sav, Custom set, and in the app the save it imports by itself.
	var save = buildMoreGroup("Your save", wrapper.find(".save-auto-help"));
	save.find(".more-body").append(actions, wrapper.children(".save-auto"));
	var groups = [save];

	// Emulator sync: an on/off switch in its heading; its status, and how to set it up behind "?".
	var syncButton = actions.find("#emulator-sync");
	if (syncButton.length) {
		var panel = wrapper.children("#emulator-sync-panel");
		var sync = buildMoreGroup("Emulator sync", panel.find(".emulator-sync-how, .emulator-sync-help"));
		var toggle = $('<input type="checkbox" class="more-switch" aria-label="Emulator sync" />');
		var showState = function () {
			toggle.prop("checked", syncButton.attr("aria-pressed") === "true");
		};
		toggle.change(function () {
			syncButton.click();
			showState();
		});
		sync.find(".more-help-toggle").before(toggle);
		syncButton.addClass("more-hidden");
		showState();
		sync.find(".more-body").append(panel);
		groups.push(sync);
	}

	// Backup: Back up now and Restore first; saving to or restoring from a file, and the folder, as
	// quieter links underneath. On the website (no folder) the two file buttons stay as they are.
	var backup = wrapper.children(".backup-panel");
	if (backup.length) {
		var group = buildMoreGroup("Backup", backup.find(".backup-help"));
		backup.children(".backup-title").remove();
		var folder = backup.children(".backup-folder");
		if (folder.length) {
			var links = $('<div class="more-links"></div>').append(
				backup.find(".backup-to-file").text("Save to a file"),
				backup.find(".backup-from-file").text("Restore from a file"),
				folder.find(".backup-choose-folder").text("Change folder"));
			links.children().removeClass("bs-btn bs-btn-default").addClass("more-link");
			backup.children(".backup-file-row").remove();
			folder.find(".backup-now").closest(".backup-actions").addClass("more-primary").append(folder.find(".backup-restore-row").children());
			folder.find(".backup-restore-row").remove();
			folder.append(links);
		}
		group.find(".more-body").append(backup);
		groups.push(group);
	}

	// Fight Notes: a group of its own.
	var notes = card.children(".fight-notes");
	if (notes.length) {
		var notesGroup = buildMoreGroup("Fight Notes");
		notes.children("label").addClass("visually-hidden");
		notesGroup.find(".more-body").append(notes);
		groups.push(notesGroup);
	}

	wrapper.prepend(groups);
	wrapper.children("input").appendTo(wrapper);
}

// Settings → Calculator updates (Pcalc): the calculator in use and when the app last looked, and
// Check now. The app answers calc:status (and offers the newer one with the "Calculator updated" bar).
// The row appears with the app's first calc:status, so an app too old to answer shows none.
function buildCalculatorUpdatesRow() {
	if (typeof pcalcBridge === "undefined" || !pcalcBridge.available() || $("#calc-updates").length) return;
	var placed = false;
	var state = $('<span class="calc-updates-state"></span>');
	var check = $('<button type="button" class="bs-btn bs-btn-default calc-updates-check">Check now</button>');
	var control = $('<div id="calc-updates" class="calc-updates"></div>').append(state, check);
	var day = function (time) {
		return new Date(time).toLocaleDateString(undefined, {day: "numeric", month: "short", year: "numeric"});
	};
	var ago = function (time) {
		var minutes = Math.round((Date.now() - time) / 60000);
		if (minutes < 1) return "just now";
		if (minutes < 60) return minutes + " min ago";
		var hours = Math.round(minutes / 60);
		return hours < 24 ? hours + " h ago" : day(time);
	};
	check.click(function () {
		check.prop("disabled", true).text("Checking…");
		pcalcBridge.send({type: "calc:check"});
	});
	pcalcBridge.on("calc:status", function (message) {
		if (!placed) {
			placed = true;
			placeRow();
		}
		var parts = [message.date ? "Version of " + day(message.date) : "Version in the app"];
		if (message.checking) parts.push("checking…");
		else if (message.error) parts.push("couldn't check: " + message.error);
		else if (message.ready) parts.push("newer one ready: reload to use it");
		else if (message.lastCheck) parts.push("up to date, checked " + ago(message.lastCheck));
		state.text(parts.join(" · ")).toggleClass("calc-updates-bad", !!message.error);
		check.prop("disabled", !!message.checking).text(message.checking ? "Checking…" : "Check now");
	});
	function placeRow() {
		var settings = $("#ss-settings");
		if (settings.length) {
			$('<div class="ss-setting"></div>').append($('<span class="ss-setting-label">Calculator updates</span>'), control)
				.insertBefore(settings.children(".ss-setting-switches"));
		} else {
			$(".site-settings").append($("<label>Calculator updates </label>").append(control));
		}
	}
}

$(document).ready(function () {
	// After the other scripts have built their parts (their ready handlers ran first).
	setTimeout(function () {
		if ($("html").hasClass("small-screen")) tidyImportCard();
		buildCalculatorUpdatesRow();
	}, 0);
});
