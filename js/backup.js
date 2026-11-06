/*
 * Back up and restore (Settings, and More → Data on small screens): everything the calculator
 * keeps in this browser (boxes and imported sets, runs, KOs, fainted, encounters, trainer progress
 * and order, settings; every game and mode) as one .json file, to keep safe or to move to another
 * browser or device. Restoring replaces this browser's data with the file's and reloads.
 *
 * A few settings belong to the device rather than the run, and are neither saved nor replaced:
 * the layout, tab and text size, the desktop style, which sheet was open, emulator sync and
 * whether What's new has been seen.
 */
var BACKUP_APP = "rr-calc";
var BACKUP_DEVICE_KEYS = ["smallScreenLayout", "smallScreenTab", "textSize", "desktopStyle", "lastSheet",
	"emulatorSync", "lastChangelogVersion"];

function isBackupKey(key) {
	return BACKUP_DEVICE_KEYS.indexOf(key) === -1;
}

// {key: value} for every key the backup covers; throws when storage can't be read.
function readBackupData() {
	var data = {};
	for (var i = 0; i < localStorage.length; i++) {
		var key = localStorage.key(i);
		if (isBackupKey(key)) data[key] = localStorage.getItem(key);
	}
	return data;
}

function pad2(n) {
	return ("0" + n).slice(-2);
}

function backUpCalcData() {
	var data;
	try {
		data = readBackupData();
	} catch (e) {
		alert("This browser isn't letting the calculator read its data (private browsing?), so there is nothing to back up.");
		return;
	}
	var now = new Date();
	var backup = {
		app: BACKUP_APP,
		version: typeof getLatestVersion === "function" ? getLatestVersion() : "",
		saved: now.toISOString(),
		data: data
	};
	var name = "rr-calc-backup-" + now.getFullYear() + "-" + pad2(now.getMonth() + 1) + "-" + pad2(now.getDate()) +
		"-" + pad2(now.getHours()) + pad2(now.getMinutes()) + ".json";
	var url = URL.createObjectURL(new Blob([JSON.stringify(backup)], {type: "application/json"}));
	var link = $("<a></a>").attr({href: url, download: name}).appendTo("body");
	link[0].click();
	link.remove();
	setTimeout(function () {
		URL.revokeObjectURL(url);
	}, 1000);
}

// The backup in a file's text, or null when it isn't one.
function parseBackup(text) {
	var backup;
	try {
		backup = JSON.parse(text);
	} catch (e) {
		return null;
	}
	if (!backup || backup.app !== BACKUP_APP || !backup.data || typeof backup.data !== "object") return null;
	var valid = Object.keys(backup.data).every(function (key) {
		return typeof backup.data[key] === "string";
	});
	return valid ? backup : null;
}

// Replaces this browser's data with the backup's (the device's own settings stay).
function applyBackup(backup) {
	var current = Object.keys(readBackupData());
	current.forEach(function (key) {
		localStorage.removeItem(key);
	});
	Object.keys(backup.data).forEach(function (key) {
		if (isBackupKey(key)) localStorage.setItem(key, backup.data[key]);
	});
}

function restoreCalcData(file) {
	var reader = new FileReader();
	reader.onload = function () {
		var backup = parseBackup(reader.result);
		if (!backup) {
			alert("That file isn't a calculator backup.");
			return;
		}
		var when = backup.saved ? new Date(backup.saved).toLocaleString() : "an unknown date";
		if (!confirm("Restore the backup from " + when + "?\n\nIt replaces everything the calculator keeps in this " +
			"browser (boxes, runs, encounters, settings) with the backup's.")) return;
		try {
			applyBackup(backup);
		} catch (e) {
			alert("Couldn't restore: this browser isn't letting the calculator save (storage full or private browsing?).");
			return;
		}
		window.location.reload();
	};
	reader.onerror = function () {
		alert("Couldn't read that file.");
	};
	reader.readAsText(file);
}

// The Back up and Restore buttons (with the file picker Restore opens).
function buildBackupButtons() {
	var input = $('<input type="file" class="backup-file" accept=".json,application/json" hidden />').change(function () {
		if (this.files && this.files[0]) restoreCalcData(this.files[0]);
		this.value = "";
	});
	return $('<span class="backup-buttons"></span>').append(
		$('<button type="button" id="backup-data" title="Save everything the calculator keeps in this browser as a file">Back up</button>')
			.click(backUpCalcData),
		" ",
		$('<button type="button" id="restore-data" title="Load a backup file, replacing this browser\'s data">Restore</button>')
			.click(function () {
				input.click();
			}),
		input);
}

$(document).ready(function () {
	// Small screens put them in the Settings card under More (small_screen.js).
	if ($("html").hasClass("small-screen")) return;
	$(".site-settings").append($('<span class="backup-setting">Data </span>').append(buildBackupButtons()));
});
