/*
* Dark mode toggle
*
* In its current state, it will cause a minor FOIT.
* Basically, the background behind the panels will
* briefly flash white before turning dark. It's
* better than before, but not perfect.
*/

/*
* localStorage will only store strings
* This means that if it has the value 'false',
* It will be truey and incorrectly cause the
* dark theme to load.
*/
var storedDarkTheme = null;
try {
	storedDarkTheme = localStorage.getItem('darkTheme');
} catch (e) {
	// Storage unavailable (e.g. private browsing): follow the system's theme.
}
var prefersDarkTheme = storedDarkTheme ? storedDarkTheme === 'true' : window.matchMedia('(prefers-color-scheme: dark)').matches;
var darkThemeButton = document.getElementById('dark-theme-toggle');
darkThemeButton.innerText = prefersDarkTheme ? 'Click for Light Theme' : 'Click for Dark Theme';
if (prefersDarkTheme) {
	var darkStyles = document.getElementById('dark-theme-styles');
	if (darkStyles.disabled) {
		darkStyles.disabled = !darkStyles.disabled;
	}
}

/*
* Function that toggles light and dark mode
* Doesn't use jQuery, probably could with some modification
*/
function toggleTheme() {
	prefersDarkTheme = !prefersDarkTheme;

	var darkStyles = document.getElementById('dark-theme-styles');
	darkStyles.disabled = !darkStyles.disabled;

	try {
		localStorage.setItem('darkTheme', prefersDarkTheme);
	} catch (e) {
		// Storage unavailable: the theme lasts until the page reloads.
	}
	darkThemeButton.innerText = prefersDarkTheme ? 'Click for Light Theme' : 'Click for Dark Theme';
}

darkThemeButton.addEventListener('click', toggleTheme);
