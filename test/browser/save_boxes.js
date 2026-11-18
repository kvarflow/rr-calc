// Browser check (see README, Development): node test/browser/run.js save_boxes
// A .sav's boxes 23-25 (inside the save blocks, CFRU's sPokemonBoxPtrs) are read, with their box numbers.
const {VERSION, BASE} = require('./lib');
const {chromium} = require('playwright');
(async () => {
	const b = await chromium.launch();
	const p = await b.newPage();
	const errs = [];
	p.on('pageerror', e => errs.push(e.message));
	await p.addInitScript(VERSION => { localStorage.setItem('lastChangelogVersion', VERSION); }, VERSION);
	await p.goto(BASE + '/normal.html');
	await p.waitForTimeout(2500);
	const r = await p.evaluate(() => {
		// 14 sections in sectors 0-13, each signed; a compact (58-byte) Pokémon is its species at 0x1C.
		const bytes = new Uint8Array(SAVE_FILE_SIZE);
		const view = new DataView(bytes.buffer);
		for (let id = 0; id < 14; id++) {
			view.setUint16(id * 0x1000 + 0xFF4, id, true);
			view.setUint32(id * 0x1000 + 0xFF8, 0x08012025, true);
			view.setUint32(id * 0x1000 + 0xFFC, 1, true);
		}
		const species = name => RADICAL_RED_SAVE_DATA.species.indexOf(name);
		const put = (fileOffset, name) => view.setUint16(fileOffset + 0x1C, species(name), true);
		// Box 23 slot 1: SaveBlock1 + 0x1F08 (section 2, 0xF18); box 24 slot 1: 30 Pokémon on, past the
		// section's end into section 3; box 25 slot 2: SaveBlock2 (section 0) + 0xB0 + 58.
		put(2 * 0x1000 + 0xF18, 'Pikachu');
		const box24 = 0x1F08 + 30 * 58;
		put((1 + Math.floor(box24 / 0xFF0)) * 0x1000 + box24 % 0xFF0, 'Eevee');
		put(0xB0 + 58, 'Snorlax');
		const save = parseRadicalRedSave(bytes);
		return save && save.boxes.map(m => m.species + '@' + m.box);
	});
	const want = ['Pikachu@23', 'Eevee@24', 'Snorlax@25'];
	const fails = [];
	if (!r || want.some(w => r.indexOf(w) === -1)) fails.push('boxes 23-25 read ' + JSON.stringify(r));
	if (errs.length) fails.push('page errors: ' + errs.join(' | '));
	await b.close();
	if (fails.length) { fails.forEach(f => console.log('FAIL ' + f)); console.log(fails.length + ' FAILED'); }
	else console.log('all passed');
})();
