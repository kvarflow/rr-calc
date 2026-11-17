// Browser check (see README, Development): node test/browser/run.js
const {VERSION,BASE,SHOTS}=require('./lib');
const {chromium}=require('playwright');
let fails=0;const ok=(c,m)=>{console.log((c?'ok   ':'FAIL ')+m);if(!c)fails++};
(async()=>{const b=await chromium.launch();
const ctx=await b.newContext({viewport:{width:640,height:480},serviceWorkers:'block'});const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message+' '+(e.stack||'').split('\n')[1]));
await p.addInitScript(VERSION=>{localStorage.setItem('lastChangelogVersion',VERSION)},VERSION);
await p.goto(BASE+'/normal.html');await p.waitForTimeout(2000);
await p.evaluate(()=>{const mk=(lv,ab,it,nat,moves)=>({level:lv,ability:ab,item:it,nature:nat,evs:{hp:0,at:252,df:0,sa:252,sd:4,sp:252},ivs:{},moves});
 const sets={Garchomp:{Mine:mk(60,'Rough Skin','Life Orb','Jolly',['Earthquake','Rock Slide','Dragon Claw','Protect'])},Gengar:{Mine:mk(60,'Cursed Body','Focus Sash','Timid',['Shadow Ball','Sludge Bomb','Thunderbolt','Protect'])},Togekiss:{Mine:mk(60,'Serene Grace','Leftovers','Timid',['Air Slash','Dazzling Gleam','Follow Me','Roost'])},Magikarp:{Mine:mk(20,'Swift Swim','','Jolly',['Splash','Tackle','Flail','Bounce'])}};
 localStorage.setItem(getCustomSetsKey(),JSON.stringify(sets));writeBoxLayout({team:['Garchomp (Mine)','Gengar (Mine)','Togekiss (Mine)','Magikarp (Mine)']})});
await p.reload();await p.waitForTimeout(2500);
const setP1=async id=>{await p.evaluate(i=>{$('#p1 input.set-selector').val(i).change()},id);await p.waitForTimeout(700)};
const go=async(name,loc)=>{await p.evaluate(([n,l])=>showTrainer(TRAINER_ORDER.findIndex(t=>t.name===n&&!t.route&&(!l||t.location===l))),[name,loc]);await p.waitForTimeout(1200)};
const pred=()=>p.evaluate(()=>{doublesPrediction=null;let pr;try{pr=getDoublesPrediction()}catch(e){return {err:e.message+' '+e.stack.split('\n').slice(1,3).join(' ')}}if(!pr.battle)return null;const d=pr.battle;return {yours:d.yourSets,foes:d.foes.map((f,x)=>f&&{name:f.name,cls:doublesClass(f),slot:f.slot,shares:pr.foes[x].shares.map(s=>s.map(v=>Math.round(v*100))),moves:f.moves.map(m=>m&&m.name),none:Math.round(pr.foes[x].none*100)})}});
const show=r=>r.err||r.foes.map(f=>f.name+'[c'+f.cls+'] '+f.moves.map((m,i)=>m&&m+' '+f.shares[i].join('/')).filter(Boolean).join(', ')).join(' || ')+' vs '+r.yours.join(' + ');
await setP1('Garchomp (Mine)');
for(const [n,l] of [['Sabrina'],['Giovanni','Cerulean Cave'],['Lorelei'],['Ariana & Archer'],['Guard'],['Tamer Ramiro']]){await go(n,l);const r=await pred();ok(r&&!r.err&&r.yours[1]==='Gengar (Mine)',n+': '+show(r))}
// options exclude the active one
ok(await p.evaluate(()=>getDoublesYourOptions().join()==='Gengar (Mine),Togekiss (Mine),Magikarp (Mine)'),'your options: the rest of your team');
// weak partner: Magikarp beside Garchomp -> foes should mostly KO / target differently; ensure both targets appear across fights
await go('Sabrina');await p.evaluate(()=>{getDoublesPartners().yours='Magikarp (Mine)';recalculateDoubles()});await p.waitForTimeout(800);
let r=await pred();ok(r&&r.yours[1]==='Magikarp (Mine)','chosen partner used: '+show(r));
const onKarp=r.foes.reduce((a,f)=>a+f.shares.reduce((s,x)=>s+x[1],0),0);
ok(onKarp>0,'some attacks go to the second Pokémon ('+onKarp+'% summed)');
// partner HP
await p.evaluate(()=>{getDoublesPartners().yoursHP=10;recalculateDoubles()});await p.waitForTimeout(800);
const hp=await p.evaluate(()=>{const d=getDoublesPrediction().battle;return d.yours[1].hp+'/'+d.yours[1].maxHP});ok(/^\d+\/\d+$/.test(hp)&&+hp.split('/')[0]<+hp.split('/')[1]/5,'partner HP% applied: '+hp);
// dialog with two targets
await p.evaluate(()=>$('.dbl-button').click());await p.waitForTimeout(400);
ok(await p.evaluate(()=>$('.dbl-table').first().find('th').length===3&&$('.dbl-cell').length>=12),'dialog shows both targets');
await p.screenshot({path:SHOTS+'/dbl2.png'});
await p.evaluate(()=>$('.dbl-dialog .box-dialog-buttons button').click());
// a KO'd foe partner is not offered; KO the active one moves on
ok(errs.length===0,'no page errors '+errs.slice(0,3).join(' | '));
await b.close();console.log(fails?fails+' FAILED':'all passed')})();
