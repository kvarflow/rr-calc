// Browser check (see README, Development): node test/browser/run.js hazards
// Toxic Spikes and Sticky Web on each side: the controls, what the trainer AI reads, and emulator sync
// (script 3 sends each side's screens and hazards).
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

	ok(await p.isVisible('label[for=toxicSpikesL2]') && await p.isVisible('label[for=stickyWebR]'), 'controls shown');
	await p.click('label[for=toxicSpikesR1]');
	await p.click('label[for=stickyWebR]');
	const side = await p.evaluate(() => readSideState('R'));
	ok(side.toxicSpikes === 1 && side.stickyWeb === true, 'AI reads the right side ' + JSON.stringify(side));
	ok(await p.evaluate(() => readSideState('L').toxicSpikes === 0 && readSideState('L').stickyWeb === false), 'left side untouched');

	// Sync: yours Reflect, 2 Spikes, 2 Toxic Spikes, Stealth Rock; theirs Light Screen, 1 Toxic Spikes, Sticky Web.
	const synced = await p.evaluate(() => {
		applyEmulatorSides([{status: 1, hazards: 0x2 | 0x8 | 0x10}, {status: 2, hazards: 0x4 | 0x20}]);
		return {L: readSideState('L'), R: readSideState('R')};
	});
	ok(synced.L.reflect && !synced.L.lightScreen && synced.L.spikes === 2 && synced.L.toxicSpikes === 2 && synced.L.sr && !synced.L.stickyWeb,
		'sync, your side ' + JSON.stringify(synced.L));
	ok(!synced.R.reflect && synced.R.lightScreen && synced.R.spikes === 0 && synced.R.toxicSpikes === 1 && !synced.R.sr && synced.R.stickyWeb,
		'sync, their side ' + JSON.stringify(synced.R));
	// The same state again leaves what you changed by hand.
	const kept = await p.evaluate(() => {
		$('#srL').prop('checked', false);
		applyEmulatorSides([{status: 1, hazards: 0x2 | 0x8 | 0x10}, {status: 2, hazards: 0x4 | 0x20}]);
		return $('#srL').prop('checked');
	});
	ok(kept === false, 'an unchanged sync keeps your edit');

	// A trainer fight's predictions with Toxic Spikes up on its side.
	await p.evaluate(() => showTrainer(TRAINER_ORDER.findIndex(t => t.name === 'Misty' && !t.route)));
	await p.waitForTimeout(1200);
	await p.click('label[for=toxicSpikesR2]');
	await p.waitForTimeout(800);
	ok(await p.evaluate(() => $('#resultMoveL1, .ai-move-chance, .move-result-subgroup').length > 0), 'calculations ran');

	await b.close();
	if (errs.length) fails.push('page errors: ' + errs.join(' | '));
	if (fails.length) { fails.forEach(f => console.log('FAIL ' + f)); console.log(fails.length + ' FAILED'); }
	else console.log('all passed');
})();
