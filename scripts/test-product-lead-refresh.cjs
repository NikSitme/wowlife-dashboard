const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const ui=fs.readFileSync('scripts/product-metrics-ui.js','utf8'),html=fs.readFileSync('index.html','utf8');
const source=ui.slice(ui.indexOf('  function loadLeads(){'),ui.indexOf('  function start(){'));
const responses=[],requests=[];let timeoutCallback,cleared=0;
const context=vm.createContext({AbortController,setTimeout:fn=>{timeoutCallback=fn;return 1;},clearTimeout:()=>cleared++,window:{LeadMetrics:{valid:d=>d&&d.valid===true}},fetch:(url,options)=>{requests.push({url,options});return responses.shift()();},root:{closest:()=>({hidden:true})},data:{},draw:()=>{throw Error('hidden tab should not draw');}});
vm.runInContext('var leadData=null,leadError="",leadLoading=false,leadRequest=null;\n'+source,context);
const snapshot=(end,at)=>({valid:true,includesBaskets:true,coverageEnd:end,generated_at:at});
const reply=d=>()=>Promise.resolve({ok:true,json:()=>Promise.resolve(d)});
(async()=>{
 let resolve;responses.push(()=>new Promise(r=>resolve=r));
 const first=context.window.__productMetricsRefreshLeads(),overlap=context.window.__productMetricsRefreshLeads();
 assert.equal(first,overlap,'overlapping refreshes share one request');assert.equal(requests.length,1);
 resolve({ok:true,json:()=>Promise.resolve(snapshot('2026-11-23','2026-11-24T00:00:00Z'))});await first;
 responses.push(reply(snapshot('2026-11-27','2026-11-28T00:00:00Z')));
 assert.equal((await context.window.__productMetricsRefreshLeads()).coverageEnd,'2026-11-27');
 assert.equal(vm.runInContext('leadData.coverageEnd',context),'2026-11-27','refresh replaces the old snapshot in the same session');
 assert.equal(requests.length,2);assert(requests.every(r=>r.url==='data/lead-metrics.json'&&r.options.cache==='no-cache'));
 for(const bad of [snapshot('2026-11-23','2026-11-29T00:00:00Z'),snapshot('2026-11-27','2026-11-27T00:00:00Z'),{valid:false}]){
  responses.push(reply(bad));assert.equal(await context.window.__productMetricsRefreshLeads(),null);
  assert.equal(vm.runInContext('leadData.coverageEnd',context),'2026-11-27','bad response cannot replace the last valid data');
 }
 responses.push(()=>Promise.reject(Error('offline')));assert.equal(await context.window.__productMetricsRefreshLeads(),null);
 assert.equal(vm.runInContext('leadError',context),'offline');assert.equal(vm.runInContext('leadLoading',context),false);
 responses.push(()=>new Promise((resolve,reject)=>{requests.at(-1).options.signal.addEventListener('abort',()=>reject(Error('deadline')));}));
 const stalled=context.window.__productMetricsRefreshLeads();timeoutCallback();assert.equal(await stalled,null);assert.equal(vm.runInContext('leadLoading',context),false);assert(cleared>0);
 responses.push(reply(snapshot('2026-11-27','2026-11-28T01:00:00Z')));assert(await context.window.__productMetricsRefreshLeads(),'a failed request can be retried');
 assert(html.includes('await window.__productMetricsRefreshLeads()'),'general refresh awaits the cleaned product source, separately from raw activity');
 assert(html.includes('updated.coverageEnd<window.SalesAnalytics.shift(window.SalesAnalytics.today(),-1)'),'stale source cannot produce an unqualified successful update');
 console.log(JSON.stringify({passed:true,checks:['fresh snapshot in existing session','coalesced requests','no-cache','old/invalid/network responses preserve last data','bounded timeout and retry after failure','general refresh waits for product leads','outdated coverage reports partial refresh']}));
})().catch(e=>{console.error(e);process.exitCode=1;});
