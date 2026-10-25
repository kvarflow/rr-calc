/*
 * Protean: the Pokémon becomes the type of the move it uses (as in Radical Red, every move). The
 * calculator already gives it STAB on every move; picking one of its moves in the results also
 * changes its type to that move's, so the other side's moves hit it as that type. Only for Protean.
 * Its own types come back when you reset, load another Pokémon or give it another ability.
 */

function getProteanPanel(resultMove) {
	return $(/^resultMoveL/.test(resultMove.id) ? "#p1" : "#p2");
}

function showProteanNote(panel) {
	var original = panel.data("proteanTypes");
	panel.find(".protean-note").toggle(!!original)
		.find(".protean-note-text").text(original ? "Protean: now " + panel.find(".type1").val() + " type" : "");
}

function resetProtean(panel, recalculate) {
	var original = panel.data("proteanTypes");
	if (!original) return;
	panel.removeData("proteanTypes");
	panel.find(".type1").val(original[0]);
	panel.find(".type2").val(original[1]);
	showProteanNote(panel);
	if (recalculate) panel.find(".type1").change();
}

$(document).ready(function () {
	$(".poke-info").each(function () {
		var panel = $(this);
		$('<div class="protean-note"><span class="protean-note-text"></span> <button type="button" class="protean-reset">Reset type</button></div>')
			.hide()
			.insertAfter(panel.find(".ability").first().parent())
			.find("button").click(function () {
				resetProtean(panel, true);
			});
		// A new Pokémon brings its own types; another ability ends the change.
		panel.find("input.set-selector").change(function () {
			panel.removeData("proteanTypes");
			showProteanNote(panel);
		});
		panel.find(".ability").change(function () {
			if ($(this).val() !== "Protean") resetProtean(panel, true);
		});
	});
	// Only a click (the calculator also picks the likeliest move itself after every calculation).
	$(".result-move").on("click", function () {
		var panel = getProteanPanel(this);
		if (panel.find(".ability").val() !== "Protean") return;
		var slot = this.id.slice(-1);
		var type = panel.find(".move" + slot + " .move-type").val();
		if (!type || type === panel.find(".type1").val() && !panel.find(".type2").val()) return;
		if (!panel.data("proteanTypes")) panel.data("proteanTypes", [panel.find(".type1").val(), panel.find(".type2").val()]);
		panel.find(".type1").val(type);
		panel.find(".type2").val("");
		showProteanNote(panel);
		panel.find(".type1").change();
	});
});
