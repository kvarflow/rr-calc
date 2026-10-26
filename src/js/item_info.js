/*
 * A ? beside each Pokémon's item shows what the item does (data/item_descriptions.js), like the
 * ? beside its ability (ability_info.js, whose look it shares). It stays open, following the
 * item, until tapped again.
 */

function updateItemInfo(panel) {
	var info = panel.find(".item-info");
	if (!info.is(":visible")) return;
	var item = panel.find("select.item").val() || "";
	info.empty().append($("<b></b>").text(item ? item + ": " : ""),
		document.createTextNode(ITEM_DESCRIPTIONS[item] || (item ? "No description available." : "No item.")));
}

$(document).ready(function () {
	$(".poke-info").each(function () {
		var panel = $(this);
		var select = panel.find("select.item");
		var info = $('<div class="item-info" role="note"></div>').hide();
		$('<button type="button" class="ability-help item-help" aria-expanded="false" title="What does this item do?">?</button>')
			.click(function () {
				var open = !info.is(":visible");
				info.toggle(open);
				$(this).attr("aria-expanded", open);
				updateItemInfo(panel);
			})
			.insertAfter(select);
		info.insertAfter(select.parent());
		select.change(function () {
			updateItemInfo(panel);
		});
	});
	// Loading a set sets the item without a change event.
	$(document).on("calc:done", function () {
		$(".poke-info").each(function () {
			updateItemInfo($(this));
		});
	});
});
