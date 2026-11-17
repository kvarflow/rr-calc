// Browser check (see README, Development): node test/browser/run.js
const {VERSION,BASE,SHOTS}=require('./lib');
const {chromium}=require('playwright');
let fails=0;const ok=(c,m)=>{console.log((c?'ok   ':'FAIL ')+m);if(!c)fails++};
(async()=>{const b=await chromium.launch();
for(const mode of ['normal','hardcore']) for(const vp of [{width:1400,height:900},{width:640,height:480}]){
const ctx=await b.newContext({viewport:vp,serviceWorkers:'block',permissions:['clipboard-read','clipboard-write']});const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.addInitScript(VERSION=>{localStorage.setItem('lastChangelogVersion',VERSION)},VERSION);
await p.goto(BASE+'/'+mode+'.html');await p.waitForTimeout(2500);
const tag=mode+' '+vp.width+': ';
ok(await p.evaluate(()=>!$('.info-dialog:visible, .list-dialog:visible').length),tag+'no What\'s new once seen');
// every trainer's sets exist
const missing=await p.evaluate(()=>{const bad=[];TRAINER_ORDER.forEach(t=>t.variants.forEach(v=>v.sets.forEach(id=>{const sp=id.slice(0,id.indexOf(' ('));const nm=id.slice(sp.length+2,-1);if(!(setdex[sp]&&setdex[sp][nm]))bad.push(id)})));return bad});
ok(missing.length===0,tag+'every trainer set exists '+missing.slice(0,3));
const keys=await p.evaluate(()=>{const seen={},dup=[];TRAINER_ORDER.forEach((t,i)=>{if(!t.route)return;const k=getTrainerKey(i);if(seen[k])dup.push(k);seen[k]=1});return dup});
ok(keys.length===0,tag+'route trainer keys unique '+keys.slice(0,3));
// go to Hiker Lucas
const lucas=await p.evaluate(()=>TRAINER_ORDER.findIndex(t=>t.name==='Hiker Lucas'));
await p.evaluate(i=>{showTrainer(i)},lucas).catch(()=>{});await p.waitForTimeout(900);
const st=await p.evaluate(()=>({name:$('#trainer-name').text()||'',set:$('#p2 .set-selector .select2-chosen').first().text()||$('#p2 input.set-selector').val(),moves:$('#p2 .move-selector').map((i,e)=>$(e).val()).get(),cur:currentTrainerIndex,arc:getArc(currentTrainerIndex).name}));
ok(st.cur===lucas&&/Honedge/.test(st.set)&&st.moves.indexOf('Gyro Ball')!==-1&&st.arc==='Erika',tag+'Hiker Lucas: '+st.set+' ['+st.moves.join(',')+'] arc '+st.arc);
const rep=await p.evaluate(()=>buildAIReport());
ok(/Hiker Lucas, Rock Tunnel/.test(rep)&&/The calc predicted: /.test(rep)&&/Gyro Ball \d+%|Gyro Ball <1%/.test(rep),tag+'AI report: '+rep.split('\n').slice(0,4).join(' / ').slice(0,200));
let j=null;try{j=JSON.parse(rep.slice(rep.indexOf('{')))}catch(e){}
ok(j&&j.foe.name==='Honedge'&&j.you.moves.length&&j.trainer.ids[0]===194&&j.field,tag+'report JSON parses');
const btn=await p.evaluate(()=>{const b=$('#copy-ai-report');if(!b.length)return 'none';return b.is(':visible')?'visible':'hidden'});
if(btn==='hidden'){await p.evaluate(()=>{const t=$('.ss-tab').filter((i,e)=>/More/.test($(e).text()));t.click()});await p.waitForTimeout(400)}
ok(await p.evaluate(()=>$('#copy-ai-report').is(':visible')),tag+'Copy AI report button visible');
await p.evaluate(()=>$('#copy-ai-report').click());await p.waitForTimeout(400);
const clip=await p.evaluate(()=>navigator.clipboard.readText()).catch(()=>'');
ok(/^Trainer AI report/.test(clip)&&/Copied/.test(await p.evaluate(()=>$('#copy-ai-report').text())),tag+'clipboard has the report');
// Next/Previous walk whole game without error and visits all
const walk=await p.evaluate(()=>{const o=getTrainerNavOrder(true);return {n:o.length,uniq:new Set(o).size,total:TRAINER_ORDER.filter(t=>!t.duplicate).length}});
ok(walk.n===walk.uniq&&walk.n>=walk.total-1,tag+'nav order has every trainer once: '+walk.n+'/'+walk.total);
// arcs: Erika arc bosses
const arcs=await p.evaluate(()=>getArcs().map(a=>a.name+':'+TRAINER_ORDER[a.first].name+'..'+TRAINER_ORDER[a.last].name));
ok(arcs.some(a=>/^Erika:Picnicker (Caitlin|Alicia)\.\.Erika$/.test(a))&&arcs.some(a=>/^Lt\. Surge:Grunt\.\.Lt\. Surge$/.test(a)),tag+'arcs '+arcs.slice(2,6).join(' | '));
ok(errs.length===0,tag+'no page errors '+errs.join(' | '));
await ctx.close()}
await b.close();console.log(fails?fails+' FAILED':'all passed')})();
