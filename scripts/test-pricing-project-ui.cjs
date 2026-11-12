const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
globalThis.crypto ||= require('node:crypto').webcrypto;
const A=require('./pricing-project-store');
const configContext={window:{}};
vm.runInNewContext(fs.readFileSync(__dirname+'/pricing-project-config.js','utf8'),configContext);
const config=configContext.window.WOWLIFE_PROJECT_CONFIG;
const clone=x=>JSON.parse(JSON.stringify(x));
class Element{
 constructor(){this.handlers={};this.dataset={};this.hidden=false;this.textContent='';}
 addEventListener(k,fn){this.handlers[k]=fn;}
 querySelector(k){return this.nodes[k];}
 close(){} contains(){return false;}
}
class Storage{
 constructor(){this.m=new Map();}getItem(k){return this.m.get(k)||null;}setItem(k,v){this.m.set(k,v);}
}
let project={id:config.defaultProjectId,title:'Общий прайс — услуги и наборы',revision:1,updatedAt:new Date().toISOString(),state:A.shared({customSets:[{id:'shared',name:'Общий набор',items:['123']}],customServices:{}})};
function mount(){
 const nodes={},selectors=['prProjectBar','prProjectDialog','prProjectName','prProjectAudience','prProjectOpen','prProjectShare','prProjectHistory','prProjectRetry','prProjectRemote','prProjectEmpty','prProjectDownload','prProjectImport','prProjectFile','prProjectLocal','prProjectClose'];
 selectors.forEach(k=>nodes['#'+k]=new Element());
 nodes['#prProjectBar'].nodes={'[role="status"]':new Element()};nodes['#prProjectDialog'].nodes={'.pr-project-body':new Element(),'h2':new Element()};
 const root=new Element();root.nodes=nodes;let state=A.shared({}),online=true;const storage=new Storage();
 class Journal{local(s){storage.setItem(A.STORE,JSON.stringify(s));return true;}async backup(){return true;}async list(){return [];}}
 const api={...A,Journal},events={},intervals=[];
 const window={WowlifePricingProjects:api,WOWLIFE_PROJECT_CONFIG:config,localStorage:storage,location:{href:'https://niksitme.github.io/wowlife-dashboard/?tab=pricing'},confirm:()=>true,history:{replaceState(a,b,url){window.location.href=url;}},addEventListener(k,fn){events[k]=fn;},fetch:async(url,opts)=>{
   if(!online)throw Error('Offline');const args=JSON.parse(opts.body);assert.equal(args.p_id,config.defaultProjectId);assert.equal(args.p_key,null);
   const action=url.split('_').at(-1);let result;
   if(action==='read')result=clone(project);
   else if(action==='save'){if(args.p_revision!==project.revision)result={status:'conflict',project:clone(project)};else{project={...project,revision:project.revision+1,state:clone(args.p_state)};result={status:'saved',project:clone(project)};}}
   else throw Error('Unexpected action');return {ok:true,json:async()=>result};
 }};
 const context={window,document:{activeElement:null,addEventListener(){}},setInterval(fn){intervals.push(fn);return 1;},clearInterval(){},setTimeout,clearTimeout,URL,Blob,navigator:{clipboard:{writeText:async()=>{}}}};
 vm.runInNewContext(fs.readFileSync(__dirname+'/pricing-project-ui.js','utf8'),context);
 const ctrl=api.mount({root,get:()=>state,apply:s=>state=clone(s)});
 return {ctrl,nodes,intervals,events,window,get:()=>state,offline:()=>online=false,online:()=>online=true};
}
(async()=>{
 const a=mount(),b=mount();await a.ctrl.ready;await b.ctrl.ready;
 for(const x of [a,b]){assert.equal(x.get().customSets[0].name,'Общий набор');assert.equal(x.nodes['#prProjectOpen'].hidden,true);assert.equal(x.nodes['#prProjectAudience'].hidden,false);assert(!x.window.location.href.includes('key='));assert.equal(x.nodes['#prProjectBar'].dataset.status,'saved');}
 a.get().customServices.new={id:'new',name:'Новая общая услуга',price:2500};a.ctrl.record();await a.ctrl.flush();await b.intervals[0]();assert.equal(b.get().customServices.new.name,'Новая общая услуга');
 const offline=mount();offline.offline();await offline.ctrl.ready;assert.equal(offline.nodes['#prProjectBar'].dataset.status,'error');
 offline.online();await offline.nodes['#prProjectRetry'].handlers.click();assert.equal(offline.nodes['#prProjectBar'].dataset.status,'saved');assert.equal(offline.get().customServices.new.price,2500);
 b.offline();await b.intervals[0]();assert.equal(b.nodes['#prProjectBar'].dataset.status,'error');b.online();await b.events.online();assert.equal(b.nodes['#prProjectBar'].dataset.status,'saved');
 console.log('PASS UI ordinary URL auto-connects, no private-link prompt, two isolated visitors see sets/services, initial retry and poll recovery');
})().catch(e=>{console.error(e);process.exitCode=1;});
