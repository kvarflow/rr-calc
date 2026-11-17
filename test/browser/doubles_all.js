// Browser check (see README, Development): node test/browser/run.js
const {VERSION,BASE,SHOTS}=require('./lib');
// Scenario checks for the doubles rules: second chooser reacts to the first, Earthquake and Protect, speed control.
const {chromium}=require('playwright');
let fails=0;const ok=(c,m)=>{console.log((c?'ok   ':'FAIL ')+m);if(!c)fails++};
(async()=>{const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:1300,height:900},serviceWorkers:'block'});const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message+' '+(e.stack||'').split('\n')[1]));
await p.addInitScript(VERSION=>{localStorage.setItem('lastChangelogVersion',VERSION)},VERSION);
await p.goto(BASE+'/normal.html');await p.waitForTimeout(2000);
await p.evaluate(()=>{const mk=(lv,ab,it,nat,moves)=>({level:lv,ability:ab,item:it,nature:nat,evs:{hp:0,at:252,df:0,sa:252,sd:4,sp:252},ivs:{},moves});
 localStorage.setItem(getCustomSetsKey(),JSON.stringify({Garchomp:{Mine:mk(60,'Rough Skin','Life Orb','Jolly',['Earthquake','Rock Slide','Dragon Claw','Protect'])},Gengar:{Mine:mk(60,'Cursed Body','Focus Sash','Timid',['Shadow Ball','Sludge Bomb','Thunderbolt','Protect'])}}));writeBoxLayout({team:['Garchomp (Mine)','Gengar (Mine)']})});
await p.reload();await p.waitForTimeout(2500);
await p.evaluate(()=>{$('#p1 input.set-selector').val('Garchomp (Mine)').change()});await p.waitForTimeout(600);
// every doubles fight in both modes runs without error and sums to 100
for(const mode of ['normal','hardcore']){
 if(mode==='hardcore'){await p.goto(BASE+'/hardcore.html');await p.waitForTimeout(2500)}
 const res=await p.evaluate(async()=>{const out=[];const idx=TRAINER_ORDER.map((t,i)=>i).filter(i=>TRAINER_ORDER[i].variants.some(v=>/doubles/i.test(v.battleEffect||'')));
  for(const i of idx){showTrainer(i);await new Promise(r=>setTimeout(r,350));if(!isDoublesFight()){continue}let pr;try{doublesPrediction=null;pr=getDoublesPrediction()}catch(e){out.push({i,name:TRAINER_ORDER[i].name,err:e.message+' | '+e.stack.split('\n')[1]});continue}
   if(!pr.battle){out.push({i,name:TRAINER_ORDER[i].name,none:true});continue}
   const sums=pr.foes.map((f,x)=>pr.battle.foes[x]?Math.round((f.shares.reduce((a,s)=>a+s[0]+s[1],0)+f.onPartner.reduce((a,v)=>a+v,0)+f.none+(f.switchShare||0))*100):100);
   const top=pr.foes.map((f,x)=>{if(!pr.battle.foes[x])return '';let b=0,bi=0;f.shares.forEach((s,k)=>{if(s[0]+s[1]>b){b=s[0]+s[1];bi=k}});return pr.battle.foes[x].name+':'+(pr.battle.foes[x].moves[bi]||{}).name+' '+Math.round(b*100)});
   out.push({i,name:TRAINER_ORDER[i].name,sums,top})}
  return out});
 const bad=res.filter(r=>r.err||(r.sums&&r.sums.some(s=>s!==100)));
 ok(res.length>=25&&!bad.length,mode+': '+res.length+' double battles predicted'+(bad.length?' BAD '+JSON.stringify(bad.slice(0,3)):''));
 console.log('     '+res.filter(r=>r.top).slice(0,40).map(r=>r.name+' ['+r.top.join(', ')+']').join('\n     '));
}
ok(errs.length===0,'no page errors '+errs.slice(0,3).join(' | '));
await b.close();console.log(fails?fails+' FAILED':'all passed')})();
