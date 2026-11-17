// Browser check (see README, Development): node test/browser/run.js
const {VERSION,BASE,SHOTS}=require('./lib');
const {chromium}=require('playwright');
let fails=0;const ok=(c,m)=>{console.log((c?'ok   ':'FAIL ')+m);if(!c)fails++};
(async()=>{const b=await chromium.launch();
for(const vp of [{width:1400,height:900},{width:640,height:480}]){
const ctx=await b.newContext({viewport:vp,serviceWorkers:'block'});const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.addInitScript(VERSION=>{if(!localStorage.getItem('lastChangelogVersion'))localStorage.setItem('lastChangelogVersion',VERSION)},VERSION);
await p.goto(BASE+'/normal.html');await p.waitForTimeout(2500);
await p.evaluate(()=>{writeSetting('mastersheetFilters', JSON.stringify({reorder:true}));});
const keyName=await p.evaluate(()=>{for(const k of Object.keys(localStorage)) if(/filter/i.test(k)) return k; return null});
await p.evaluate(()=>openSheet('mastersheet'));await p.waitForTimeout(800);
let on=await p.evaluate(()=>!!$('.ms-order-tools:visible').length);
if(!on){await p.evaluate(()=>{$('.ms-tools label:contains("Reorder") input').click()});await p.waitForTimeout(500)}
ok(await p.evaluate(()=>$('.ms-order-tools').is(':visible')),'reorder tools shown '+vp.width);
// open Erika arc
await p.evaluate(()=>{const d=$('.ms-arc').filter((i,e)=>/Erika Arc/.test($(e).find('.ms-arc-name').text())).first();d.prop('open',true).trigger('toggle')});await p.waitForTimeout(500);
const info=await p.evaluate(()=>{const d=$('.ms-arc').filter((i,e)=>/Erika Arc/.test($(e).find('.ms-arc-name').text())).first();return {places:d.find('.ms-place-name').map((i,e)=>$(e).text()).get(),movers:d.find('.ms-place-move').length,arrows:d.find('.ms-move').length}});
ok(info.places.filter(n=>n!=='Route 7').join('>')==='Route 9>Route 10>Rock Tunnel>Route 10>Lavender Town>Route 8>Celadon City','Erika arc places: '+info.places.join('>'));
ok(info.movers>=5&&info.arrows>40,'movers '+info.movers+' arrows '+info.arrows);
// first Route 9 trainer: up arrow crosses Surge into Surge arc
const r=await p.evaluate(()=>{const first=$('.ms-arc').filter((i,e)=>/Erika Arc/.test($(e).find('.ms-arc-name').text())).first().find('.ms-trainer-route').first();const idx=+first.attr('data-index');const up=first.find('.ms-move').eq(0);const dis=up.prop('disabled');up.focus();up.click();return {idx,dis,name:TRAINER_ORDER[idx].name,before:TRAINER_ORDER[TRAINER_ORDER[idx].route.before].name}});
await p.waitForTimeout(600);
ok(!r.dis&&r.before==='Lt. Surge','▲ at arc start moves '+r.name+' before '+r.before);
ok(await p.evaluate(i=>{const c=$('.ms-trainer[data-index="'+i+'"]');return c.length&&/Surge Arc/.test(c.closest('.ms-arc').find('.ms-arc-name').text())&&c.closest('.ms-arc').prop('open')},r.idx),'moved card shown in Surge arc, opened');
// down again returns it
await p.evaluate(i=>{$('.ms-trainer[data-index="'+i+'"] .ms-move').eq(1).click()},r.idx);await p.waitForTimeout(600);
ok(await p.evaluate(i=>TRAINER_ORDER[TRAINER_ORDER[i].route.before].name,r.idx)==='Picnicker Caitlin','▼ moves it back past Surge');
ok(await p.evaluate(i=>getTrainerNavOrder(true).filter(x=>TRAINER_ORDER[x].route&&TRAINER_ORDER[x].location==='Route 9')[0]===i,r.idx),'and first of Route 9 again');
// place mover: Route 8 before Giovanni (Rocket Hideout)
const m=await p.evaluate(()=>{const blk=$('.ms-place').filter((i,e)=>$(e).find('.ms-place-name').text()==='Route 8').first();const sel=blk.find('.ms-place-move');const opt=sel.find('option').filter((i,e)=>/^Giovanni \(Rocket Hideout\)/.test($(e).text())).first();const n=blk.find('.ms-trainer-route').length;sel.focus();sel.val(opt.val()).trigger('change');return {n,label:sel.find('option').first().text(),groups:sel.find('optgroup').length}});
await p.waitForTimeout(700);
const after=await p.evaluate(()=>{const r8=getTrainerNavOrder(true).filter(x=>TRAINER_ORDER[x].route&&TRAINER_ORDER[x].location==='Route 8');return {n:r8.length,befores:[...new Set(r8.map(x=>TRAINER_ORDER[TRAINER_ORDER[x].route.before].name+'@'+TRAINER_ORDER[TRAINER_ORDER[x].route.before].location))],arc:getArcs().filter(a=>getStoryIndex(r8[0])>=a.first&&getStoryIndex(r8[0])<=a.last)[0].name,copy:$('.ms-order-copy').length,text:describeTrainerOrderFixes().length}});
ok(m.n===12&&after.befores.join()==='Giovanni@Rocket Hideout'&&after.arc==='Giovanni','place menu moved '+m.n+' Route 8 trainers before '+after.befores+' ('+m.label+', '+m.groups+' arcs)');
ok(after.copy===1&&after.text>100,'Copy order changes offered');
// nav order: Next from last hideout route trainer... check order contiguous: Route 8 right before Giovanni's group end
ok(await p.evaluate(()=>{const o=getTrainerNavOrder(true);const g=TRAINER_ORDER.findIndex(t=>t.name==='Giovanni'&&t.location==='Rocket Hideout');const at=o.indexOf(g);return TRAINER_ORDER[o[at-1]].location==='Route 8'}),'Previous from Giovanni is a Route 8 trainer');
// persists over reload
await p.reload();await p.waitForTimeout(2500);
ok(await p.evaluate(()=>{const r8=TRAINER_ORDER.findIndex(t=>t.route&&t.location==='Route 8');return TRAINER_ORDER[TRAINER_ORDER[r8].route.before].location})==='Rocket Hideout','kept after reload');
// reset
p.on('dialog',d=>d.accept());
await p.evaluate(()=>openSheet('mastersheet'));await p.waitForTimeout(700);
await p.evaluate(()=>$('.ms-order-reset').click());await p.waitForTimeout(700);
ok(await p.evaluate(()=>{const r8=TRAINER_ORDER.findIndex(t=>t.route&&t.location==='Route 8');return TRAINER_ORDER[TRAINER_ORDER[r8].route.before].name})==='Erika','Reset order puts Route 8 back before Erika');
ok(await p.evaluate(()=>{const o=getTrainerNavOrder(true).filter(x=>TRAINER_ORDER[x].route&&(TRAINER_ORDER[x].location==='Route 10'||TRAINER_ORDER[x].location==='Rock Tunnel')).map(x=>TRAINER_ORDER[x].location);return o[0]==='Route 10'&&o[1]==='Rock Tunnel'&&o[o.length-1]==='Route 10'}),'built-in fix kept: Route 10, Rock Tunnel, Route 10');
// other sheets and no overflow
await p.evaluate(()=>openSheet('frags'));await p.waitForTimeout(500);
ok(errs.length===0,'no page errors '+errs.join(' | '));
await p.evaluate(()=>openSheet('mastersheet'));await p.waitForTimeout(600);
await p.screenshot({path:SHOTS+'/move_'+vp.width+'.png'});
ok(await p.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),'no sideways scroll');
await ctx.close()}
await b.close();console.log(fails?fails+' FAILED':'all passed')})();
