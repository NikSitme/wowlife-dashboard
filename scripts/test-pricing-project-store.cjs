const assert=require('node:assert/strict');
globalThis.crypto ||= require('node:crypto').webcrypto;
const A=require('./pricing-project-store');
const clone=x=>JSON.parse(JSON.stringify(x));
const key='k'.repeat(43),id='51ea7765-8e15-469a-8f50-6693a66ecda6';
const set=(id,name=id)=>({id,name,city:'Мск',price:1000,items:['123','456']});
const model=sets=>A.shared({params:{act:60,pack:244},pmode:{pack:'rub'},mode:'max',usageMode:'custom',customSets:sets,customServices:{},ov:{},sov:{},rowParams:{}});
class MemoryStorage{constructor(){this.data=new Map();}get length(){return this.data.size;}key(i){return [...this.data.keys()][i];}getItem(k){return this.data.get(k)||null;}setItem(k,v){this.data.set(k,String(v));}removeItem(k){this.data.delete(k);}}
function fixture(initial,isPublic=false){
 let project={id,title:'Тестовый проект',revision:1,state:clone(initial||model([])),updatedAt:new Date().toISOString()},versions=[clone(project)],calls=[];
 async function call(action,args){calls.push({action,args:clone(args)});if(args.p_id!==id||(!isPublic&&args.p_key!==key))throw Error('No access');if(action==='read')return clone(project);
  if(action==='save'){
   if(project.mutation===args.p_mutation)return {status:'saved',project:clone(project)};
   if(project.revision!==args.p_revision)return {status:'conflict',project:clone(project)};
   if(project.state.customSets.length&&!args.p_state.customSets.length&&!args.p_allow_empty)return {status:'empty_guard',project:clone(project)};
   if(!A.equal(project.state,args.p_state)){project={...project,state:clone(args.p_state),revision:project.revision+1,mutation:args.p_mutation,updatedAt:new Date().toISOString()};versions.push(clone(project));}
   return {status:'saved',project:clone(project)};
  }throw Error('Unknown action');
 }
 return {call,calls,project:()=>clone(project),versions};
}
function client(server,initial,storage=new MemoryStorage()){
 let state=clone(initial||model([])),messages=[],backups=[],editing=false;
 const journal={local(s){storage.setItem(A.STORE,JSON.stringify(s));return true;},async backup(s,reason){backups.push({state:clone(s),reason});return true;}};
 const ctrl=new A.Controller({get:()=>state,apply:s=>{state={...state,...clone(s)};},call:server.call,storage,journal,status:s=>messages.push(s),confirm:()=>true,editing:()=>editing});
 return {ctrl,storage,messages,backups,get:()=>state,set:s=>{state=s;},edit:v=>{editing=v;}};
}
(async()=>{
 const state=model([set('one')]);assert(!('city' in A.shared({...state,city:'СПб',view:'newsets',q:'secret'})));assert.equal(A.validate(state).customSets[0].items.length,2);
 assert.throws(()=>A.validate({...state,customSets:[set('x'),set('x')]}));
 const polluted=JSON.parse('{"ov":{"__proto__":{"polluted":true}},"customSets":[]}');assert.equal(A.shared(polluted).ov.polluted,undefined);assert.equal({}.polluted,undefined);
 const url=A.link({id,key},'https://niksitme.github.io/wowlife-dashboard/');assert.deepEqual(A.parseLink(url),{id,key});assert(!A.parseLink('https://other.test/?pricing-project='+id+'&key='+key));assert(!A.parseLink(url.replace(key,'short')));
 let b=model([set('a')]),l=clone(b),r=clone(b);l.customSets[0].name='Local';r.customSets.push(set('b'));
 let m=A.merge(b,l,r);assert.equal(m.conflicts.length,0);assert.equal(m.state.customSets.length,2);assert.equal(m.state.customSets[0].name,'Local');
 r=clone(b);r.customSets[0].name='Remote';m=A.merge(b,l,r);assert(m.conflicts.includes('customSets.a.name'));
 l=clone(b);l.customSets=[];m=A.merge(b,l,r);assert(m.conflicts.length);m=A.merge(b,l,b);assert.equal(m.state.customSets.length,0);
 const cache=new MemoryStorage();cache.setItem('wowlife-pricing-crm-v1','large');cache.setItem('wowlife-finmodel-v2','USER');cache.setItem(A.STORE,'old-user-data');
 const nativeSet=cache.setItem.bind(cache);cache.setItem=(k,v)=>{if(cache.getItem('wowlife-pricing-crm-v1'))throw Error('QuotaExceededError');nativeSet(k,v);};
 const journal=new A.Journal(cache,null);assert(journal.local(state));assert.equal(cache.getItem('wowlife-finmodel-v2'),'USER');assert.deepEqual(JSON.parse(cache.getItem(A.STORE)),state);
 cache.setItem=()=>{throw Error('Blocked');};assert.equal(journal.local(model([])),false);assert.deepEqual(JSON.parse(cache.getItem(A.STORE)),state);
 console.log('PASS schema, private fragment links, safe cache eviction, legacy state preservation, three-way merge and conflict detection');
 const server=fixture(model([])),a=client(server,state);await a.ctrl.connect({id,key});assert.equal(server.project().state.customSets.length,1);assert(a.messages.some(x=>x.kind==='saved'));
 const c=client(server);await c.ctrl.connect({id,key});assert.equal(c.get().customSets[0].name,'one');assert.deepEqual(c.get().customSets[0].items,['123','456']);
 a.get().customSets[0].name='Новый общий набор';a.ctrl.record();await a.ctrl.flush();await c.ctrl.poll();assert.equal(c.get().customSets[0].name,'Новый общий набор');
 // A second computer and a reload use the server, not a common browser profile.
 const reload=client(server,JSON.parse(a.storage.getItem(A.STORE)),a.storage);await reload.ctrl.connect({id,key});assert.equal(reload.get().customSets[0].name,'Новый общий набор');
 console.log('PASS legacy draft migration, server confirmation, second computer, composition and reload');
 a.get().customSets.push(set('second','Второй'));a.ctrl.record();c.get().customSets.push(set('third','Третий'));c.ctrl.record();await a.ctrl.flush();await c.ctrl.flush();assert.equal(server.project().state.customSets.length,3);assert.equal(c.ctrl.paused,false);
 await a.ctrl.poll();a.get().customSets[0].price=1111;a.ctrl.record();c.get().customSets[0].price=2222;c.ctrl.record();await a.ctrl.flush();await c.ctrl.flush();assert(c.ctrl.paused);assert.equal(server.project().state.customSets[0].price,1111);assert.equal(c.get().customSets[0].price,2222);assert(c.messages.some(x=>x.kind==='conflict'));assert(c.backups.some(x=>x.reason==='before-merge'));
 await c.ctrl.useRemote();assert.equal(c.get().customSets[0].price,1111);assert.equal(c.ctrl.dirty,false);
 console.log('PASS concurrent changes merge; conflicting edits preserve both versions without last-writer overwrite');
 a.get().customSets[0].name='Фон';a.ctrl.record();await a.ctrl.flush();c.edit(true);await c.ctrl.poll();assert.notEqual(c.get().customSets[0].name,'Фон');c.edit(false);await c.ctrl.poll();assert.equal(c.get().customSets[0].name,'Фон');
 c.set(model([]));c.ctrl.record();await c.ctrl.flush();assert(c.ctrl.paused);assert.equal(server.project().state.customSets.length,3);assert(c.messages.some(x=>x.kind==='empty'));await c.ctrl.confirmEmpty();assert.equal(server.project().state.customSets.length,0);assert(server.versions.some(x=>x.state.customSets.length===3));
 console.log('PASS active input protection, empty overwrite guard and explicit reversible clear');
 const offline=fixture(state),d=client(offline);await d.ctrl.connect({id,key});d.get().customSets[0].name='Офлайн';d.ctrl.record();const good=d.ctrl.call;d.ctrl.call=async()=>{throw Error('Offline');};await d.ctrl.flush();assert(d.ctrl.dirty);assert.equal(d.get().customSets[0].name,'Офлайн');assert.equal(d.messages.at(-1).kind,'error');assert.equal(offline.project().state.customSets[0].name,'one');d.ctrl.call=good;await d.ctrl.flush();assert.equal(offline.project().state.customSets[0].name,'Офлайн');assert.equal(d.ctrl.dirty,false);
 // The request committed but its response was lost: retry uses the same mutation ID, no extra revision.
 d.get().customSets[0].name='Потерянный ответ';d.ctrl.record();let once=true;d.ctrl.call=async(action,args)=>{const result=await good(action,args);if(action==='save'&&once){once=false;throw Error('Response lost');}return result;};await d.ctrl.flush();const rev=offline.project().revision;await d.ctrl.flush();assert.equal(offline.project().revision,rev);assert.equal(d.ctrl.dirty,false);
 // UI sorting/searching is local and must not create server versions.
 const before=offline.project().revision;d.get().view='services';d.get().city='СПб';d.ctrl.record();await d.ctrl.flush();assert.equal(offline.project().revision,before);
 console.log('PASS offline recovery, no false success, idempotent uncertain commit and local-only filters');
 // Typing while the initial cloud read or an IndexedDB backup is pending must not be lost.
 const bootServer=fixture(model([])),boot=client(bootServer,model([]));let releaseRead;const bootCall=boot.ctrl.call;
 boot.ctrl.call=async(action,args)=>{if(action==='read')await new Promise(resolve=>{releaseRead=resolve;});return bootCall(action,args);};
 const opening=boot.ctrl.connect({id,key});boot.get().customSets.push(set('during-open'));boot.ctrl.record();releaseRead();await opening;assert.equal(bootServer.project().state.customSets[0].id,'during-open');
 const racing=fixture(model([set('r')])),ra=client(racing),rb=client(racing);await ra.ctrl.connect({id,key});await rb.ctrl.connect({id,key});
 ra.get().customSets.push(set('remote-new'));ra.ctrl.record();await ra.ctrl.flush();rb.get().customSets[0].name='Local while old';rb.ctrl.record();
 let releaseBackup,backupStarted;const started=new Promise(resolve=>{backupStarted=resolve;});const normalBackup=rb.ctrl.journal.backup;
 rb.ctrl.journal.backup=async(s,reason)=>{if(reason==='before-merge'){backupStarted();await new Promise(resolve=>{releaseBackup=resolve;});}return normalBackup(s,reason);};
 const flushing=rb.ctrl.flush();await started;rb.get().customSets.push(set('during-merge'));rb.ctrl.record();releaseBackup();await flushing;
 assert.deepEqual(new Set(racing.project().state.customSets.map(x=>x.id)),new Set(['r','remote-new','during-merge']));assert.equal(racing.project().state.customSets[0].name,'Local while old');
 console.log('PASS edits during cloud startup and asynchronous merge backup remain intact');
 // Public default: one server project, no access key in ordinary URLs or requests.
 const config={defaultProjectId:id},publicConn={id,public:true};
 assert.deepEqual(A.connection(config,'https://niksitme.github.io/wowlife-dashboard/',null),publicConn);
 assert.deepEqual(A.connection(config,url,{id,key}),publicConn);
 assert.equal(A.link(publicConn,url),'https://niksitme.github.io/wowlife-dashboard/?tab=pricing');
 const publicState=model([set('published')]);publicState.customServices.s1={id:'s1',name:'Общая услуга',price:1500};
 const pub=fixture(publicState,true),visitor=client(pub,model([set('old-local')]));
 await visitor.ctrl.connect(publicConn);
 assert.deepEqual(visitor.get(),publicState);assert.equal(pub.project().revision,1);
 assert(visitor.backups.some(x=>x.state.customSets[0]?.id==='old-local'));
 assert(pub.calls.every(x=>x.args.p_key===null));
 const visitor2=client(pub);await visitor2.ctrl.connect(publicConn);
 visitor.get().customSets.push(set('new-public'));visitor.ctrl.record();await visitor.ctrl.flush();
 visitor2.get().customServices.s2={id:'s2',name:'Создана другим посетителем',price:2000};visitor2.ctrl.record();await visitor2.ctrl.flush();
 await visitor.ctrl.poll();assert.equal(visitor.get().customSets.length,2);assert.equal(Object.keys(visitor.get().customServices).length,2);
 const visitorReload=client(pub,JSON.parse(visitor.storage.getItem(A.STORE)),visitor.storage);await visitorReload.ctrl.connect(publicConn);
 assert.deepEqual(visitorReload.get(),pub.project().state);
 // A known private connection upgrades without losing pending edits or retaining its key.
 const prior=client(pub);await prior.ctrl.connect({id,key});prior.get().customSets[0].name='Правка до перехода';prior.ctrl.record();clearTimeout(prior.ctrl.timer);
 const upgrade=client(pub,prior.get(),prior.storage);await upgrade.ctrl.connect(publicConn);
 assert.equal(pub.project().state.customSets[0].name,'Правка до перехода');assert.equal(JSON.parse(prior.storage.getItem(A.CONNECTION)).key,undefined);
 // Offline first load retries without silently dropping work created in this session.
 const later=client(pub,model([set('unlinked')])),goodCall=later.ctrl.call;
 later.ctrl.call=async()=>{throw Error('Offline');};await assert.rejects(later.ctrl.connect(publicConn));
 later.get().customSets.push(set('created-offline'));later.ctrl.record();later.ctrl.call=goodCall;await later.ctrl.connect(publicConn);
 assert(pub.project().state.customSets.some(x=>x.id==='created-offline'));assert(!pub.project().state.customSets.some(x=>x.id==='unlinked'));
 const cfgSource=require('node:fs').readFileSync(require('node:path').join(__dirname,'pricing-project-config.js'),'utf8');
 const cfgContext={window:{}};require('node:vm').runInNewContext(cfgSource,cfgContext);assert.equal(cfgContext.window.WOWLIFE_PROJECT_CONFIG.defaultProjectId,'0ff5bd23-e903-460c-8987-a76f30fff0ac');
 console.log('PASS public default, legacy backups, two visitors, services/sets sync, reload, private migration and offline-first edits');
 const html=require('node:fs').readFileSync(require('node:path').join(__dirname,'..','index.html'),'utf8');assert(html.includes('projectController.record()'));assert(html.includes('data-setname'));assert(!html.includes(' · сохранены в этом браузере'));assert(html.includes('prProjectHistory'));assert(html.includes('prProjectDownload'));
 console.log('PASS page integration and truthful save status');
})().catch(e=>{console.error(e);process.exitCode=1;});
