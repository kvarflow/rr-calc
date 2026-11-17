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

/*
 * Calculator updates: the app downloads a newer calculator by itself (once a day) and says so here.
 * A small bar offers to reload into it now; otherwise it's used the next time the app starts. What
 * the calculator has saved stays as it is.
 */
function showPcalcCalcUpdate(message) {
	if (document.getElementById("pcalc-calc-update")) return;
	var bar = document.createElement("div");
	bar.id = "pcalc-calc-update";
	bar.className = "pcalc-calc-update";
	bar.setAttribute("role", "status");
	var date = new Date(message.date);
	var text = document.createElement("span");
	text.textContent = "Calculator updated";
	if (!isNaN(date)) text.title = "Its newest version, from " + date.toLocaleDateString();
	var reload = document.createElement("button");
	reload.type = "button";
	reload.className = "bs-btn bs-btn-default";
	reload.textContent = "Reload now";
	reload.onclick = function () {
		reload.disabled = true;
		pcalcBridge.send({type: "calc:apply"});
	};
	var later = document.createElement("button");
	later.type = "button";
	later.className = "bs-btn bs-btn-default";
	later.textContent = "Later";
	later.title = "It's used the next time the app starts";
	later.onclick = function () {
		bar.parentNode.removeChild(bar);
	};
	bar.appendChild(text);
	bar.appendChild(reload);
	bar.appendChild(later);
	document.body.appendChild(bar);
}

if (pcalcBridge.available()) {
	pcalcBridge.on("calc:updated", function (message) {
		if (document.body) showPcalcCalcUpdate(message);
		else document.addEventListener("DOMContentLoaded", function () {
			showPcalcCalcUpdate(message);
		});
	});
	pcalcBridge.send({type: "calc:hello"});
}
