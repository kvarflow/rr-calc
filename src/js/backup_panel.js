/*
 * Backup and restore: everything the calculator keeps in this browser (every mode's box, runs and
 * personal bests, settings, fight notes) as one file, and back from one. It works on the website
 * and in the Pcalc app (kvarflow/Pcalc), whose download and file picker handle the file.
 *
 * In Pcalc there is also a backup folder on the device. The app writes a backup there by itself
 * whenever you leave it (window.pcalcBackupData, below), keeping the latest ten, and before any
 * restore, so a restore can be undone. By default that is the app's own folder; you can point it at
 * one of your own (Choose folder), which also survives the app being uninstalled.
 */

var BACKUP_FORMAT = 1;

// Everything this calculator keeps, as a backup object.
function collectBackup() {
	var data = {};
	try {
		for (var i = 0; i < localStorage.length; i++) {
			var key = localStorage.key(i);
			data[key] = localStorage.getItem(key);
		}
	} catch (e) {
		// Storage unavailable: an empty backup.
	}
	return {app: "rr-calc", format: BACKUP_FORMAT, created: new Date().toISOString(), data: data};
}

// For Pcalc's automatic backups: the backup as text.
window.pcalcBackupData = function () {
	return JSON.stringify(collectBackup());
};

// A backup file's text as a backup object, or an Error saying why it isn't one.
function parseBackup(text) {
	var backup;
	try {
		backup = JSON.parse(text);
	} catch (e) {
		throw new Error("This file isn't a calculator backup.");
	}
	if (!backup || backup.app !== "rr-calc" || !backup.data || typeof backup.data !== "object") {
		throw new Error("This file isn't a calculator backup.");
	}
	if (backup.format > BACKUP_FORMAT) throw new Error("This backup was made by a newer version of the calculator.");
	Object.keys(backup.data).forEach(function (key) {
		if (typeof backup.data[key] !== "string") throw new Error("This backup is damaged.");
	});
	return backup;
}

function describeBackupDate(backup) {
	var date = new Date(backup.created);
	return isNaN(date) ? "an unknown date" : date.toLocaleString();
}

// Replaces everything saved here with the backup's, after asking, and reloads.
function restoreBackup(backup) {
	var count = Object.keys(backup.data).length;
	if (!window.confirm("Restore the backup from " + describeBackupDate(backup) + "?\n\nIt replaces everything saved " +
		"here (boxes, runs, settings) with the backup's " + count + " items." +
		(isPcalcApp() ? " The app backs up what is here now first." : " Save a backup first if you may want it back."))) return;
	var apply = function () {
		try {
			localStorage.clear();
			Object.keys(backup.data).forEach(function (key) {
				localStorage.setItem(key, backup.data[key]);
			});
		} catch (e) {
			window.alert("Couldn't restore: " + e.message);
			return;
		}
		window.location.reload();
	};
	// In the app, a backup of what is here now comes first.
	if (isPcalcApp()) pcalcBackupRequest({type: "backup:save", reason: "before-restore", data: window.pcalcBackupData()}, apply);
	else apply();
}

function isPcalcApp() {
	return pcalcBridge.available();
}

// Pcalc's backup folder: a request to the app and its answer (pcalc_bridge.js).
function pcalcBackupRequest(message, callback) {
	pcalcBridge.request(message, callback);
}

function backupFileName() {
	var now = new Date();
	var pad = function (n) {
		return (n < 10 ? "0" : "") + n;
	};
	return "rr-calc-backup-" + now.getFullYear() + "-" + pad(now.getMonth() + 1) + "-" + pad(now.getDate()) + ".json";
}

function downloadBackup() {
	var link = $("<a></a>").attr({
		href: URL.createObjectURL(new Blob([window.pcalcBackupData()], {type: "application/json"})),
		download: backupFileName()
	}).appendTo("body");
	link[0].click();
	link.remove();
}

