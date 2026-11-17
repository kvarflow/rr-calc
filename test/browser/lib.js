// Shared by the browser checks: the calc's version (so What's new stays closed), where it is served, where screenshots go.
const fs = require('fs');
const os = require('os');
const path = require('path');

const settings = fs.readFileSync(path.join(__dirname, '../../src/js/site_settings.js'), 'utf8');
const versions = settings.match(/\{version: "([\d.]+)"/g) || [];

module.exports = {
	VERSION: versions.length ? versions[versions.length - 1].match(/"([\d.]+)"/)[1] : '',
	BASE: process.env.CALC_URL || 'http://localhost:8080',
	SHOTS: process.env.SHOTS || os.tmpdir()
};
