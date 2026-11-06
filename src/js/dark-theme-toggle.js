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
// Black: the dark theme with true black behind everything (for OLED screens like the AYN Thor's).
var storedBlackTheme = null;
try {
	storedBlackTheme = localStorage.getItem('blackTheme');
} catch (e) {
	// Storage unavailable: plain dark.
}
if (prefersDarkTheme && storedBlackTheme === 'true') document.documentElement.className += ' black-theme';
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
	if (!prefersDarkTheme) setBlackClass(false);
}

function setBlackClass(on) {
	var root = document.documentElement;
	root.className = root.className.replace(/(^|\s)black-theme(?=\s|$)/g, '') + (on ? ' black-theme' : '');
}

// "light", "dark" or "black" (the small layout's Theme setting).
function setCalcTheme(theme) {
	if ((theme !== 'light') !== prefersDarkTheme) toggleTheme();
	setBlackClass(theme === 'black');
	try {
		localStorage.setItem('blackTheme', theme === 'black');
	} catch (e) {
		// Storage unavailable: the theme lasts until the page reloads.
	}
}

function getCalcTheme() {
	if (!prefersDarkTheme) return 'light';
	return /(^|\s)black-theme(\s|$)/.test(document.documentElement.className) ? 'black' : 'dark';
}

darkThemeButton.addEventListener('click', toggleTheme);
