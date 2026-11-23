/*
 * The modern desktop look (desktop.css): the page's <head> gives <html> the modern-desk class
 * unless Settings > Desktop style is Classic (and never with the small-screen layout). Here: the
 * Calculator / sheet tabs move into the header, and the setting to switch looks.
 */
var DESKTOP_STYLE_KEY = "desktopStyle"; // "modern" (the default) or "classic"

$(document).ready(function () {
	if ($("html").hasClass("small-screen")) return;
	if ($("html").hasClass("modern-desk")) {
		var header = $("#ss-page-settings");
		header.find(".title-text").after($(".wrapper > .page-tabs"), '<span class="header-spacer"></span>');
	}
	var style = $('<label class="desktop-style-setting">Desktop style <select id="desktop-style">' +
		'<option value="modern">Modern</option><option value="classic">Classic</option></select></label>');
	style.find("select").val(readSetting(DESKTOP_STYLE_KEY) === "classic" ? "classic" : "modern").change(function () {
		writeSetting(DESKTOP_STYLE_KEY, $(this).val());
		// The class is set while the page loads (see the page's <head>).
		window.location.reload();
	});
	$(".site-settings").append(" ", style);
});
