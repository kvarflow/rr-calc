// Browser check (see README, Development): node test/browser/run.js recommended
// Recommended encounters on the Wild tab: the location's pick starred, Plan, and Viridian Forest's
// Expansion as a Nuzlocke location of its own (from a .sav too).
const {VERSION, BASE, SHOTS} = require('./lib');
const {chromium} = require('playwright');
(async () => {
	const b = await chromium.launch();
	const ctx = await b.newContext({viewport: {width: 640, height: 1000}, hasTouch: true});
	const p = await ctx.newPage();
	const errs = [];
	p.on('pageerror', e => errs.push(e.message));
	await p.addInitScript(VERSION => { localStorage.setItem('lastChangelogVersion', VERSION); }, VERSION);
	await p.goto(BASE + '/normal.html');
	await p.waitForTimeout(2500);
	const fails = [];
	const ok = (cond, msg) => { if (!cond) fails.push(msg); };
	const open = (name, area) => p.evaluate(({name, area}) => {
		const t = [...document.querySelectorAll('button,[role=tab]')].find(e => e.textContent.trim() === 'Wild');
		t && t.click();
		showEncounterLocation(ENCOUNTERS.findIndex(a => a.name === name && (!area || a.area === area)));
	}, {name, area});

	// Route 1 at night: Meowth-Galar starred.
	await open('Route 1');
	await p.evaluate(() => { if ($('#encounter-night').attr('aria-pressed') !== 'true') $('#encounter-night').click(); });
	const r1 = await p.evaluate(() => ({rec: $('.encounter-recommendation').text(), starred: $('.encounter-recommended .encounter-name').map(function () { return $(this).text(); }).get()}));
	ok(/Meowth-Galar/.test(r1.rec) && r1.starred.length === 1 && /Meowth-Galar/.test(r1.starred[0]), 'Route 1: Meowth-Galar ' + JSON.stringify(r1));
	if (SHOTS) await p.screenshot({path: SHOTS + '/recommended_route1.png'});
	// The Expansion: the Starter Egg; Route 10: the Static Pokémon.
	await open('Viridian Forest', 'Expansion');
	const exp = await p.$eval('.encounter-recommendation', e => e.textContent + '|' + e.getAttribute('data-egg'));
	ok(/Water Starter Egg: wait until Cerulean City/.test(exp) && !/Mudkip/.test(exp) && /\|Water$/.test(exp), 'Expansion: a Water Starter Egg, no starter named ' + exp);
	await open('Route 3');
	ok(/^Recommended: Fire Starter Egg/.test(await p.$eval('.encounter-recommendation', e => e.textContent)), 'Route 3: a Fire Starter Egg');
	await open('Route 10');
	const statics = await p.evaluate(() => $('.encounter-recommended').length);
	ok(statics > 0, 'Route 10: Static Pokémon starred ' + statics);
	ok(/Cubone or Rhyhorn/.test(await p.$eval('.encounter-recommendation', e => e.textContent)), 'Route 10: Cubone / Rhyhorn if the Static one is missed');
	await open('Rock Tunnel', 'B1F');
	const rt = await p.evaluate(() => $('.encounter-recommended .encounter-name').map(function () { return $(this).text().trim(); }).get());
	ok(rt.some(n => /Cubone/.test(n)) && rt.some(n => /Rhyhorn/.test(n)), 'Rock Tunnel B1F: Cubone and Rhyhorn starred ' + JSON.stringify(rt));

	// Nuzlocke: Main and Expansion are two locations; a .sav's Viridian Forest Pokémon split by area.
	const nz = await p.evaluate(() => {
		writeSetting(NUZLOCKE_KEY + ':' + getPageMode(), 'true');
		writeNuzlockeEncounters({});
		const forest = MAP_SECTIONS.first + MAP_SECTIONS.names.indexOf('Viridian Forest');
		recordSaveEncounters({party: [{species: 'Mudkip', metLocation: forest}], boxes: [{species: 'Caterpie', metLocation: forest}]});
		const e = readNuzlockeEncounters();
		return {main: e['Viridian Forest'], exp: e['Viridian Forest Expansion'], locations: Object.keys(getNuzlockeLocations()).length};
	});
	ok(nz.main && nz.main.species.join() === 'Caterpie' && nz.exp && nz.exp.species.join() === 'Mudkip', 'forest split from the .sav ' + JSON.stringify(nz));

	// Plan: every location in order, the Expansion's Mudkip shown, tapping one opens it.
	await p.click('#encounter-plan');
	await p.waitForTimeout(300);
	const plan = await p.evaluate(() => ({rows: $('.encounter-plan-row').length, exp: $('.encounter-plan-row').filter(function () { return /Expansion/.test($(this).text()); }).find('.encounter-plan-got').text()}));
	ok(plan.rows === 52 && plan.exp === 'Mudkip', 'Plan ' + JSON.stringify(plan));
	if (SHOTS) await p.screenshot({path: SHOTS + '/recommended_plan.png'});
	await p.click('.encounter-plan-row:has-text("Route 25")');
	await p.waitForTimeout(300);
	ok(await p.evaluate(() => encounterLabel(ENCOUNTERS[~~$('#encounter-location').val()]) === 'Route 25' && !$('.encounter-plan').length), 'a Plan row opens its location');

	await b.close();
	if (errs.length) fails.push('page errors: ' + errs.join(' | '));
	if (fails.length) { fails.forEach(f => console.log('FAIL ' + f)); console.log(fails.length + ' FAILED'); }
	else console.log('all passed');
})();
