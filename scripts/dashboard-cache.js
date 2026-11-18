(function(root,factory){
  var api=factory(root);
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.DashboardCache=api;
})(typeof window==='object'?window:globalThis,function(root){
  'use strict';
  var FIELDS=['revenueTimeline','leadActivity','opiu','opiuTree','ops','salesact','sales','activations','partners','kreditorka','marketing','metrika','content'];
  var SMALL_FIELDS=['revenueTimeline','leadActivity','opiu','opiuTree','kreditorka','marketing','metrika','content'];
  var DB_NAME='wowlife-dashboard-cache-v2',STORE='sections',FALLBACK_KEY='wowlife-dashboard-cache-small-v2',LEGACY_KEY='wowlife-dashboard-cache-v1';
  function safeProperty(name){try{return root[name];}catch(error){return null;}}
  function errorText(error){return String(error&&error.message||error||'Хранилище недоступно');}
  function timestamp(value){return typeof value==='string'&&Number.isFinite(Date.parse(value))?value:null;}
  function rank(value){return value?Date.parse(value):0;}
  function record(key,value,savedAt){return {key:key,value:value,savedAt:timestamp(savedAt)};}
  function validRecord(value){return value&&FIELDS.indexOf(value.key)!==-1&&Object.prototype.hasOwnProperty.call(value,'value');}
  function indexedBackend(indexedDB,options){
    options=options||{};
    var opened=null;
    function open(){
      if(opened)return opened;
      opened=new Promise(function(resolve,reject){
        var request,settled=false,timer=setTimeout(function(){fail(new Error('Истекло время открытия кэша'));},options.openTimeout||2500);
        function fail(error){if(settled)return;settled=true;clearTimeout(timer);reject(error);}
        try{request=indexedDB.open(options.dbName||DB_NAME,1);}catch(error){fail(error);return;}
        request.onupgradeneeded=function(){var db=request.result;if(!db.objectStoreNames.contains(STORE))db.createObjectStore(STORE,{keyPath:'key'});};
        request.onerror=function(){fail(request.error||new Error('Не удалось открыть кэш'));};
        request.onblocked=function(){fail(new Error('Кэш занят другой вкладкой'));};
        request.onsuccess=function(){
          clearTimeout(timer);var db=request.result;if(settled){db.close();return;}settled=true;
          db.onversionchange=function(){db.close();opened=null;};
          resolve(db);
        };
      }).catch(function(error){opened=null;throw error;});
      return opened;
    }
    return {
      readAll:async function(keys){
        var db=await open();return new Promise(function(resolve,reject){
          var tx,requests;try{tx=db.transaction(STORE,'readonly');var store=tx.objectStore(STORE);requests=keys?keys.map(function(key){return store.get(key);}):[store.getAll()];}catch(error){reject(error);return;}
          tx.oncomplete=function(){resolve(keys?requests.map(function(r){return r.result;}).filter(Boolean):requests[0].result||[]);};
          tx.onerror=tx.onabort=function(){reject(tx.error||new Error('Не удалось прочитать кэш'));};
        });
      },
      write:async function(records){
        var db=await open();return new Promise(function(resolve,reject){
          var tx;try{tx=db.transaction(STORE,'readwrite');records.forEach(function(value){tx.objectStore(STORE).put(value);});}catch(error){if(tx)try{tx.abort();}catch(ignored){}reject(error);return;}
          // A successful individual put is not a durable commit: wait for the transaction.
          tx.oncomplete=function(){resolve();};
          tx.onerror=tx.onabort=function(){reject(tx.error||new Error('Не удалось сохранить кэш'));};
        });
      }
    };
  }
  function create(options){
    options=options||{};
    var storage=Object.prototype.hasOwnProperty.call(options,'storage')?options.storage:safeProperty('localStorage');
    var idb=Object.prototype.hasOwnProperty.call(options,'indexedDB')?options.indexedDB:safeProperty('indexedDB');
    var backend=Object.prototype.hasOwnProperty.call(options,'backend')?options.backend:idb?indexedBackend(idb,options):null;
    var legacyKey=options.legacyKey||LEGACY_KEY,fallbackKey=options.fallbackKey||FALLBACK_KEY,maxBytes=options.maxFallbackBytes||1048576;
    var now=options.now||function(){return new Date().toISOString();};
    var memory=new Map(),confirmed=new Map(),chain=Promise.resolve(),lastResult={ok:true,storage:null,savedKeys:[],skippedKeys:[],error:null};
    function serialize(fn){var result=chain.then(fn,fn);chain=result.catch(function(){});return result;}
    function merge(target,records){
      records.forEach(function(value){
        if(!validRecord(value))return;
        var next=record(value.key,value.value,value.savedAt),old=target.get(next.key);
        if(!old||rank(next.savedAt)>=rank(old.savedAt))target.set(next.key,next);
      });return target;
    }
    function readJson(key){
      if(!storage)return null;
      try{var raw=storage.getItem(key);return raw?JSON.parse(raw):null;}catch(error){return null;}
    }
    function fallbackRecords(){
      var envelope=readJson(fallbackKey);return envelope&&envelope.version===1&&Array.isArray(envelope.records)?envelope.records.filter(validRecord):[];
    }
    function legacyRecords(){
      var old=readJson(legacyKey);if(!old||typeof old!=='object'||Array.isArray(old))return [];
      return FIELDS.filter(function(key){return Object.prototype.hasOwnProperty.call(old,key)&&old[key]!==undefined;}).map(function(key){return record(key,old[key],old.sectionSavedAt&&old.sectionSavedAt[key]||old.savedAt);});
    }
    function cacheObject(records){
      var out={sectionSavedAt:{}},latest=null;
      records.forEach(function(value,key){out[key]=value.value;out.sectionSavedAt[key]=value.savedAt;if(rank(value.savedAt)>rank(latest))latest=value.savedAt;});
      out.savedAt=latest;return out;
    }
    function remove(key){if(storage)try{storage.removeItem(key);}catch(ignored){}}
    function fallbackSave(records){
      var existing=merge(new Map(),fallbackRecords()),saved=[],skipped=[];
      records.forEach(function(value){
        if(SMALL_FIELDS.indexOf(value.key)===-1){skipped.push(value.key);return;}
        var candidate=new Map(existing);candidate.set(value.key,value);
        try{
          var text=JSON.stringify({version:1,records:Array.from(candidate.values())});
          if(text.length*2>maxBytes){skipped.push(value.key);return;}
          existing=candidate;saved.push(value.key);
        }catch(error){skipped.push(value.key);}
      });
      if(!saved.length)return {ok:false,storage:'memory',savedKeys:[],skippedKeys:records.map(function(r){return r.key;}),error:'Нет доступного места для кэша'};
      try{
        if(!storage)throw new Error('Хранилище браузера недоступно');
        storage.setItem(fallbackKey,JSON.stringify({version:1,records:Array.from(existing.values())}));
        return {ok:!skipped.length,storage:'localStorage',savedKeys:saved,skippedKeys:skipped,error:skipped.length?'Большие разделы не сохранены в резервном кэше':null};
      }catch(error){return {ok:false,storage:'memory',savedKeys:[],skippedKeys:records.map(function(r){return r.key;}),error:errorText(error)};}
    }
    async function load(keys){
      if(keys!==undefined&&(!Array.isArray(keys)||keys.some(function(key){return FIELDS.indexOf(key)===-1;})))throw new TypeError('Invalid dashboard cache keys');
      if(keys)keys=Array.from(new Set(keys));
      return serialize(async function(){
        var records=[],backendError=null;
        if(backend)try{records=await backend.readAll(keys);merge(confirmed,records);}catch(error){backendError=error;}
        var disk=merge(new Map(),records),small=fallbackRecords(),legacy=legacyRecords();
        function selected(value){return !keys||keys.indexOf(value.key)!==-1;}
        var combined=merge(merge(merge(new Map(),small.filter(selected)),legacy.filter(selected)),records);
        merge(combined,Array.from(memory.values()).filter(selected));merge(memory,Array.from(combined.values()));
        var migrate=Array.from(combined.values()).filter(function(value){var old=disk.get(value.key);return !old||rank(value.savedAt)>rank(old.savedAt);});
        if(backend&&!backendError&&migrate.length){
          try{await backend.write(migrate);merge(confirmed,migrate);lastResult={ok:true,storage:'indexedDB',savedKeys:migrate.map(function(r){return r.key;}),skippedKeys:[],error:null};}
          catch(error){lastResult={ok:false,storage:'memory',savedKeys:[],skippedKeys:migrate.map(function(r){return r.key;}),error:errorText(error)};}
        }else if(backendError)lastResult={ok:false,storage:small.length||legacy.length?'localStorage':'memory',savedKeys:[],skippedKeys:[],error:errorText(backendError)};
        else lastResult={ok:true,storage:backend?'indexedDB':small.length||legacy.length?'localStorage':'memory',savedKeys:[],skippedKeys:[],error:null};
        // Partial loads leave the rest of a legacy cache intact until those
        // sections have also been committed or found newer in IndexedDB.
        function copied(values){return values.length&&values.every(function(value){var saved=confirmed.get(value.key);return saved&&rank(saved.savedAt)>=rank(value.savedAt);});}
        if(backend&&!backendError){if(copied(legacy))remove(legacyKey);if(copied(small))remove(fallbackKey);}
        return combined.size?cacheObject(combined):null;
      });
    }
    async function save(partial){
      return serialize(async function(){
        if(!partial||typeof partial!=='object'||Array.isArray(partial))throw new TypeError('Invalid dashboard cache');
        var savedAt=timestamp(partial.savedAt)||timestamp(now());
        var records=FIELDS.filter(function(key){return Object.prototype.hasOwnProperty.call(partial,key)&&partial[key]!==undefined;}).map(function(key){return record(key,partial[key],partial.sectionSavedAt&&partial.sectionSavedAt[key]||savedAt);});
        merge(memory,records);
        if(!records.length){lastResult={ok:true,storage:backend?'indexedDB':'memory',savedKeys:[],skippedKeys:[],error:null};return lastResult;}
        var backendError=null;
        if(backend)try{await backend.write(records);merge(confirmed,records);lastResult={ok:true,storage:'indexedDB',savedKeys:records.map(function(r){return r.key;}),skippedKeys:[],error:null};return lastResult;}catch(error){backendError=error;}
        lastResult=fallbackSave(records);
        if(backendError)lastResult.warning=errorText(backendError);
        return lastResult;
      });
    }
    return {load:load,save:save,status:function(){return Object.assign({},lastResult,{savedKeys:lastResult.savedKeys.slice(),skippedKeys:lastResult.skippedKeys.slice()});}};
  }
  var api=create();api.create=create;api.fields=FIELDS.slice();api.indexedBackend=indexedBackend;return api;
});
