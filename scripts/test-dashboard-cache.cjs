const assert=require('node:assert/strict');
const Cache=require('./dashboard-cache');
const T1='2026-11-17T10:00:00.000Z',T2='2026-11-18T10:00:00.000Z';
const LEGACY='wowlife-dashboard-cache-v1',SMALL='wowlife-dashboard-cache-small-v2';
const clone=value=>structuredClone(value);
class Storage{
 constructor(){this.map=new Map();this.fail=false;}
 getItem(key){return this.map.get(key)||null;}
 setItem(key,value){if(this.fail)throw new Error('QuotaExceededError');this.map.set(key,value);}
 removeItem(key){this.map.delete(key);}
}
class Backend{
 constructor(){this.map=new Map();this.reads=[];this.writes=[];this.failRead=false;this.failWrite=false;}
 async readAll(keys){this.reads.push(keys&&keys.slice());if(this.failRead)throw new Error('IndexedDB unavailable');return clone(Array.from(this.map.values()).filter(r=>!keys||keys.includes(r.key)));}
 async write(records){this.writes.push(records.map(r=>r.key));const draft=new Map(this.map);records.forEach(r=>draft.set(r.key,clone(r)));if(this.failWrite)throw new Error('Transaction aborted');this.map=draft;}
}
function controlledIndexedDB(){
 const stored=new Map(),transactions=[],gets=[];
 const db={objectStoreNames:{contains:()=>true},close(){},transaction(name,mode){
  assert.equal(name,'sections');const pending=[],tx={mode,error:null,requests:[],objectStore(){return {put(value){pending.push(clone(value));},get(key){gets.push(key);const r={result:clone(stored.get(key))};tx.requests.push(r);return r;},getAll(){gets.push('*');const r={result:clone(Array.from(stored.values()))};tx.requests.push(r);return r;}};},commit(){pending.forEach(r=>stored.set(r.key,r));if(tx.oncomplete)tx.oncomplete();},abort(){tx.error=new Error('Native transaction aborted');if(tx.onabort)tx.onabort();}};
  transactions.push(tx);if(mode==='readonly')queueMicrotask(()=>tx.commit());return tx;
 }};
 return {stored,transactions,gets,open(){const request={result:db};queueMicrotask(()=>request.onsuccess());return request;}};
}
(async()=>{
 const storage=new Storage(),backend=new Backend(),cache=Cache.create({storage,backend,now:()=>T1});
 const first=await cache.save({opiu:[{month:'2026-10',revenue:100}],sales:{rows:[{revenue:40}]},savedAt:T1});
 assert.equal(first.ok,true);assert.equal(first.storage,'indexedDB');assert.equal(storage.map.size,0,'Large cache never serialized to localStorage');
 await cache.save({opiu:[{month:'2026-10',revenue:110}],savedAt:T2});
 const loaded=await Cache.create({storage,backend}).load();
 assert.equal(loaded.opiu[0].revenue,110);assert.equal(loaded.sales.rows[0].revenue,40);assert.equal(loaded.savedAt,T2);
 assert.equal(loaded.sectionSavedAt.opiu,T2);assert.equal(loaded.sectionSavedAt.sales,T1,'Partial refresh retains each unchanged section timestamp');
 const selective=await Cache.create({storage,backend}).load(['opiu']);
 assert.equal(selective.opiu[0].revenue,110);assert.equal(selective.sales,undefined);assert.deepEqual(backend.reads.at(-1),['opiu'],'Selective cache load asks IndexedDB only for requested sections');
 assert.equal(await Cache.create({storage,backend}).load([]),null);assert.deepEqual(backend.reads.at(-1),[]);
 await assert.rejects(()=>cache.load(['unknown']),/Invalid dashboard cache keys/);
 assert.equal((await cache.save({unexpected:100})).savedKeys.length,0,'Unknown fields cannot become persistent records');

 backend.failWrite=true;
 const failed=await cache.save({sales:{rows:[{revenue:999}]},activations:{rows:[{cost:88}]},savedAt:T2});
 assert.equal(failed.ok,false);assert.equal(failed.storage,'memory');assert.deepEqual(failed.skippedKeys,['sales','activations']);
 backend.failWrite=false;
 const durable=await Cache.create({storage,backend}).load(['sales','activations']);
 assert.equal(durable.sales.rows[0].revenue,40);assert.equal(durable.activations,undefined,'An aborted multi-section transaction changes none of its durable records');

 const legacyStorage=new Storage(),legacyBackend=new Backend();
 legacyStorage.setItem(LEGACY,JSON.stringify({opiu:[{revenue:12}],sales:{rows:[{revenue:13}]},savedAt:T1}));
 const migrating=Cache.create({storage:legacyStorage,backend:legacyBackend});
 const migratedCore=await migrating.load(['opiu']);
 assert.equal(migratedCore.opiu[0].revenue,12);assert.equal(migratedCore.sales,undefined);assert(legacyStorage.getItem(LEGACY),'Partial migration retains not-yet-read sections');
 assert.deepEqual(legacyBackend.writes,[['opiu']]);
 const migratedSales=await migrating.load(['sales']);assert.equal(migratedSales.sales.rows[0].revenue,13);assert.equal(legacyStorage.getItem(LEGACY),null,'Legacy cache removed only after all its sections are durable');
 assert.equal(legacyBackend.map.size,2);

 const abortStorage=new Storage(),abortBackend=new Backend();abortBackend.failWrite=true;
 abortStorage.setItem(LEGACY,JSON.stringify({opiu:[{revenue:14}],savedAt:T1}));
 const abortMigration=Cache.create({storage:abortStorage,backend:abortBackend});assert.equal((await abortMigration.load()).opiu[0].revenue,14);
 assert(abortStorage.getItem(LEGACY));assert.equal(abortMigration.status().ok,false);assert.equal(abortBackend.map.size,0);
 abortBackend.failWrite=false;await abortMigration.load();assert.equal(abortStorage.getItem(LEGACY),null,'Failed migration can retry safely');

 const newerStorage=new Storage(),newerBackend=new Backend();
 newerStorage.setItem(LEGACY,JSON.stringify({opiu:[{revenue:1}],savedAt:T1}));await newerBackend.write([{key:'opiu',value:[{revenue:2}],savedAt:T2}]);
 const newer=await Cache.create({storage:newerStorage,backend:newerBackend}).load(['opiu']);
 assert.equal(newer.opiu[0].revenue,2);assert.equal(newerStorage.getItem(LEGACY),null,'Old legacy data cannot replace a newer durable section');

 const fallbackStorage=new Storage(),fallback=Cache.create({storage:fallbackStorage,backend:null,now:()=>T1});
 const partial=await fallback.save({opiu:[{revenue:25}],sales:{rows:[{revenue:26}]}});
 assert.equal(partial.ok,false);assert.equal(partial.storage,'localStorage');assert.deepEqual(partial.savedKeys,['opiu']);assert.deepEqual(partial.skippedKeys,['sales']);
 assert.equal(fallbackStorage.getItem(LEGACY),null,'Fallback uses its own cache key, not settings or legacy key');
 const fallbackReload=Cache.create({storage:fallbackStorage,backend:null});
 assert.equal((await fallbackReload.load(['opiu'])).opiu[0].revenue,25);assert.equal(await fallbackReload.load(['sales']),null,'Unsaved large data is not reported as durable on reload');
 assert.equal(JSON.parse(fallbackStorage.getItem(SMALL)).records[0].savedAt,T1);

 const limitedStorage=new Storage(),limited=Cache.create({storage:limitedStorage,backend:null,maxFallbackBytes:400,now:()=>T1});
 assert.equal((await limited.save({metrika:{n:1}})).ok,true);const oldSmall=limitedStorage.getItem(SMALL);
 const tooLarge=await limited.save({metrika:{data:'x'.repeat(1000)},savedAt:T2});
 assert.equal(tooLarge.ok,false);assert.equal(limitedStorage.getItem(SMALL),oldSmall,'Oversized writes preserve the previous fallback and its timestamp');
 limitedStorage.fail=true;assert.equal((await limited.save({content:{n:2},savedAt:T2})).ok,false);assert.equal(limitedStorage.getItem(SMALL),oldSmall,'Quota failure preserves old fallback');
 assert.equal((await Cache.create({storage:limitedStorage,backend:null}).load()).savedAt,T1,'No new cache timestamp is invented after failed persistence');
 const noStorage=Cache.create({storage:null,backend:null});assert.equal((await noStorage.save({opiu:[]})).ok,false);assert.equal(noStorage.status().storage,'memory');

 const blockedBackend=new Backend();blockedBackend.failRead=true;
 const fallbackLoad=Cache.create({storage:fallbackStorage,backend:blockedBackend});
 assert.equal((await fallbackLoad.load(['opiu'])).opiu[0].revenue,25);assert.equal(fallbackLoad.status().ok,false);assert.match(fallbackLoad.status().error,/unavailable/);

 let release;const wait=new Promise(resolve=>release=resolve),orderedBackend=new Backend(),write=orderedBackend.write.bind(orderedBackend);
 orderedBackend.write=async records=>{await wait;return write(records);};
 const ordered=Cache.create({storage:null,backend:orderedBackend,now:()=>T2});
 const save=ordered.save({opiu:[{revenue:99}]});const read=ordered.load(['opiu']);release();await save;
 assert.equal((await read).opiu[0].revenue,99,'Load waits for a preceding save instead of racing stale disk data');

 const idb=controlledIndexedDB(),native=Cache.indexedBackend(idb,{});let finished=false;
 const nativeSave=native.write([{key:'opiu',value:[{revenue:42}],savedAt:T2}]).then(()=>finished=true);
 for(let turn=0;turn<4;turn++)await Promise.resolve();
 assert.equal(finished,false);assert.equal(idb.stored.size,0,'Individual puts do not count as durable before transaction completion');
 idb.transactions.at(-1).commit();await nativeSave;assert.equal(finished,true);
 assert.equal((await native.readAll(['opiu']))[0].value[0].revenue,42);assert.deepEqual(idb.gets,['opiu'],'Native selective read uses get(key), not getAll');
 const nativeFailure=native.write([{key:'opiu',value:[{revenue:100}],savedAt:T2}]);
 for(let turn=0;turn<4;turn++)await Promise.resolve();idb.transactions.at(-1).abort();
 await assert.rejects(nativeFailure,/aborted/);assert.equal(idb.stored.get('opiu').value[0].revenue,42,'Aborted native transaction retains the previous record');
 console.log('PASS cache: per-section atomic writes/timestamps, selective IndexedDB reads, partial/failed migration, legacy freshness, bounded fallback, quota preservation, truthful status and operation ordering');
 console.log('PASS native IndexedDB adapter: waits for transaction completion, selective get and abort preserves previous data');
})().catch(error=>{console.error(error);process.exitCode=1;});
