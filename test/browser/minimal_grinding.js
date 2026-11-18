// Browser check (see README, Development): node test/browser/run.js
const {VERSION,BASE,SHOTS}=require('./lib');
const {chromium}=require('playwright');
let fails=0;const ok=(c,m)=>{console.log((c?'ok   ':'FAIL ')+m);if(!c)fails++};
(async()=>{const b=await chromium.launch();const ctx=await b.newContext({serviceWorkers:'block'});const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.addInitScript(VERSION=>{localStorage.setItem('lastChangelogVersion',VERSION)},VERSION);
await p.goto(BASE+'/normal.html');await p.waitForTimeout(2500);
const evs=()=>p.evaluate(()=>{showTrainer(TRAINER_ORDER.findIndex(t=>t.name==='Sabrina'&&!t.route));return new Promise(r=>setTimeout(()=>r({evs:$('#p2 .evs').map((i,e)=>+$(e).val()).get(),withEvs:TRAINER_ORDER.reduce((n,t)=>n+t.variants.reduce((m,v)=>m+v.sets.filter(id=>{const at=id.lastIndexOf(' (');const s=SETDEX_SV[id.slice(0,at)][id.slice(at+2,-1)];return s&&s.evs}).length,0),0)}),900))});
let e=await evs();ok(e.evs.reduce((a,b)=>a+b,0)>400&&e.withEvs>300,'Normal: Sabrina has EVs '+e.evs+' ('+e.withEvs+' trainer sets with EVs)');
ok(await p.evaluate(()=>$('#minimal-grinding').length===1&&!$('#minimal-grinding').prop('checked')),'Minimal Grinding setting, off');
await Promise.all([p.waitForNavigation(),p.evaluate(()=>$('#minimal-grinding').click())]);await p.waitForTimeout(2500);
e=await evs();ok(e.evs.reduce((a,b)=>a+b,0)===0&&e.withEvs===0&&await p.evaluate(()=>$('#minimal-grinding').prop('checked')),'on: no trainer EVs '+e.evs);
await Promise.all([p.waitForNavigation(),p.evaluate(()=>$('#minimal-grinding').click())]);await p.waitForTimeout(2500);
e=await evs();ok(e.withEvs>300,'off again: EVs back');
const fro=await p.evaluate(()=>SETDEX_SV.Frogadier['Leader Misty'].evs);ok(fro&&fro.hp===100&&fro.at===40&&fro.sa===40,'Misty Frogadier EVs as in the game '+JSON.stringify(fro));
await p.goto(BASE+'/hardcore.html');await p.waitForTimeout(2500);
const h=await p.evaluate(()=>({mg:$('#minimal-grinding').length,route:TRAINER_ORDER.filter(t=>t.route).reduce((n,t)=>n+t.variants[0].sets.filter(id=>{const at=id.lastIndexOf(' (');const s=SETDEX_SV[id.slice(0,at)][id.slice(at+2,-1)];return s&&s.evs}).length,0)}));
ok(h.mg===0&&h.route===0,'Hardcore: no setting, no route trainer EVs');
ok(!errs.length,'no page errors '+errs.join('|'));await b.close();console.log(fails?fails+' FAILED':'all passed')})();
