// Browser check (see README, Development): node test/browser/run.js dex_peek
// Dex peek (hold a Pokémon on the Wild tab: stats, evolution line, Open in Dex) and the Dex's list of every Pokémon.
const {VERSION, BASE, SHOTS} = require('./lib');
const {chromium} = require('playwright');
(async () => {
	const b = await chromium.launch();
	const fails = [];
	const ok = (cond, msg) => { if (!cond) fails.push(msg); };
	const errs = [];
	for (const width of [1400, 640]) {
		const ctx = await b.newContext({viewport: {width, height: 1000}, hasTouch: width < 700});
		const p = await ctx.newPage();
		p.on('pageerror', e => errs.push(width + ': ' + e.message));
		await p.addInitScript(VERSION => { localStorage.setItem('lastChangelogVersion', VERSION); }, VERSION);
		await p.goto(BASE + '/normal.html');
		await p.waitForTimeout(2500);
		const tag = width + ': ';
		if (width < 700) {
			// The Wild tab on Route 1, Nuzlocke on: a tap there would pick the encounter, a hold must not.
			await p.evaluate(() => {
				writeSetting(NUZLOCKE_KEY + ':' + getPageMode(), 'true');
				const t = [...document.querySelectorAll('button,[role=tab]')].find(e => e.textContent.trim() === 'Wild');
				t && t.click();
				$('#encounter-location').val(String(ENCOUNTERS.findIndex(a => /Route 1$/.test(encounterLabel(a))))).change();
			});
			await p.waitForTimeout(800);
			const row = p.locator('.encounter-row[data-dex-peek]').first();
			const species = await row.getAttribute('data-dex-peek');
			ok(!!species, tag + 'wild rows can be held');
			const box = await row.boundingBox();
			await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
			await p.mouse.down();
			await p.waitForTimeout(650);
			await p.mouse.up();
			await p.waitForTimeout(800);
			const peek = await p.evaluate(() => ({
				shown: $('.dex-peek:visible').length, name: $('.dex-peek-title b').text(), stats: $('.dex-peek .dex-stat').length,
				evo: $('.dex-peek .dex-evo-mon, .dex-peek .dex-none').length,
				nuzlocke: JSON.stringify(readNuzlockeEncounters())
			}));
			ok(peek.shown === 1 && peek.name === species && peek.stats === 7 && peek.evo > 0, tag + 'hold shows the peek ' + JSON.stringify(peek));
			ok(peek.nuzlocke === '{}', tag + 'the hold did not pick the Nuzlocke encounter ' + peek.nuzlocke);
			if (SHOTS) await p.screenshot({path: SHOTS + '/dex_peek_' + width + '.png'});
			// The release of the hold left it open; the button opens the Dex on it.
			await p.click('.dex-peek-open');
			await p.waitForTimeout(1200);
			const dex = await p.evaluate(() => ({open: document.documentElement.classList.contains('sheet-open'), name: $('.dex-title h2').text(), peek: $('.dex-peek').length}));
			ok(dex.open && dex.name === species && dex.peek === 0, tag + 'Open in Dex ' + JSON.stringify(dex));
		} else {
			await p.evaluate(() => openDex('Gengar'));
			await p.waitForTimeout(1200);
		}

		// The list: every Pokémon, by ability and type, sorted by Speed.
		await p.click('.dex-view-tabs button:nth-child(2)');
		await p.waitForTimeout(800);
		const all = await p.evaluate(() => $('.dex-list-row').length);
		ok(all === 120, tag + 'the list shows its first page ' + all);
		await p.fill('.dex-list-filters .dex-search', 'levitate');
		await p.selectOption('.dex-list-type', 'Ghost');
		await p.click('.dex-list th[data-key=spe]');
		await p.waitForTimeout(400);
		const ghosts = await p.evaluate(() => $('.dex-list-row').map(function () {
			return {name: $(this).attr('data-species'), spe: Number($(this).find('td').eq(7).text())};
		}).get());
		ok(ghosts.length > 2 && ghosts.some(g => g.name === 'Gengar' || g.name === 'Mismagius') &&
			ghosts.every((g, i) => i === 0 || ghosts[i - 1].spe >= g.spe), tag + 'Levitate Ghosts, fastest first ' + JSON.stringify(ghosts.slice(0, 4)));
		if (SHOTS) await p.screenshot({path: SHOTS + '/dex_list_' + width + '.png'});
		await p.click('.dex-list-row >> nth=0');
		await p.waitForTimeout(800);
		ok(await p.evaluate(() => $('.dex-title h2').text()) === ghosts[0].name, tag + 'a row opens its page');
		// Right-click is a peek on a computer.
		if (width > 700) {
			await p.click('.dex-view-tabs button:nth-child(2)');
			await p.waitForTimeout(500);
			await p.click('.dex-list-row >> nth=1', {button: 'right'});
			await p.waitForTimeout(500);
			ok(await p.evaluate(() => $('.dex-peek:visible').length) === 1, tag + 'right-click peeks');
			await p.keyboard.press('Escape');
			ok(await p.evaluate(() => $('.dex-peek').length) === 0, tag + 'Escape closes it');
		}
		await ctx.close();
	}
	await b.close();
	if (errs.length) fails.push('page errors: ' + errs.join(' | '));
	if (fails.length) { fails.forEach(f => console.log('FAIL ' + f)); console.log(fails.length + ' FAILED'); }
	else console.log('all passed');
})();
