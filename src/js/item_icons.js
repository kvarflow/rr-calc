/*
 * An icon before each Pokémon's item (data/item_icons.js, from PokeAPI's sprites). An item with no
 * icon, or one that can't load (offline, before it was ever seen), shows none.
 */

function getItemIconUrl(item) {
	return item && typeof ITEM_ICONS !== "undefined" && ITEM_ICONS[item] ? ITEM_ICON_BASE + ITEM_ICONS[item] : null;
}

function updateItemIcon(panel) {
	var icon = panel.find(".item-icon");
	var url = getItemIconUrl(panel.find("select.item").val());
	if (!url) {
		icon.hide();
		return;
	}
	if (icon.attr("src") !== url) icon.attr("src", url);
	icon.show();
}

$(document).ready(function () {
	if (typeof ITEM_ICONS === "undefined") return;
	$(".poke-info").each(function () {
		var panel = $(this);
		var select = panel.find("select.item");
		$('<img class="item-icon" alt="" />').hide().on("error", function () {
			$(this).hide();
		}).insertBefore(select);
		select.change(function () {
			updateItemIcon(panel);
		});
	});
	// Loading a set sets the item without a change event.
	$(document).on("calc:done", function () {
		$(".poke-info").each(function () {
			updateItemIcon($(this));
		});
	});
});