function buildBackupPanel() {
	var panel = $('<div class="backup-panel"><b>Backup</b></div>');
	var status = $('<div class="backup-status" role="status"></div>');
	var setStatus = function (text, bad) {
		status.text(text).toggleClass("backup-status-bad", !!bad);
	};
	var row = $('<div class="backup-actions"></div>').appendTo(panel);
	$('<button type="button" class="bs-btn bs-btn-default">Save backup file</button>').click(downloadBackup).appendTo(row);
	var fileInput = $('<input type="file" accept=".json,application/json" class="visually-hidden" />').change(function () {
		var file = this.files && this.files[0];
		this.value = "";
		if (!file) return;
		var reader = new FileReader();
		reader.onload = function () {
			try {
				restoreBackup(parseBackup(String(reader.result)));
			} catch (e) {
				setStatus(e.message, true);
			}
		};
		reader.readAsText(file);
	}).appendTo(panel);
	$('<button type="button" class="bs-btn bs-btn-default">Restore from file</button>').click(function () {
		fileInput.click();
	}).appendTo(row);

	if (isPcalcApp()) buildPcalcBackupFolder(panel, setStatus);
	panel.append(status);
	return panel;
}

// The app's backup folder: where it is, choose another, back up now, restore one of its backups.
function buildPcalcBackupFolder(panel, setStatus) {
	var folder = $('<div class="backup-folder"></div>').appendTo(panel);
	var where = $('<div class="backup-where"></div>').appendTo(folder);
	var actions = $('<div class="backup-actions"></div>').appendTo(folder);
	var list = $('<select class="backup-list" aria-label="Backups in the folder"></select>');
	var showStatus = function (reply) {
		where.empty().append($("<span></span>").text("Backup folder: "), $("<b></b>").text(reply.folder || "this app's folder"),
			document.createTextNode(reply.last ? " · last backup " + new Date(reply.last).toLocaleString() : ""));
	};
	var refresh = function () {
		pcalcBackupRequest({type: "backup:list"}, function (reply) {
			showStatus(reply);
			list.empty();
			(reply.files || []).forEach(function (file) {
				list.append($("<option></option>").val(file.name).text(file.name));
			});
			list.prop("disabled", !(reply.files || []).length);
			restore.prop("disabled", !(reply.files || []).length);
		});
	};
	$('<button type="button" class="bs-btn bs-btn-default">Back up now</button>').click(function () {
		pcalcBackupRequest({type: "backup:save", reason: "manual", data: window.pcalcBackupData()}, function (reply) {
			setStatus(reply.error ? "Couldn't back up: " + reply.error : "Backed up as " + reply.name, !!reply.error);
			refresh();
		});
	}).appendTo(actions);
	$('<button type="button" class="bs-btn bs-btn-default">Choose folder</button>').click(function () {
		pcalcBackupRequest({type: "backup:chooseFolder"}, function (reply) {
			if (reply.error) setStatus(reply.error, true);
			refresh();
		});
	}).appendTo(actions);
	var restoreRow = $('<div class="backup-actions"></div>').appendTo(folder);
	list.appendTo(restoreRow);
	var restore = $('<button type="button" class="bs-btn bs-btn-default">Restore</button>').click(function () {
		var name = list.val();
		if (!name) return;
		pcalcBackupRequest({type: "backup:read", name: name}, function (reply) {
			if (reply.error) {
				setStatus("Couldn't read " + name + ": " + reply.error, true);
				return;
			}
			try {
				restoreBackup(parseBackup(reply.data));
			} catch (e) {
				setStatus(e.message, true);
			}
		});
	}).appendTo(restoreRow);
	$('<div class="backup-help"></div>').text("The app backs up here by itself whenever you leave it (the latest ten are kept). " +
		"A folder of your own keeps them even if the app is uninstalled.").appendTo(folder);
	refresh();
}

$(document).ready(function () {
	var actions = $(".import-actions");
	if (!actions.length) return;
	actions.first().closest("#import-1_wrapper").append(buildBackupPanel());
});
