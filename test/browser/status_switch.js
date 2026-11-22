// Browser check (see README, Development): node test/browser/run.js status_switch
// A status picked by hand stays with that Pokémon: switching to another one (here after its item
// changed while paralysed, which used to make autosetStatus remember Paralyzed) loads it healthy.
const {VERSION,BASE}=require('./lib');
const {chromium}=require('playwright');
let fails=0;const ok=(c,m)=>{console.log((c?'ok   ':'FAIL ')+m);if(!c)fails++};
(async()=>{const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:1300,height:900},serviceWorkers:'block'});const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.addInitScript(VERSION=>{localStorage.setItem('lastChangelogVersion',VERSION)},VERSION);
await p.goto(BASE+'/normal.html');await p.waitForTimeout(2000);
await p.evaluate(()=>{const mk=(pid,it,moves)=>({pid,level:60,ability:'Pressure',item:it,nature:'Jolly',evs:{hp:0,at:252,df:0,sa:0,sd:4,sp:252},ivs:{},moves});
 localStorage.setItem(getCustomSetsKey(),JSON.stringify({Garchomp:{Mine:mk(111,'Life Orb',['Earthquake'])},Gengar:{Mine:mk(222,'Focus Sash',['Shadow Ball'])}}));writeBoxLayout({team:['Garchomp (Mine)','Gengar (Mine)'],box:[]})});
await p.reload();await p.waitForTimeout(2500);
const r=await p.evaluate(async()=>{const wait=ms=>new Promise(r=>setTimeout(r,ms));const load=id=>{$('#p1 input.set-selector').val(id).change();return wait(400)};
 const st=()=>({status:$('#p1 .status').val(),speed:$('#p1 .sp .totalMod').text()});const out={};
 await load('Garchomp (Mine)');out.healthy=st();
 $('#p1 .status').val('Paralyzed').change();await wait(200);$('#p1 .item').val('Choice Scarf').change();await wait(200);out.paralysed=st();
 await load('Gengar (Mine)');out.gengar=st();await load('Garchomp (Mine)');out.back=st();
 $('#p1 .item').val('Flame Orb').change();await wait(200);out.orb=st();$('#p1 .item').val('Leftovers').change();await wait(200);out.orbOff=st();
 return out;});
ok(r.paralysed.status==='Paralyzed','paralysed by hand: '+JSON.stringify(r.paralysed));
ok(r.gengar.status==='Healthy','the next Pokémon loads healthy: '+JSON.stringify(r.gengar));
ok(r.back.status==='Healthy'&&r.back.speed===r.healthy.speed,'and so does the first again, at full Speed: '+JSON.stringify(r.back));
ok(r.orb.status==='Burned'&&r.orbOff.status==='Healthy','Flame Orb still burns, and taking it off cures: '+JSON.stringify([r.orb,r.orbOff]));
ok(errs.length===0,'no page errors '+errs.slice(0,3).join(' | '));
await b.close();console.log(fails?fails+' FAILED':'all passed');process.exitCode=fails?1:0})();
