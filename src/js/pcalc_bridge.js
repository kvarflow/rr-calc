/*
 * The Pcalc app's message channel (kvarflow/Pcalc: window.PcalcNative, which only the calculator's
 * own pages can reach), shared by what uses it: backups (backup_panel.js) and the save file the app
 * watches (save_import.js). Requests get one answer through a callback; the app can also send
 * messages of its own (a changed save file), which go to whoever listens for their type.
 */
var pcalcBridge = {
	pending: null,
	listeners: {},
	// In the Pcalc app, with its channel there.
	available: function () {
		return /\bPcalc\//.test(navigator.userAgent) && typeof window.PcalcNative !== "undefined";
	},
	// Sends a message; `callback` gets the app's answer (one request at a time is all these need).
	request: function (message, callback) {
		pcalcBridge.pending = callback || null;
		window.PcalcNative.postMessage(JSON.stringify(message));
	},
	send: function (message) {
		window.PcalcNative.postMessage(JSON.stringify(message));
	},
	// Messages of `type` the app sends by itself.
	on: function (type, handler) {
		pcalcBridge.listeners[type] = handler;
	}
};

if (pcalcBridge.available()) {
	window.PcalcNative.onmessage = function (event) {
		var message;
		try {
			message = JSON.parse(event.data);
		} catch (e) {
			return;
		}
		if (message && pcalcBridge.listeners[message.type]) {
			pcalcBridge.listeners[message.type](message);
			return;
		}
		var callback = pcalcBridge.pending;
		pcalcBridge.pending = null;
		if (callback) callback(message);
	};
}
