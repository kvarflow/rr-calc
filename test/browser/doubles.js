// Browser check (see README, Development): node test/browser/run.js
const {VERSION,BASE,SHOTS}=require('./lib');
const {chromium}=require('playwright');
let fails=0;const ok=(c,m)=>{console.log((c?'ok   ':'FAIL ')+m);if(!c)fails++};
(async()=>{const b=await chromium.launch();
for(const vp of [{width:1400,height:900},{width:640,height:480}]){
const ctx=await b.newContext({viewport:vp,serviceWorkers:'block'});const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
await p.addInitScript(VERSION=>{localStorage.setItem('lastChangelogVersion',VERSION)},VERSION);
await p.goto(BASE+'/normal.html');await p.waitForTimeout(2500);
const tag=vp.width+': ';
const go=async(name,loc)=>{await p.evaluate(([n,l])=>showTrainer(TRAINER_ORDER.findIndex(t=>t.name===n&&!t.route&&(!l||t.location===l))),[name,loc]);await p.waitForTimeout(1200)};
const pred=()=>p.evaluate(()=>{const t0=performance.now();doublesPrediction=null;let pr;try{pr=getDoublesPrediction()}catch(e){return {err:e.message+' '+e.stack.split('\n')[1]}}if(!pr.battle)return null;const d=pr.battle;return {ms:Math.round(performance.now()-t0),foes:d.foes.map((f,x)=>f&&{name:f.name,cls:doublesClass(f),moves:f.moves.map((m,i)=>m&&m.name+' '+pr.foes[x].shares[i].map(s=>Math.round(s*100)).join('/')),none:Math.round(pr.foes[x].none*100),sum:Math.round((pr.foes[x].shares.reduce((a,s)=>a+s[0]+s[1],0)+pr.foes[x].onPartner.reduce((a,v)=>a+v,0)+pr.foes[x].none+(pr.foes[x].switchShare||0))*100)}),yours:d.yourSets}});
await go('Erika');ok(await pred()===null&&await p.evaluate(()=>!$('.dbl-button').length),tag+'singles fight: no doubles');
for(const [n,l] of [['Sabrina'],['Giovanni','Cerulean Cave'],['Lorelei'],['Ariana & Archer'],['Super Nerd Miguel'],['Guard']]){
 await go(n,l);const r=await pred();
 ok(r&&!r.err&&r.foes[0]&&r.foes[1]&&r.foes.every(f=>f.sum===100),tag+n+' '+(r&&r.ms)+'ms '+JSON.stringify(r&&(r.err||r.foes.map(f=>f.name+'[c'+f.cls+'] '+f.moves.filter(Boolean).join(', ')+(f.none?' none '+f.none:'')))));
}
await go('Sabrina');
ok(await p.evaluate(()=>$('.dbl-button:visible').length===1),tag+'Doubles button shown');
await p.evaluate(()=>$('.dbl-button').click());await p.waitForTimeout(400);
const dlg=await p.evaluate(()=>({tables:$('.dbl-table').length,rows:$('.dbl-table tr').length,sel:$('.dbl-select').length,fits:$('.dbl-dialog')[0].getBoundingClientRect().right<=window.innerWidth+1,foeOpts:$('.dbl-select').first().find('option').length}));
ok(dlg.tables===2&&dlg.sel===2&&dlg.fits&&dlg.foeOpts>=5,tag+'dialog '+JSON.stringify(dlg));
await p.screenshot({path:SHOTS+'/dbl_'+vp.width+'.png'});
// change the foe's partner
const before=await p.evaluate(()=>$('.dbl-table').eq(1).find('th').first().text());
await p.evaluate(()=>{const s=$('.dbl-select').first();s.val(s.find('option').eq(2).val()).trigger('change')});await p.waitForTimeout(900);
const after=await p.evaluate(()=>$('.dbl-table').eq(1).find('th').first().text());
ok(before&&after&&before!==after,tag+'changing the partner redraws: '+before+' -> '+after);
// nobody beside: one foe table
await p.evaluate(()=>{const s=$('.dbl-select').first();s.val('none').trigger('change')});await p.waitForTimeout(900);
ok(await p.evaluate(()=>$('.dbl-table').length===0||$('.dbl-table').length===1),tag+'no partner: '+await p.evaluate(()=>$('.dbl-table').length+' table(s), '+$('.dbl-dialog .bh-help').eq(1).text().slice(0,60)));
await p.evaluate(()=>$('.dbl-dialog .box-dialog-buttons button').click());
// battle chips for foe A sum over targets
await p.evaluate(()=>{doublesPartners.foe=null;recalculateDoubles()});await p.waitForTimeout(800);
const chips=await p.evaluate(()=>$('label[for^="resultMoveR"]').map((i,e)=>$(e).attr('data-ai')||'').get());
ok(chips.filter(Boolean).length>=2,tag+'Battle chips in doubles: '+chips.join(' | '));
ok(errs.length===0,tag+'no page errors '+errs.slice(0,3).join(' | '));
await ctx.close()}
await b.close();console.log(fails?fails+' FAILED':'all passed')})();
