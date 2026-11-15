// Browser check (see README, Development): node test/browser/run.js
const {VERSION,BASE,SHOTS}=require('./lib');
const {chromium}=require('playwright');
let fails=0;const ok=(c,m)=>{console.log((c?'ok   ':'FAIL ')+m);if(!c)fails++};
(async()=>{const b=await chromium.launch();
for(const vp of [{width:1400,height:900},{width:640,height:480}]){
const ctx=await b.newContext({viewport:vp,serviceWorkers:'block'});const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.addInitScript(VERSION=>{localStorage.setItem('lastChangelogVersion',VERSION)},VERSION);
await p.goto(BASE+'/normal.html');await p.waitForTimeout(2500);
const tag=vp.width+': ';
const shares=()=>p.evaluate(()=>{const bt=readAIBattle();if(!bt)return null;const pr=predictAIMoves(bt);return {moves:bt.ai.moves.map(m=>m&&m.name),shares:pr.shares.map(x=>Math.round(x*100)),sw:Math.round(pr.switchShare*100),forced:pr.forced||''}});
const go=async(name,slot)=>{await p.evaluate(([n,s])=>{showTrainer(TRAINER_ORDER.findIndex(t=>t.name===n&&!t.route));if(s){$('#trainer-team .pokemon-sprite, #trainer-team [data-slot]').eq(s).click()}},[name,slot||0]);await p.waitForTimeout(1000)};
await go('Erika');
const base=await shares();
ok(base&&base.moves.length===4,tag+'baseline '+JSON.stringify(base));
ok(await p.evaluate(()=>$('.bh-button:visible').length===1&&$('.bh-button').text()==='Turn'),tag+'Turn button shown');
// dialog
await p.click('.bh-button');await p.waitForTimeout(300);
const dlg=await p.evaluate(()=>({sides:$('.bh-side').length,moves:$('.bh-side').first().find('.bh-move').length,flags:$('.bh-side').first().find('.bh-flag').length,fits:$('.bh-dialog')[0].getBoundingClientRect().right<=window.innerWidth&&$('.bh-dialog')[0].getBoundingClientRect().bottom<=window.innerHeight}));
ok(dlg.sides===2&&dlg.moves===5&&dlg.flags===17&&dlg.fits,tag+'dialog '+JSON.stringify(dlg));
await p.screenshot({path:SHOTS+'/hist_'+vp.width+'.png'});
// tap the foe's 2nd move
await p.evaluate(()=>$('.bh-side').first().find('.bh-move').eq(1).click());await p.waitForTimeout(500);
ok(await p.evaluate(()=>{const v=getBattleVolatile('p2');return v&&v.lastMove===getBattleHistoryMoves('p2')[1]&&v.firstTurn===false&&$('.bh-side').first().find('.bh-move').eq(1).attr('aria-pressed')==='true'}),tag+'tapping a move logs it');
// taunt
await p.evaluate(()=>{$('.bh-side').first().find('.bh-flag:contains("Taunted") input').click()});await p.waitForTimeout(500);
ok(await p.evaluate(()=>getBattleVolatile('p2').taunt===true&&/Turn · \d/.test($('.bh-button').text())),tag+'ticking Taunted sets it; button counts: '+await p.evaluate(()=>$('.bh-button').text()));
await p.evaluate(()=>$('.bh-dialog .box-dialog-buttons button:contains("New battle")').click());await p.waitForTimeout(400);
ok(await p.evaluate(()=>getBattleVolatile('p2')===null&&getBattleVolatile('p1')===null),tag+'New battle clears');
await p.evaluate(()=>$('.bh-dialog .box-dialog-buttons button:contains("Done")').click());
ok(JSON.stringify(await shares())===JSON.stringify(base),tag+'cleared = baseline again');
// Choice lock: give the foe a Choice Band, it used move 4
await p.evaluate(()=>{$('#p2 select.item').val('Choice Band').trigger('change')});await p.waitForTimeout(500);
const before=await shares();
await p.evaluate(()=>{logBattleMove('p2',getBattleHistoryMoves('p2')[3]);refreshBattleHistory()});await p.waitForTimeout(400);
const locked=await shares();
ok(locked.shares[0]===0&&locked.shares[1]===0&&locked.shares[2]===0&&locked.shares[3]+locked.sw===100,tag+'Choice lock: only the move used last (or a switch) '+JSON.stringify(locked)+' was '+JSON.stringify(before.shares));
await p.evaluate(()=>{$('#p2 select.item').val('').trigger('change');clearBattleHistory();refreshBattleHistory()});await p.waitForTimeout(400);
// recharge
await p.evaluate(()=>{ensureBattleVolatile('p2').recharge=true;refreshBattleHistory()});await p.waitForTimeout(300);
let r=await shares();ok(r.forced==='recharge'&&r.shares.every(x=>x===0)&&r.sw===0,tag+'recharging: no move, no switch');
await p.evaluate(()=>{clearBattleHistory();logBattleMove('p2',getBattleHistoryMoves('p2')[2]);ensureBattleVolatile('p2').locked=true;refreshBattleHistory()});await p.waitForTimeout(300);
r=await shares();ok(r.forced==='locked'&&r.shares[2]===100,tag+'locked into its last move');
// disabled move
await p.evaluate(()=>{clearBattleHistory();ensureBattleVolatile('p2').disabled=getBattleHistoryMoves('p2')[0];refreshBattleHistory()});await p.waitForTimeout(300);
r=await shares();ok(r.shares[0]===0,tag+'disabled move never picked '+JSON.stringify(r.shares));
// history resets when the foe's Pokemon changes
await p.evaluate(()=>{const t=TRAINER_ORDER.findIndex(t=>t.name==='Koga'&&!t.route);showTrainer(t)});await p.waitForTimeout(1000);
ok(await p.evaluate(()=>getBattleVolatile('p2')===null),tag+'history starts again for another Pokémon');
// taunt removes status moves: find a Koga mon with a status move
const t=await p.evaluate(()=>{const bt=readAIBattle();const i=bt.ai.moves.findIndex(m=>m&&m.split===2);return {i,name:i>=0?bt.ai.moves[i].name:null,all:bt.ai.moves.map(m=>m&&m.name+':'+m.split)}});
if(t.i>=0){await p.evaluate(()=>{ensureBattleVolatile('p2').taunt=true;refreshBattleHistory()});await p.waitForTimeout(300);r=await shares();ok(r.shares[t.i]===0,tag+'taunted: '+t.name+' not used '+JSON.stringify(r.shares))} else console.log('     (no status move on the lead: '+t.all+')');
await p.evaluate(()=>{clearBattleHistory();refreshBattleHistory()});
// substitute on you: foe status moves at you penalised
await p.evaluate(()=>{ensureBattleVolatile('p1').sub=true;refreshBattleHistory()});await p.waitForTimeout(300);
r=await shares();ok(!!r,tag+'your Substitute: '+JSON.stringify(r));
// player locked prediction and AI report still work
await p.evaluate(()=>{clearBattleHistory();logBattleMove('p1',getBattleHistoryMoves('p1')[0]);ensureBattleVolatile('p1').locked=true;refreshBattleHistory()});await p.waitForTimeout(300);
r=await shares();ok(!!r&&(await p.evaluate(()=>buildAIReport().length>100)),tag+'you locked in: '+JSON.stringify(r.shares));
ok(errs.length===0,tag+'no page errors '+errs.join(' | '));
await ctx.close()}
await b.close();console.log(fails?fails+' FAILED':'all passed')})();
