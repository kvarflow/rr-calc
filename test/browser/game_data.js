// Browser check (see README, Development): node test/browser/run.js game_data
// Another game's data (calc.setGameData, as js/data/games/<game>.js does it) on a page: every calc file
// shares the page's global scope, where index.ts's Move once replaced the move data's own class.
const {VERSION, BASE} = require('./lib');
const {chromium} = require('playwright');
(async () => {
	const b = await chromium.launch();
	const p = await b.newPage({viewport: {width: 1400, height: 1000}});
	const errs = [];
	p.on('pageerror', e => errs.push(e.message));
	await p.addInitScript(VERSION => { localStorage.setItem('lastChangelogVersion', VERSION); }, VERSION);
	await p.goto(BASE + '/test-gen3.html');
	await p.waitForTimeout(2500);
	const fails = [];
	const ok = (cond, msg) => { if (!cond) fails.push(msg); };

	const result = await p.evaluate(() => {
		try {
			calc.setGameData(3, {
				species: {Rattata: {types: ['Normal'], bs: {hp: 30, at: 56, df: 35, sa: 25, sd: 35, sp: 72}, weightkg: 3.5, nfe: true,
					abilities: {0: 'Run Away', 1: 'Guts'}}},
				moves: {Endure: {bp: 0, category: 'Status', type: 'Normal', priority: 3}, Tackle: {bp: 50, type: 'Normal', makesContact: true}},
			});
			const gen = calc.Generations.get(3);
			const out = {endure: gen.moves.get('endure').priority, tackle: gen.moves.get('tackle').basePower,
				guts: gen.species.get('rattata').abilities[1]};
			calc.setGameData(3, {});
			out.tackleAfter = calc.Generations.get(3).moves.get('tackle').basePower;
			return out;
		} catch (e) {
			return {error: e.message};
		}
	});
	ok(!result.error, 'setGameData runs on a page: ' + result.error);
	ok(result.endure === 3 && result.tackle === 50 && result.guts === 'Guts', 'the game\'s moves and Pokémon are used ' + JSON.stringify(result));
	ok(result.tackleAfter === 35, 'setGameData(3, {}) puts Gen 3\'s own back ' + JSON.stringify(result));

	await b.close();
	if (errs.length) fails.push('page errors: ' + errs.join(' | '));
	if (fails.length) { fails.forEach(f => console.log('FAIL ' + f)); console.log(fails.length + ' FAILED'); }
	else console.log('all passed');
})();
