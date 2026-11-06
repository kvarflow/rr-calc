/*
 * Offline mode (sw.js): once the page has been opened online, the calculator keeps working
 * with no connection. The footer settings say whether it is ready.
 */

function setOfflineStatus(text) {
	$("#offline-status").text(text);
}

$(document).ready(function () {
	$(".site-settings").append(' <span id="offline-status" class="offline-status"></span>');
	// Inside the Pcalc app (kvarflow/Pcalc) every file is already in the app: nothing to save.
	if (/\bPcalc\//.test(navigator.userAgent)) {
		setOfflineStatus("Offline: built into the app \u2713");
		return;
	}
	// Service workers need https (or this computer); a page opened from a file cannot use one.
	if (!("serviceWorker" in navigator) || !window.isSecureContext) {
		setOfflineStatus("Offline: not available here");
		return;
	}
	setOfflineStatus("Offline: getting ready…");
	navigator.serviceWorker.register("sw.js").then(function () {
		return navigator.serviceWorker.ready;
	}).then(function () {
		setOfflineStatus("Offline: ready ✓");
	}).catch(function () {
		setOfflineStatus("Offline: not available");
	});
});
