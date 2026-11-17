// Browser check (see README, Development): node test/browser/run.js
const {VERSION,BASE,SHOTS}=require('./lib');
// Moving boss fights (optional ones too) before another fight: nav order, arcs, level cap, KOs kept, back to its own place.
const {chromium}=require('playwright');
let fails=0;const ok=(c,m)=>{console.log((c?'ok   ':'FAIL ')+m);if(!c)fails++};
(async()=>{const b=await chromium.launch();
for(const vp of [{width:1400,height:900},{width:640,height:480}]){
const ctx=await b.newContext({viewport:vp,serviceWorkers:'block'});const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message+' '+(e.stack||'').split('\n')[1]));
p.on('dialog',d=>d.accept());
await p.addInitScript(VERSION=>{localStorage.setItem('lastChangelogVersion',VERSION)},VERSION);
await p.goto(BASE+'/normal.html');await p.waitForTimeout(2500);const tag=vp.width+': ';
const find=(n,l)=>p.evaluate(([n,l])=>TRAINER_ORDER.findIndex(t=>t.name===n&&!t.route&&(!l||t.location===l)),[n,l]);
const cole=await find('Ace Cole'), erika=await find('Erika'), giovanni=await find('Giovanni','Rocket Hideout');
const arcOf=i=>p.evaluate(i=>getArc(i).name+' '+getArc(i).cap,i);
const before=await arcOf(cole);
const arcsBefore=await p.evaluate(()=>getArcs().map(a=>a.name).join(','));
// KO on Ace Cole is kept through the move
await p.evaluate(i=>{showTrainer(i)},cole);await p.waitForTimeout(600);
await p.evaluate(()=>{writeSetting('mastersheetFilters',JSON.stringify({reorder:true}))});
await p.evaluate(()=>openSheet('mastersheet'));await p.waitForTimeout(700);
ok(await p.evaluate(()=>$('.ms-tools label:contains("Reorder") input').prop('checked')||$('.ms-order-tools').is(':visible')),tag+'reorder on');
// open the arc with Ace Cole and use its menu
const r=await p.evaluate(([cole,erika])=>{const d=$('.ms-arc').filter((i,e)=>$(e).find('.ms-trainer[data-index="'+cole+'"]').length||/Ariana/.test($(e).find('.ms-arc-name').text()));d.first().prop('open',true).trigger('toggle');
 const card=$('.ms-trainer[data-index="'+cole+'"]');const sel=card.find('.ms-place-move');if(!sel.length)return 'no menu';sel.focus();sel.val(String(erika)).trigger('change');return 'ok'},[cole,erika]);
await p.waitForTimeout(800);
ok(r==='ok',tag+'Ace Cole has a Move-before menu: '+r);
const after=await arcOf(cole);
ok(await p.evaluate(i=>TRAINER_ORDER[i].moved&&TRAINER_ORDER[TRAINER_ORDER[i].moved.before].name,cole)==='Erika',tag+'Ace Cole moved before Erika');
ok(/^Erika 44/.test(after),tag+'its arc and level cap follow: '+before+' -> '+after);
ok(await p.evaluate(([c,e])=>{const o=getTrainerNavOrder(true);return o.indexOf(c)<o.indexOf(e)&&o.indexOf(c)>o.indexOf(e)-30&&o.filter(x=>x===c).length===1},[cole,erika]),tag+'Previous / Next: once, just before Erika');
ok(await p.evaluate(()=>getArcs().map(a=>a.name).join(','))===arcsBefore,tag+'the other arcs unchanged');
ok((await p.evaluate(i=>$('.ms-trainer[data-index="'+i+'"]').closest('.ms-arc').find('.ms-arc-name').text(),cole)).indexOf('Erika')===0,tag+'Mastersheet lists it in the Erika arc');
ok(await p.evaluate(()=>describeTrainerOrderFixes().indexOf('Ace Cole')!==-1),tag+'in Copy order changes');
// a required boss: Giovanni (Rocket Hideout) before Erika -> arcs still well formed
await p.evaluate(([g,e])=>moveRouteTrainersBefore([g],e),[giovanni,erika]);await p.waitForTimeout(500);
const arcs=await p.evaluate(()=>getArcs().map(a=>a.name+':'+a.first+'-'+a.last));
ok(arcs.length>10&&await p.evaluate(()=>{const a=getArcs();return a.every((x,i)=>i===0||x.first>a[i-1].last)}),tag+'arcs well formed after moving a gym-arc boss: '+arcs.slice(4,8).join(' '));
// reload keeps it
await p.reload();await p.waitForTimeout(2500);
ok(await p.evaluate(i=>!!TRAINER_ORDER[i].moved,cole),tag+'kept after reload');
// back to its own place
await p.evaluate(i=>unmoveFight(i),cole);await p.evaluate(i=>unmoveFight(i),giovanni);await p.waitForTimeout(400);
ok((await arcOf(cole))===before&&(await p.evaluate(()=>getArcs().map(a=>a.name).join(',')))===arcsBefore,tag+'Own place puts it back: '+await arcOf(cole));
await p.evaluate(()=>openSheet('mastersheet'));await p.waitForTimeout(600);
ok(await p.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),tag+'no sideways scroll');
await p.screenshot({path:SHOTS+'/move_bosses_'+vp.width+'.png'});
ok(errs.length===0,tag+'no page errors '+errs.slice(0,3).join(' | '));
await ctx.close()}
await b.close();console.log(fails?fails+' FAILED':'all passed')})();
