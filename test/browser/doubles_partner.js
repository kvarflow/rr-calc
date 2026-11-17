// Browser check (see README, Development): node test/browser/run.js
const {VERSION,BASE,SHOTS}=require('./lib');
const {chromium}=require('playwright');
let fails=0;const ok=(c,m)=>{console.log((c?'ok   ':'FAIL ')+m);if(!c)fails++};
(async()=>{const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:1300,height:900},serviceWorkers:'block'});const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message+' '+(e.stack||'').split('\n')[1]));
await p.addInitScript(VERSION=>{localStorage.setItem('lastChangelogVersion',VERSION)},VERSION);
await p.goto(BASE+'/normal.html');await p.waitForTimeout(2000);
await p.evaluate(()=>{const mk=(lv,ab,it,nat,moves)=>({level:lv,ability:ab,item:it,nature:nat,evs:{hp:252,at:0,df:252,sa:0,sd:4,sp:0},ivs:{},moves});
 localStorage.setItem(getCustomSetsKey(),JSON.stringify({Garchomp:{Mine:mk(60,'Rough Skin','Leftovers','Impish',['Earthquake','Rock Slide','Dragon Claw','Protect'])},Blissey:{Mine:mk(60,'Natural Cure','Leftovers','Bold',['Seismic Toss','Soft-Boiled','Toxic','Protect'])}}));writeBoxLayout({team:['Garchomp (Mine)','Blissey (Mine)']})});
await p.reload();await p.waitForTimeout(2500);
await p.evaluate(()=>{$('#p1 input.set-selector').val('Garchomp (Mine)').change()});await p.waitForTimeout(500);
const run=(moves,hp,opts)=>p.evaluate(async([moves,hp,opts])=>{const t=TRAINER_ORDER.findIndex(t=>t.name==='Sabrina'&&!t.route);const sets=TRAINER_ORDER[t].variants[0].sets;
 const id=sets[1];const at=id.lastIndexOf(' (');const set=SETDEX_SV[id.slice(0,at)][id.slice(at+2,-1)];set.__moves=set.__moves||set.moves.slice();set.moves=moves||set.__moves;if(opts&&opts.ability){set.__ab=set.__ab||set.ability;set.ability=opts.ability}else if(set.__ab)set.ability=set.__ab;
 showTrainer(t);await new Promise(r=>setTimeout(r,700));
 $('#trickroom').prop('checked',!!(opts&&opts.tr)).change();
 $('#p2 .percent-hp').val(hp||100).trigger('input');$('#p2 .current-hp').change();await new Promise(r=>setTimeout(r,500));
 doublesPrediction=null;const pr=getDoublesPrediction();const d=pr.battle;
 return {first:d.foes[0].name+' hp '+d.foes[0].hp+'/'+d.foes[0].maxHP+' '+d.foes[0].moves.map((m,i)=>m.name+' '+pr.foes[0].shares[i].map(v=>Math.round(v*100)).join('/')).join(', '),
  second:d.foes[1].moves.map((m,i)=>({name:m.name,foe:Math.round((pr.foes[1].shares[i][0]+pr.foes[1].shares[i][1])*100),partner:Math.round(pr.foes[1].onPartner[i]*100)})),sw:Math.round(pr.foes[1].switchShare*100)}},[moves,hp,opts]);
const show=r=>r.first+' || '+r.second.map(m=>m.name+' '+m.foe+(m.partner?' (partner '+m.partner+')':'')).join(', ')+(r.sw?' switch '+r.sw:'');
let r=await run(null,100,{});
ok(r.second.every(m=>m.partner===0),'no helping move: nothing aimed at its partner | '+show(r));
// Helping Hand while the partner attacks (Trick Room already up, so Hatterene attacks)
r=await run(['Helping Hand','Psychic','Heal Pulse','Growl'],100,{tr:true});
const hh=r.second.find(m=>m.name==='Helping Hand');
ok(hh.partner>0,'Helping Hand for an attacking partner: '+show(r));
// partner sets Trick Room (a status move): no Helping Hand
r=await run(['Helping Hand','Psychic','Heal Pulse','Growl'],100,{});
ok(r.second.find(m=>m.name==='Helping Hand').partner===0||/Trick Room 0\/0/.test(r.first),'no Helping Hand while its partner uses a status move: '+show(r));
// Heal Pulse only when the partner is hurt
r=await run(['Helping Hand','Psychic','Heal Pulse','Growl'],100,{tr:true});
ok(r.second.find(m=>m.name==='Heal Pulse').partner===0,'Heal Pulse not at full HP: '+show(r));
r=await run(['Helping Hand','Psychic','Heal Pulse','Growl'],40,{tr:true});
ok(r.second.find(m=>m.name==='Heal Pulse').partner>0,'Heal Pulse on a hurt partner: '+show(r));
// dialog shows the partner column
await p.evaluate(()=>$('.dbl-button').click());await p.waitForTimeout(400);
ok(await p.evaluate(()=>/→ its /.test($('.dbl-table').eq(1).find('th').last().text())),'dialog: a column for its partner: '+await p.evaluate(()=>$('.dbl-table').eq(1).find('th').map((i,e)=>$(e).text()).get().join(' | ')));
await p.screenshot({path:SHOTS+'/dpartner.png'});
ok(errs.length===0,'no page errors '+errs.slice(0,3).join(' | '));
await b.close();console.log(fails?fails+' FAILED':'all passed')})();
