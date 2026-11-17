// Browser check (see README, Development): node test/browser/run.js
const {VERSION,BASE,SHOTS}=require('./lib');
const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const p=await b.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.addInitScript(VERSION=>{localStorage.setItem('lastChangelogVersion',VERSION)},VERSION);
await p.goto(BASE+'/normal.html');await p.waitForTimeout(2500);
await p.evaluate(()=>showTrainer(TRAINER_ORDER.findIndex(t=>t.name==='Erika'&&!t.route)));await p.waitForTimeout(1000);
const r=await p.evaluate(()=>{
 const moves=RADICAL_RED_SAVE_DATA.moves;const id=n=>moves.indexOf(n);
 const d=new Array(0x1C).fill(0);const set16=(o,v)=>{d[o]=v&255;d[o+1]=v>>8};
 set16(4,id('Drain Punch'));set16(6,id('U-turn'));d[8]=2;d[9]=1;d[0x0B]=3;d[0x0E]=2;d[0x0F]=0;d[0x13]=3;d[0x16]=0;
 const hex=d.map(x=>('0'+x.toString(16)).slice(-2)).join('');
 const battler={status2:(0x01000000|0x3|0x00400000)>>>0,status3:0x20|0x800,lastMove:id('Grassy Glide'),lockedMove:0,disable:hex,wish:1};
 applyEmulatorHistory('p2',battler);const v=getBattleVolatile('p2');
 const fresh=getEmulatorVolatile('p1',{status2:0,status3:0,lastMove:0,lockedMove:0,disable:'00'.repeat(0x16)+'02'+'00'.repeat(5),wish:0});
 return {v,fresh,old:getEmulatorVolatile('p1',{species:1})};
});
console.log(JSON.stringify(r.v));console.log(JSON.stringify(r.fresh));
const v=r.v;const ok=v.sub&&v.confused&&v.recharge&&v.perish&&v.perishLast&&v.yawn&&v.taunt&&v.encore&&v.lastMove==='U-turn'&&v.disabled==='Drain Punch'&&v.protectUses===2&&v.stockpile===1&&v.wish&&v.firstTurn===false&&!v.torment&&!v.locked
 &&r.fresh.firstTurn===true&&r.fresh.lastMove===''&&!r.fresh.sub&&r.old===null;
console.log(ok&&!errs.length?'all passed':'FAILED '+errs.join('|'));await b.close()})();
