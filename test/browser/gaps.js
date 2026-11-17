// Browser check (see README, Development): node test/browser/run.js
const {VERSION,BASE,SHOTS}=require('./lib');
// The last AI gaps: Fly / Dig in progress, passing a Wish (bench HP from the game), moves on its own partner.
const {chromium}=require('playwright');
let fails=0;const ok=(c,m)=>{console.log((c?'ok   ':'FAIL ')+m);if(!c)fails++};
(async()=>{const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:1300,height:900},serviceWorkers:'block'});const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message+' '+(e.stack||'').split('\n')[1]));
await p.addInitScript(VERSION=>{localStorage.setItem('lastChangelogVersion',VERSION)},VERSION);
await p.goto(BASE+'/normal.html');await p.waitForTimeout(2000);
await p.evaluate(()=>{const mk=(lv,ab,it,nat,moves)=>({level:lv,ability:ab,item:it,nature:nat,evs:{hp:252,at:0,df:252,sa:0,sd:4,sp:0},ivs:{},moves});
 localStorage.setItem(getCustomSetsKey(),JSON.stringify({Garchomp:{Mine:mk(60,'Rough Skin','Leftovers','Impish',['Dig','Rock Slide','Dragon Claw','Protect'])},Blissey:{Mine:mk(60,'Natural Cure','Leftovers','Bold',['Seismic Toss','Soft-Boiled','Toxic','Protect'])}}));writeBoxLayout({team:['Garchomp (Mine)','Blissey (Mine)']})});
await p.reload();await p.waitForTimeout(2500);
await p.evaluate(()=>{$('#p1 input.set-selector').val('Garchomp (Mine)').change()});await p.waitForTimeout(500);
// Fly / Dig: the Turn flag, and its effect on the doubles target choice
await p.evaluate(()=>showTrainer(TRAINER_ORDER.findIndex(t=>t.name==='Sabrina'&&!t.route)));await p.waitForTimeout(1000);
const onYours=()=>p.evaluate(()=>{doublesPrediction=null;const pr=getDoublesPrediction();return pr.foes.map(f=>[0,1].map(y=>Math.round(f.shares.reduce((a,s)=>a+s[y],0)*100)))});
const before=await onYours();
await p.evaluate(()=>{logBattleMove('p1','Dig');const v=ensureBattleVolatile('p1');v.semiInv=true;v.locked=true;refreshBattleHistory()});await p.waitForTimeout(800);
const after=await onYours();
ok(await p.evaluate(()=>$('.bh-button').not('.dbl-button').length===1),'Turn button');
ok(after[1][1]>=before[1][1]&&after.every(f=>f[0]+f[1]>0),'your Pokémon underground: attacks go to the other one '+JSON.stringify(before)+' -> '+JSON.stringify(after));
ok(await p.evaluate(()=>{const bt=readAIBattle();return bt.player.vol.semiInv===true&&forcedMoveIndex(bt.player)===0}),'you are locked into Dig while underground');
await p.evaluate(()=>{clearBattleHistory();refreshBattleHistory()});
// Bench HP from the game, and Wish passing (single battle)
await p.evaluate(()=>showTrainer(TRAINER_ORDER.findIndex(t=>t.name==='Erika'&&!t.route)));await p.waitForTimeout(1000);
const wish=await p.evaluate(()=>{
 emulatorSync.connected=true;const sets=getTrainerVariant(TRAINER_ORDER[currentTrainerIndex]).sets;
 emulatorBench={fight:currentTrainerIndex,slots:{1:{hpPercent:30,status:''},2:{hpPercent:100,status:''},3:{hpPercent:100,status:''},4:{hpPercent:100,status:''},5:{hpPercent:100,status:''}}};
 // Its Pokémon 2 knows Wish
 const ai=readAIBattle();const benchHP=ai.party.filter(m=>m.slot===1).map(m=>m.hp+'/'+m.maxHP)[0];
 const t=new AITurn(seededPicker(1),ai);ai.ai.vol=Object.assign({},AI_VOLATILE_DEFAULTS,{wish:true});ai.ai.hp=ai.ai.maxHP;predictPlayer(t);
 const list=switchInsInOrder(t).map(e=>e.entry.mon.slot+':'+e.entry.mon.hp+'/'+e.entry.mon.maxHP+':'+predictedHitWontKO(t,e.entry.mon));const pass=passOnWish(t,false);const passDoubles=passOnWish(t,true);
 emulatorSync.connected=false;
 return {benchHP,pass:pass&&pass.mon.slot,passDoubles:passDoubles&&passDoubles.mon.slot,sets:sets.length,list,pred:(t.predicted(ai.player)||{}).name}});
ok(/^\d+\/\d+$/.test(wish.benchHP)&&+wish.benchHP.split('/')[0]<+wish.benchHP.split('/')[1]/2,'benched Pokémon at its HP from the game: '+wish.benchHP);
ok(wish.list.some(e=>/^1:.*:false$/.test(e))?wish.pass===null:wish.pass===1,'singles: not into a hit that knocks it out '+JSON.stringify(wish));
ok(wish.passDoubles===1,'doubles (no such check): Wish passed to the hurt benched Pokémon, slot '+wish.passDoubles);
const abil=await p.evaluate(()=>{
 const bt=readAIBattle();const mk=name=>{const d=getAIMoveData({name:name});return {index:0,name:name,type:'Normal',bp:0,effect:d.effect,accuracy:d.accuracy,chance:d.chance,target:d.target,priority:d.priority,flags:d.flags,split:d.split,power:d.power,maxDamage:0,maxCritDamage:0,critChance:0,effectiveness:1}};
 const run=(name,theirs,mine,setup)=>{const ai=$.extend({},bt.ai,{moves:bt.ai.moves.slice(),ability:mine||bt.ai.ability});ai.moves[0]=mk(name);const pl=$.extend({},bt.player,{ability:theirs});
  const battle=$.extend({},bt,{ai:ai,player:pl,party:[]});const t=new AITurn(seededPicker(3),battle);if(setup)setup(t,battle);predictPlayer(t);t.phase='a';t.cache={};
  return [scoreNegatives(t,ai,pl,0,100),scorePositives(t,ai,pl,0,100)]};
 return {ratings:[abilityRating('Truant'),abilityRating('Wonder Guard')],
  swapWG:run('Skill Swap','Wonder Guard'),swapHP:run('Skill Swap','Huge Power','Defeatist'),worryInsomnia:run('Worry Seed','Insomnia'),
  gastro:run('Gastro Acid','Huge Power'),mirrorNone:run('Mirror Move','Rough Skin')}});
ok(abil.ratings[0]===-2&&abil.ratings[1]===10,'ability ratings from the game '+abil.ratings);
ok(abil.swapWG[0]===90,'Skill Swap can\'t take Wonder Guard (-10) '+abil.swapWG);
ok(abil.swapHP[0]===100&&abil.swapHP[1]>=100,'Skill Swap for a better ability '+abil.swapHP);
ok(abil.worryInsomnia[0]===90,'Worry Seed into Insomnia (-10) '+abil.worryInsomnia);
ok(abil.mirrorNone[0]<=90||abil.mirrorNone[0]===100,'Mirror Move scored '+abil.mirrorNone);
ok(errs.length===0,'no page errors '+errs.slice(0,3).join(' | '));
await b.close();console.log(fails?fails+' FAILED':'all passed')})();
