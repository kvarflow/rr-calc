// Browser check (see README, Development): node test/browser/run.js
const {VERSION,BASE,SHOTS}=require('./lib');
const {chromium}=require('playwright');
let fails=0;const ok=(c,m)=>{console.log((c?'ok   ':'FAIL ')+m);if(!c)fails++};
(async()=>{const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:1300,height:900},serviceWorkers:'block'});const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message+' '+(e.stack||'').split('\n')[1]));
await p.addInitScript(VERSION=>{localStorage.setItem('lastChangelogVersion',VERSION)},VERSION);
await p.goto(BASE+'/normal.html');await p.waitForTimeout(2000);
await p.evaluate(()=>{const mk=(pid,lv,ab,it,nat,moves)=>({pid,level:lv,ability:ab,item:it,nature:nat,evs:{hp:0,at:252,df:0,sa:252,sd:4,sp:252},ivs:{},moves});
 localStorage.setItem(getCustomSetsKey(),JSON.stringify({Garchomp:{Mine:mk(111,60,'Rough Skin','Life Orb','Jolly',['Earthquake','Rock Slide','Dragon Claw','Protect'])},Gengar:{Mine:mk(222,60,'Cursed Body','Focus Sash','Timid',['Shadow Ball','Sludge Bomb','Thunderbolt','Protect'])},Togekiss:{Mine:mk(333,60,'Serene Grace','Leftovers','Timid',['Air Slash','Dazzling Gleam','Follow Me','Roost'])}}));writeBoxLayout({team:['Garchomp (Mine)'],box:['Gengar (Mine)','Togekiss (Mine)']})});
await p.reload();await p.waitForTimeout(2500);
const run=st=>p.evaluate(st=>{const t=TRAINER_ORDER.findIndex(t=>t.name==='Sabrina'&&!t.route);const v=TRAINER_ORDER[t].variants[0];
 decodeEmulatorParty=x=>x.mock;
 const dis=(first)=>'00'.repeat(0x16)+(first?'02':'00')+'00'.repeat(5);
 const mon=(hp,max,extra)=>Object.assign({species:1,hp,maxHp:max,level:59,stages:[6,6,6,6,6,6,6,6],status:0,pid:0,status2:0,status3:0,lastMove:0,lockedMove:0,disable:dis(true),wish:0},extra||{});
 const names=v.sets.map(getPokemonName);
 const state={inBattle:true,trainer:v.trainerIds[0],party:{mock:[{pid:111,species:'Garchomp'},{pid:222,species:'Gengar'},{pid:333,species:'Togekiss'}]},enemyParty:{mock:names.map(n=>({species:n}))},
  partyIndexes:st.idx,mons:[mon(st.hp[0],200),mon(st.hp[1],200),mon(st.hp[2],200,st.extra2),mon(st.hp[3],200,st.extra3)]};
 emulatorSync.applied={};applyEmulatorState(state);
 return new Promise(r=>setTimeout(()=>{const c=getDoublesPartners();doublesPrediction=null;const pr=getDoublesPrediction();
  r({status:$('#emulator-sync-status').text(),p1:$('#p1 input.set-selector').val(),p2:$('#p2 input.set-selector').val(),names,chosen:{yours:c.yours,yoursHP:c.yoursHP,foe:c.foe,foeHP:c.foeHP,ys:c.yoursState&&{status:c.yoursState.status,boosts:c.yoursState.boosts,sub:c.yoursState.vol&&c.yoursState.vol.sub},fs:c.foeState&&{status:c.foeState.status}},
   battle:pr.battle&&{yours:pr.battle.yourSets,foes:pr.battle.foes.map(f=>f&&f.name),y1:pr.battle.yours[1]&&{hp:pr.battle.yours[1].hp,max:pr.battle.yours[1].maxHP,status:pr.battle.yours[1].status,atk:pr.battle.yours[1].boosts.atk,sub:pr.battle.yours[1].vol.sub,first:pr.battle.yours[1].firstTurn},f1:pr.battle.foes[1]&&{status:pr.battle.foes[1].status,hp:pr.battle.foes[1].hp,max:pr.battle.foes[1].maxHP}}})},1200))},st);
// 1: Garchomp + Togekiss (box, not team) vs slots 0 and 1; Togekiss at half HP, paralysed, +2 Atk, behind a Substitute
let r=await run({idx:[0,0,2,1],hp:[200,200,100,150],extra2:{status:0x40,stages:[6,8,6,6,6,6,6,6],status2:0x01000000,disable:'00'.repeat(0x1C)},extra3:{status:0x10}});
ok(/double battle/.test(r.status),'status: '+r.status);
ok(r.p1==='Garchomp (Mine)'&&getName(r.p2)===r.names[0],'panels: '+r.p1+' vs '+r.p2);
ok(r.chosen.yours==='Togekiss (Mine)'&&r.chosen.yoursHP===50&&r.chosen.foe===1&&r.chosen.foeHP===75,'partners from the game: '+JSON.stringify(r.chosen));
ok(r.battle&&r.battle.yours[1]==='Togekiss (Mine)'&&r.battle.foes[1]===r.names[1],'doubles battle uses them: '+JSON.stringify(r.battle&&[r.battle.yours,r.battle.foes]));
ok(r.battle.y1.status==='par'&&r.battle.y1.atk===2&&r.battle.y1.sub===true&&r.battle.y1.first===false&&Math.abs(r.battle.y1.hp/r.battle.y1.max-0.5)<0.02,'your partner state: '+JSON.stringify(r.battle.y1));
ok(r.battle.f1.status==='brn'&&Math.abs(r.battle.f1.hp/r.battle.f1.max-0.75)<0.02,'foe partner state: '+JSON.stringify(r.battle.f1));
// 2: your left has fainted: the right one moves into the panel, nobody beside it; the foe's right fainted too
r=await run({idx:[0,0,1,1],hp:[0,200,120,0]});
ok(r.p1==='Gengar (Mine)'&&r.chosen.yours==='none'&&r.chosen.foe==='none','after faints: '+r.p1+' alone, '+JSON.stringify(r.chosen));
ok(r.battle===null,'one a side: played as a single battle');
// 3: foe's left fainted: its right goes in the panel
r=await run({idx:[0,0,2,3],hp:[200,0,200,200]});
ok(getName(r.p2)===r.names[3]&&r.chosen.foe==='none'&&r.chosen.yours==='Togekiss (Mine)','foe right in the panel: '+r.p2+' '+JSON.stringify(r.chosen));
ok(errs.length===0,'no page errors '+errs.slice(0,3).join(' | '));
await b.close();console.log(fails?fails+' FAILED':'all passed')})();
function getName(id){return (id||'').replace(/ \(.*/,'')}
