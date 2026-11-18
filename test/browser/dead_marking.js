// Browser check (see README, Development): node test/browser/run.js dead_marking
// Settings → Dead marker (PC marking): a .sav Pokémon carrying that marking goes to Fainted on import.
const {VERSION, BASE} = require('./lib');
const {chromium} = require('playwright');
(async () => {
	const b = await chromium.launch();
	const p = await b.newPage({viewport: {width: 1400, height: 1000}});
	const errs = [];
	p.on('pageerror', e => errs.push(e.message));
	await p.addInitScript(VERSION => { localStorage.setItem('lastChangelogVersion', VERSION); }, VERSION);
	await p.goto(BASE + '/normal.html');
	await p.waitForTimeout(2500);
	const fails = [];
	const ok = (cond, msg) => { if (!cond) fails.push(msg); };

	ok(await p.$eval('#dead-marking', s => [...s.options].map(o => o.value).join()) === ',circle,square,triangle,heart', 'the setting lists the four markings');
	const mon = (species, pid, markings, box) => ({species, nickname: species, item: '', level: 20, nature: 'Hardy', ability: '',
		evs: {hp: 0, at: 0, df: 0, sp: 0, sa: 0, sd: 0}, ivs: {hp: 31, at: 31, df: 31, sp: 31, sa: 31, sd: 31},
		moves: ['Tackle'], metLocation: 1, origins: 0, location: species === 'Pidgey' ? 'Party 1' : 'Box ' + (box || 1), box: box || 1, pid, markings, hp: null});
	const run = async (marking, deadBox) => p.evaluate(({marking, deadBox, party, boxes}) => {
		writeSetting(DEAD_MARKING_KEY, marking);
		writeSetting(DEAD_BOX_KEY, deadBox);
		importSaveIntoBox({party, boxes});
		const layout = resolveBoxLayout(readCustomSets(), readBoxLayout());
		const name = id => id.slice(0, id.indexOf(' ('));
		return {fainted: layout.fainted.map(name), box: layout.box.map(name), team: layout.team.map(name)};
	}, {marking, deadBox, party: [Object.assign(mon('Pidgey', 11, 0), {hp: 30})], boxes: [mon('Rattata', 22, 8), mon('Spearow', 33, 1), mon('Caterpie', 44, 0, 25)]});

	ok(await p.$eval('#dead-box', s => s.value) === '25', 'Box 25 is the dead box unless changed');
	const none = await run('', '0');
	ok(none.fainted.length === 0 && none.box.indexOf('Rattata') !== -1, 'no marker: nobody fainted ' + JSON.stringify(none));
	const box25 = await run('', '25');
	ok(box25.fainted.indexOf('Caterpie') !== -1 && box25.fainted.length === 1, 'Box 25: the Caterpie there is in Fainted ' + JSON.stringify(box25));
	const heart = await run('heart', '0');
	ok(heart.fainted.indexOf('Rattata') !== -1 && heart.fainted.indexOf('Spearow') === -1 && heart.team.indexOf('Pidgey') !== -1,
		'heart: the heart-marked Rattata is in Fainted, the circle-marked Spearow is not ' + JSON.stringify(heart));

	await b.close();
	if (errs.length) fails.push('page errors: ' + errs.join(' | '));
	if (fails.length) { fails.forEach(f => console.log('FAIL ' + f)); console.log(fails.length + ' FAILED'); }
	else console.log('all passed');
})();
