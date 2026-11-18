const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const model=require('./sales-analytics-model');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const scripts=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]);

function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};}
async function bounded(promise){let timer;try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Test did not reach the expected event')),1500);})]);}finally{clearTimeout(timer);}}
class Element{
 constructor(){this.hidden=false;this.disabled=false;this.attrs={};this.children=[];this.handlers={};this._text='';}
 set textContent(value){this._text=value;this.children=[];}
 get textContent(){return this._text;}
 setAttribute(key,value){this.attrs[key]=value;}
 getAttribute(key){return this.attrs[key]??null;}
 removeAttribute(key){delete this.attrs[key];}
 addEventListener(key,fn){this.handlers[key]=fn;}
 appendChild(child){this.children.push(child);return child;}
 insertBefore(child,before){this.children.splice(this.children.indexOf(before),0,child);}
 click(){if(!this.disabled)return this.handlers.click?.();}
}
function snapshot(key,label='file'){
 return {schemaVersion:2,rows:[{date:'2026-11-01',item:label,revenue:10,count:1}],dates:['2026-11-01'],...(key==='sales'?{salesMetric:model.SALES_METRIC}:{activationMetric:model.ACTIVATION_METRIC})};
}
function response(value){return {ok:true,json:async()=>value,text:async()=>'header\nvalue'};}
function lazyHarness(options={}){
 const original=scripts.find(s=>s.includes('const DATASETS = {sales:null'));
 assert(original,'Lazy analytics entry point is present');
 const prefix=original.slice(0,original.indexOf('  function mountAnalytics(){'));
 const suffix=original.slice(original.indexOf('  window.__wowSalesRerender=openAnalytics;'));
 const mounted=[];
 const stub=`  function mountAnalytics(){ window.mountTest(DATASETS.sales);window.__wowSalesRerender=function(){window.renderTest();}; }\n  window.lazyTest={ensureDataset,openAnalytics,datasets:DATASETS};\n`;
 const panel=new Element(),body=new Element();panel.hidden=options.hidden!==false;panel.children=[body];panel.querySelector=()=>body;
 const tags={};
 for(const [key,id] of Object.entries({sales:'ws-dashboard-data',activations:'ws-dashboard-data-activations',partners:'ws-dashboard-data-partners'})){
  const tag=new Element();tag.attrs['data-src']='data/dashboard-'+key+'.json';tag.textContent='{}';tags[id]=tag;
 }
 const calls=[],cacheReads=[];let renders=0;
 const window={SalesAnalytics:model,DashboardRuntime:{activate(){}},mountTest:value=>mounted.push(value),renderTest:()=>renders++,DashboardCache:{load:async keys=>{cacheReads.push(Array.from(keys));return options.cache?options.cache(keys):null;}}};
 const context={window,document:{querySelector:()=>panel,createElement:()=>new Element(),getElementById:id=>tags[id]},AbortController,setTimeout,clearTimeout,fetch:async url=>{calls.push(url);return options.fetch?options.fetch(url):response(snapshot(url.includes('activations')?'activations':url.includes('partners')?'partners':'sales'));}};
 vm.runInNewContext(prefix+stub+suffix,context);
 return {window,panel,body,calls,cacheReads,mounted,get renders(){return renders;},get status(){return panel.children[0];}};
}

async function testLazyAnalytics(){
 const hidden=lazyHarness();assert.equal(hidden.calls.length,0);assert.equal(hidden.cacheReads.length,0);assert.equal(hidden.mounted.length,0);assert.equal(hidden.body.hidden,true);
 hidden.panel.hidden=false;await bounded(hidden.window.__wowSalesRerender());
 assert.deepEqual(hidden.calls,['data/dashboard-sales.json'],'Opening sales does not load activation/partner snapshots');
 assert.equal(hidden.mounted.length,1);assert.equal(hidden.body.hidden,false);assert.equal(hidden.status.hidden,true);
 hidden.window.__wowSalesRerender();hidden.window.__wowSalesRerender();assert.equal(hidden.mounted.length,1);assert.equal(hidden.calls.length,1);

 const started=deferred(),file=deferred();const dedupe=lazyHarness({fetch:url=>{if(url.includes('partners'))return response(snapshot('partners'));started.resolve();return file.promise;}});
 const first=dedupe.window.lazyTest.ensureDataset('sales'),second=dedupe.window.lazyTest.ensureDataset('sales');
 await bounded(started.promise);assert.equal(dedupe.calls.length,1);file.resolve(response(snapshot('sales')));await bounded(Promise.all([first,second]));
 assert.equal(dedupe.cacheReads.length,1,'Concurrent consumers share both cache lookup and file download');
 await dedupe.window.lazyTest.ensureDataset('partners');assert.equal(dedupe.calls.length,2,'Another dataset is fetched only when explicitly requested');

 const fileStarted=deferred(),slowFile=deferred(),fresh=snapshot('sales','fresh live update');
 const race=lazyHarness({fetch:()=>{fileStarted.resolve();return slowFile.promise;}});
 const loading=race.window.lazyTest.ensureDataset('sales');await bounded(fileStarted.promise);
 race.window.__wowSalesSetData(fresh,snapshot('activations'),snapshot('partners'));
 slowFile.resolve(response(snapshot('sales','older file')));
 assert.equal(await bounded(loading),fresh,'A late file response cannot overwrite a newer live setter');
 assert.equal(race.window.lazyTest.datasets.sales,fresh);

 const cacheStarted=deferred(),slowCache=deferred();
 const cacheRace=lazyHarness({cache:()=>{cacheStarted.resolve();return slowCache.promise;}});
 const cachedLoading=cacheRace.window.lazyTest.ensureDataset('sales');await bounded(cacheStarted.promise);
 cacheRace.window.__wowSalesSetData(fresh,snapshot('activations'),snapshot('partners'));
 slowCache.resolve({sales:snapshot('sales','older cache')});
 assert.equal(await bounded(cachedLoading),fresh);assert.equal(cacheRace.calls.length,0,'Fresh data also wins over a late cache read');

 for(const failure of [response({schemaVersion:2,rows:[],dates:[],salesMetric:'obsolete'}),{ok:false,status:503}]){
  let attempt=0;const failed=lazyHarness({fetch:async()=>++attempt===1?failure:response(snapshot('sales'))});
  failed.panel.hidden=false;await bounded(failed.window.__wowSalesRerender());
  assert.equal(failed.mounted.length,0);assert.equal(failed.body.hidden,true,'Unavailable data is not rendered as zero sales');
  assert.match(failed.status.textContent,/не загрузилась/);assert.equal(failed.status.children[0].textContent,'Повторить');
  await bounded(failed.status.children[0].click());assert.equal(failed.mounted.length,1);assert.equal(failed.body.hidden,false);assert.equal(failed.calls.length,2,'A failed request can be retried');
 }
 const cached=lazyHarness({cache:async()=>({sales:snapshot('sales','valid cache')})});cached.panel.hidden=false;await bounded(cached.window.__wowSalesRerender());assert.equal(cached.calls.length,0);assert.equal(cached.mounted[0].rows[0].item,'valid cache');
 console.log('PASS lazy analytics: no hidden loads, selected dataset only, in-flight deduplication, live/cache/file race protection, validated cache, failure/retry and one mount');
}

function updateHarness(options={}){
 let updater=scripts.find(s=>s.includes('var ADESK_SOURCE_ID'));
 updater=updater.replace('  if (document.readyState === "loading")',`  window.refreshTest=runUpdate;window.initTest=init;
  computeOpiu=function(){return [{source_version:2,label:'2026-11',revenue_total:100}];};computeOpiuTree=function(){return {tree:true};};parseOps=function(){return [['2026-11-01','Receipt',100]];};
  computeSalesAct=function(){return {backlog:{value:[1]}};};computeMarketing=function(){return {certificates:1,contacts:1,lastDate:'2026-11-18'};};
  computeWowsales=function(){return {sales:{rows:[{revenue:100}]},activations:{rows:[]},partners:{rows:[]}};};computeKreditorka=function(){return {totalUnpaid:1};};
  if (document.readyState === "loading")`);
 const operations=deferred(),marketing=deferred(),opiuShown=deferred(),dailyShown=deferred(),cacheStarted=deferred(),cache=deferred();
 const requests=[],writes=[],events=[],actions=new Element(),theme=new Element();
 const window={__opiuData:[],__opiuSetData(){events.push('opiu');opiuShown.resolve();},__opiuSetDaily(ops){events.push(ops?'daily':'tree');if(ops)dailyShown.resolve();},__salesActSetData(){events.push('salesact');},__marketingSetData(){events.push('marketing');},__wowSalesSetData(){events.push('wowsales');},__kreditorkaSetData(){events.push('kreditorka');},__leadActivitySetData(){return true;},__leadActivityError(){},__revenueDynamicsSetData(){events.push('revenue');},LeadActivity:{fromRows(){return {total:1,coverageEnd:'2026-11-18'};}},RevenueDynamics:{fromRows(){return {version:1};}},DashboardCache:{load(){cacheStarted.resolve();return cache.promise;},async save(value){writes.push(value);return {ok:true,storage:'indexedDB'};}}};
 const document={readyState:'loading',addEventListener(){},createElement:()=>new Element(),getElementById:id=>id==='themeSwitch'?theme:id==='dashboardActions'?actions:null};
 const deadlines=new Map();let timerId=0;
 function timer(fn,delay){if(delay>=25000){const id=++timerId;deadlines.set(id,fn);return id;}return setTimeout(fn,delay);}
 function clearTimer(id){if(deadlines.has(id))deadlines.delete(id);else clearTimeout(id);}
 const context={window,document,console,setTimeout:timer,clearTimeout:clearTimer,AbortController,fetch:async(url,init)=>{requests.push(url);const decoded=decodeURIComponent(url);if(decoded.includes('sheet=Операции'))return operations.promise;if(decoded.includes('sheet=Маркетинг'))return marketing.promise;
  if(options.hangingOptional&&/^data\/(metrika|content)\.json/.test(url)){
   const hang=()=>new Promise((_,reject)=>init.signal.addEventListener('abort',()=>reject(Error('Aborted')),{once:true}));
   return options.hangingOptional==='body'?{ok:true,json:hang}:hang();
  }
  return response(null);}};
 vm.runInNewContext(updater,context);
 return {window,operations,marketing,opiuShown,dailyShown,cacheStarted,cache,requests,writes,events,actions,expireDeadlines(){for(const fn of [...deadlines.values()])fn();},deadlines};
}
async function testIndependentUpdates(){
 const h=updateHarness(),button={disabled:false,textContent:'Обновить данные'},status={};
 const first=h.window.refreshTest(button,status),second=h.window.refreshTest(button,status);
 assert.equal(first,second,'Two requests share one update operation');
 await bounded(h.opiuShown.promise);
 assert.equal(h.requests.length,13,'Each source is downloaded once per update');
 assert.equal(button.disabled,true);assert(!h.events.includes('marketing'));assert(!h.events.includes('daily'));assert.equal(h.writes.length,0);
 h.operations.resolve(response(null));await bounded(h.dailyShown.promise);
 assert(!h.events.includes('marketing'),'Optional daily operations and monthly report do not wait for an unrelated marketing sheet');
 h.marketing.resolve(response(null));await bounded(first);
 assert.equal(button.disabled,false);assert.equal(button.textContent,'Обновить данные');assert.equal(h.writes.length,1);assert.match(status.textContent,/Обновлено/);assert(h.events.includes('marketing'));
 const next=h.window.refreshTest(button,status);assert.notEqual(next,first);await bounded(next);assert.equal(h.requests.length,26,'A completed update allows an intentional new refresh');

 const init=updateHarness(),initializing=init.window.initTest();await bounded(init.cacheStarted.promise);
 const initialButton=init.actions.children[0].children[0];assert.equal(initialButton.disabled,true,'Startup disables the refresh button before awaiting IndexedDB');
 initialButton.click();assert.equal(init.requests.length,0,'A disabled startup button cannot begin a concurrent refresh');
 init.cache.resolve(null);await bounded(initializing);await bounded(init.opiuShown.promise);
 assert.equal(init.requests.length,13);const running=init.window.refreshTest(initialButton,init.actions.children[0].children[1]);
 init.operations.resolve(response(null));init.marketing.resolve(response(null));await bounded(running);assert.equal(init.requests.length,13);
 console.log('PASS update coordination: one in-flight refresh, early monthly OПиУ, independent optional/unrelated sources, intentional next refresh and disabled button during cache startup');
}

async function testOptionalDeadlines(){
 for(const phase of ['fetch','body']){
  const h=updateHarness({hangingOptional:phase}),button={disabled:false,textContent:'Обновить данные'},status={};
  const update=h.window.refreshTest(button,status);await bounded(h.opiuShown.promise);
  h.operations.resolve(response(null));h.marketing.resolve(response(null));await bounded(h.dailyShown.promise);
  assert.equal(button.disabled,true);assert.equal(h.writes.length,0,'A pending optional response keeps final persistence pending until its deadline');
  assert.equal(h.deadlines.size,2,'Both optional deadlines cover fetch and response body');
  h.expireDeadlines();await bounded(update);
  assert.equal(h.writes.length,1,'Optional timeout must not prevent saving successful sections');
  assert.equal(button.disabled,false);assert.match(status.textContent,/Обновлено/);assert.equal(h.deadlines.size,0);
  const next=h.window.refreshTest(button,status);assert.notEqual(next,update,'Timeout releases the single-flight operation');
  await bounded(h.dailyShown.promise);await Promise.resolve();h.expireDeadlines();await bounded(next);
  assert.equal(h.requests.length,26);assert.equal(h.writes.length,2);assert.equal(button.disabled,false);
 }
 console.log('PASS optional deadlines: stalled fetch/body abort quietly, successful sections persist, button unlocks and another refresh completes');
}

(async()=>{await testLazyAnalytics();await testIndependentUpdates();await testOptionalDeadlines();})().catch(error=>{console.error(error);process.exitCode=1;});
