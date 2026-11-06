/*
 * RR Calc for Android (android/ in the repo): the app shows this site in a WebView and gives it
 * window.RRAndroid. Here:
 *  - rrAppBack: what the app's Back (the Thor's B button) does on the page: close a popup, a set
 *    picker, a sheet, or go back to the Battle tab. It returns false when there is nothing to
 *    close, and the app then asks for a second press before it leaves;
 *  - saveTextFile: a download, through the app (a WebView can't save blob: links) or the browser;
 *  - Back up / Restore data (Settings): everything the calc keeps on this device as one file, to
 *    move a run between the browser and the app, which keep separate storage.
 */
var ANDROID_APK_URL = "https://github.com/kvarflow/rr-calc/releases/download/android-latest/rr-calc.apk";

function isAndroidApp() {
	return typeof window.RRAndroid !== "undefined";
}

function getAndroidAppVersion() {
	try {
		return window.RRAndroid.version();
	} catch (e) {
		return "";
	}
}

// Saves text as a file named `name`.
function saveTextFile(name, mime, text) {
	if (isAndroidApp() && window.RRAndroid.saveFile) {
		window.RRAndroid.saveFile(name, mime, text);
		return;
	}
	var url = URL.createObjectURL(new Blob([text], {type: mime}));
	var link = $("<a></a>").attr({href: url, download: name}).appendTo("body");
	link[0].click();
	link.remove();
	setTimeout(function () {
		URL.revokeObjectURL(url);
	}, 1000);
}

// Back, from the app: true when it closed something.
window.rrAppBack = function () {
	var dialogs = $(".box-dialog-backdrop");
	if (dialogs.length) {
		// The popups close on Escape; one that doesn't is removed.
		$(document).trigger($.Event("keydown", {key: "Escape"}));
		if ($(".box-dialog-backdrop").length === dialogs.length) dialogs.last().remove();
		return true;
	}
	if ($(".select2-drop-active:visible").length) {
		$("input.select2-offscreen, select.select2-offscreen").each(function () {
			try {
				$(this).select2("close");
			} catch (e) {
				// Not a set picker after all.
			}
		});
		return true;
	}
	if (typeof openSheetKey !== "undefined" && openSheetKey) {
		closeSheet();
		return true;
	}
	if ($("html").hasClass("small-screen") && $("html").attr("data-ss-tab") !== "results" &&
		typeof showSmallScreenTab === "function") {
		showSmallScreenTab("results");
		return true;
	}
	return false;
};

// Everything the calc keeps on this device (localStorage), as a file.
function backUpCalcData() {
	var data = {};
	try {
		for (var i = 0; i < localStorage.length; i++) {
			var key = localStorage.key(i);
			data[key] = localStorage.getItem(key);
		}
	} catch (e) {
		alert("This browser isn't letting the calc read its storage, so there is nothing to back up.");
		return;
	}
	var now = new Date();
	var stamp = now.getFullYear() + "-" + ("0" + (now.getMonth() + 1)).slice(-2) + "-" + ("0" + now.getDate()).slice(-2);
	saveTextFile("rr-calc-backup-" + stamp + ".json", "application/json",
		JSON.stringify({app: "rr-calc", saved: now.toISOString(), data: data}));
}

function restoreCalcData(file) {
	var reader = new FileReader();
	reader.onload = function () {
		var backup;
		try {
			backup = JSON.parse(reader.result);
		} catch (e) {
			backup = null;
		}
		if (!backup || backup.app !== "rr-calc" || typeof backup.data !== "object") {
			alert("That file isn't a calc backup.");
			return;
		}
		var when = backup.saved ? new Date(backup.saved).toLocaleString() : "an unknown date";
		if (!confirm("Replace everything the calc keeps here (boxes, runs, settings) with the backup from " + when + "?")) return;
		try {
			localStorage.clear();
			Object.keys(backup.data).forEach(function (key) {
				localStorage.setItem(key, backup.data[key]);
			});
		} catch (e) {
			alert("Couldn't restore: this browser isn't letting the calc save.");
			return;
		}
		window.location.reload();
	};
	reader.readAsText(file);
}

function buildDataButtons() {
	var input = $('<input type="file" accept=".json,application/json" hidden />').change(function () {
		if (this.files && this.files[0]) restoreCalcData(this.files[0]);
		this.value = "";
	});
	return $('<span class="data-backup"></span>').append(
		$('<button type="button" id="backup-data" title="Everything the calc keeps here, as a file">Back up data</button>').click(backUpCalcData),
		" ",
		$('<button type="button" id="restore-data" title="Load a backup made here or on another device">Restore data</button>').click(function () {
			input.click();
		}),
		input);
}

// Settings > App: "Android app ✓" in the app; elsewhere, a link to it.
function buildAndroidAppLink() {
	if (isAndroidApp()) {
		return $('<span class="android-app-status"></span>').text("Android app ✓ " + getAndroidAppVersion());
	}
	return $('<a class="android-app-link links-lighten" target="_blank" rel="noopener"></a>')
		.attr("href", ANDROID_APK_URL).text("Android app (APK)");
}

$(document).ready(function () {
	if (isAndroidApp()) $("html").addClass("android-app");
	$(".site-settings").append(" ", buildDataButtons());
});
