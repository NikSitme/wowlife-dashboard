(function(root){
  'use strict';
  var FIELDS=['params','pmode','packaging','packagingVersion','packagingLinked','rowParams','mode','usageMode','certificateType','ov','sov','customSets','customServices','serviceSnapshots'];
  var STORE='wowlife-pricing-v1', CONNECTION='wowlife-pricing-project-v1';
  function clone(x){return JSON.parse(JSON.stringify(x));}
  function clean(x){
    if(Array.isArray(x))return x.map(clean);
    if(x&&typeof x==='object'){var o={};Object.keys(x).forEach(function(k){if(!['__proto__','prototype','constructor'].includes(k))o[k]=clean(x[k]);});return o;}
    return x;
  }
  function shared(s){var o={};FIELDS.forEach(function(k){if(s[k]!==undefined)o[k]=clean(clone(s[k]));});
    ['ov','sov','customServices','serviceSnapshots','rowParams','pmode'].forEach(function(k){if(!o[k]||Array.isArray(o[k])||typeof o[k]!=='object')o[k]={};});
    if(!Array.isArray(o.customSets))o.customSets=[];
    o.certificateType=o.certificateType==='electronic'?'electronic':'physical';return o;}
  function stable(x){if(x===undefined)return 'undefined';if(Array.isArray(x))return '['+x.map(stable).join(',')+']';if(x&&typeof x==='object')return '{'+Object.keys(x).sort().map(function(k){return JSON.stringify(k)+':'+stable(x[k]);}).join(',')+'}';return JSON.stringify(x);}
  function equal(a,b){return stable(a)===stable(b);}
  function valuable(s){return !!((s.customSets||[]).length||Object.keys(s.ov||{}).length||Object.keys(s.sov||{}).length||Object.keys(s.customServices||{}).length);}
  function validate(s){
    if(!s||typeof s!=='object'||Array.isArray(s))throw Error('В файле нет проекта');
    var data=shared(s),seen=new Set();
    data.customSets.forEach(function(x){if(!x||typeof x.id!=='string'||['__proto__','prototype','constructor'].includes(x.id)||seen.has(x.id)||!Array.isArray(x.items)||typeof x.name!=='string')throw Error('Повреждён состав наборов');seen.add(x.id);});
    if(JSON.stringify(data).length>1500000)throw Error('Проект слишком большой для одной копии');return data;
  }
  // Three-way merging combines different sets/fields. The same field edited twice is a conflict.
  function merge(base,local,remote){
    var conflicts=[];
    function walk(b,l,r,path){
      if(equal(l,r))return l;if(equal(l,b))return r;if(equal(r,b))return l;
      if(path==='customSets'&&[b,l,r].every(Array.isArray)){
        var maps=[b,l,r].map(function(xs){var m={};xs.forEach(function(x){m[x.id]=x;});return m;});
        var ids=Array.from(new Set(l.concat(r).concat(b).map(function(x){return x.id;})));
        return ids.map(function(id){return walk(maps[0][id],maps[1][id],maps[2][id],path+'.'+id);}).filter(function(x){return x!==undefined;});
      }
      if([b,l,r].every(function(x){return x&&typeof x==='object'&&!Array.isArray(x);})){
        var o={};Array.from(new Set(Object.keys(b).concat(Object.keys(l),Object.keys(r)))).forEach(function(k){var v=walk(b[k],l[k],r[k],path?path+'.'+k:k);if(v!==undefined)o[k]=v;});return o;
      }
      conflicts.push(path);return l;
    }
    return {state:clean(walk(base,local,remote,'')),conflicts:conflicts};
  }
  function parseLink(raw){
    try{var u=new URL(raw,root.location&&root.location.href||'https://niksitme.github.io/wowlife-dashboard/');var p=new URLSearchParams(u.hash.slice(1)),id=p.get('pricing-project'),key=p.get('key');
      if(!/^[0-9a-f-]{36}$/i.test(id||'')||!/^[A-Za-z0-9_-]{43}$/.test(key||''))return null;return {id:id,key:key};}catch(e){return null;}
  }
  function link(c,base){var u=new URL(base);if(c.public){u.hash='';u.searchParams.set('tab','pricing');return u.href;}u.hash=new URLSearchParams({'pricing-project':c.id,key:c.key}).toString();return u.href;}
  function connection(config,url,saved){
    var explicit=parseLink(url),id=config&&config.defaultProjectId;
    if(id&&(!explicit||explicit.id===id))return {id:id,public:true};
    return explicit||(saved&&saved.id&&saved.key?{id:saved.id,key:saved.key}:null);
  }
  function uuid(){if(root.crypto&&root.crypto.randomUUID)return root.crypto.randomUUID();throw Error('Для сохранения нужен защищённый адрес HTTPS');}
  function rpc(config,fetcher){return async function(name,args){
    var ctrl=typeof AbortController!=='undefined'?new AbortController():null,timer=ctrl?setTimeout(function(){ctrl.abort();},15000):null;
    try{var r=await fetcher(config.url+'/rest/v1/rpc/pricing_project_'+name,{method:'POST',headers:{apikey:config.anonKey,'Content-Type':'application/json'},body:JSON.stringify(args),signal:ctrl&&ctrl.signal});
      if(!r.ok)throw Error(r.status===401||r.status===403?'Нет доступа: проверьте закрытую ссылку':'Общее хранилище недоступно ('+r.status+')');return await r.json();
    }finally{if(timer)clearTimeout(timer);}
  };}
  function Journal(storage,indexedDB){this.storage=storage;this.indexedDB=indexedDB;this.db=null;this.last='';}
  Journal.prototype.open=function(){var self=this;if(self.db)return self.db;if(!self.indexedDB)return Promise.resolve(null);
    self.db=new Promise(function(resolve){try{var req=self.indexedDB.open('wowlife-pricing-backups',1);req.onupgradeneeded=function(){req.result.createObjectStore('snapshots',{keyPath:'id'});};req.onsuccess=function(){resolve(req.result);};req.onerror=function(){resolve(null);};req.onblocked=function(){resolve(null);};}catch(e){resolve(null);}});return self.db;};
  Journal.prototype.local=function(state){var raw=JSON.stringify(state),storage=this.storage;try{storage.setItem(STORE,raw);if(storage.getItem(STORE)!==raw)throw Error('Storage verification');return true;}catch(e){
    // These are downloaded caches only. Never evict user edits, connection keys or other apps.
    try{var remove=[];for(var i=0;i<storage.length;i++){var k=storage.key(i);if(/^wowlife-pricing-(crm-|act-)/.test(k)||k==='wowlife-dashboard-cache-v1')remove.push(k);}remove.forEach(function(k){storage.removeItem(k);});storage.setItem(STORE,raw);return storage.getItem(STORE)===raw;}catch(ignore){return false;}
  }};
  Journal.prototype.backup=async function(state,reason){var db=await this.open();if(!db)return false;
    return new Promise(function(resolve){try{var tx=db.transaction('snapshots','readwrite'),id=reason==='edit'?'edit-'+Math.floor(Date.now()/1500):Date.now()+'-'+uuid();tx.objectStore('snapshots').put({id:id,savedAt:new Date().toISOString(),reason:reason||'edit',state:clean(clone(state))});tx.oncomplete=function(){resolve(true);};tx.onerror=tx.onabort=function(){resolve(false);};}catch(e){resolve(false);}});
  };
  Journal.prototype.list=async function(){var db=await this.open();if(!db)return [];return new Promise(function(resolve){var req=db.transaction('snapshots').objectStore('snapshots').getAll();req.onsuccess=function(){resolve(req.result.sort(function(a,b){return b.savedAt.localeCompare(a.savedAt);}));};req.onerror=function(){resolve([]);};});};
  function Controller(opts){this.get=opts.get;this.apply=opts.apply;this.status=opts.status||function(){};this.call=opts.call;this.journal=opts.journal;this.storage=opts.storage;this.confirm=opts.confirm||function(){return false;};this.editing=opts.editing||function(){return false;};this.conn=null;this.base=null;this.dirty=false;this.paused=false;this.busy=false;this.seq=0;this.timer=null;this.retry=null;this.pending=null;this.lastLocal='';this.startState=shared(this.get());}
  Controller.prototype.notify=function(kind,message){this.status({kind:kind,message:message,project:this.base,connected:!!this.conn,dirty:this.dirty});};
  Controller.prototype.record=function(){
    var self=this,snapshot=clean(clone(self.get())),now=shared(snapshot),sig=stable(now),ok=self.journal.local(snapshot);
    if(sig!==self.lastLocal){self.lastLocal=sig;self.seq++;self.journal.backup(snapshot,'edit').then(function(saved){if(!ok&&!saved)self.notify('error','Не удалось сохранить на устройстве. Скачайте резервную копию.');else if(!self.conn)self.notify('local',saved?'Резервная копия сохранена на устройстве. Общий проект не подключён.':'Сохранено в браузере. Подключите общий проект.');});}
    if(self.conn&&self.base&&!equal(now,self.base.state)){self.dirty=true;if(!self.paused)self.notify('pending','Есть изменения — сохраняю в общий проект…');clearTimeout(self.timer);self.timer=setTimeout(function(){self.flush();},900);}
    else if(!self.conn&&ok)self.notify('local','Сохранено на устройстве. Общий проект не подключён.');return ok;
  };
  Controller.prototype.args=function(){return {p_id:this.conn.id,p_key:this.conn.key||null};};
  Controller.prototype.adopt=function(project){this.base=project;this.base.state=shared(project.state||{});this.apply(clone(this.base.state));this.lastLocal=stable(this.base.state);this.journal.local(this.get());};
  Controller.prototype.connect=async function(conn){
    if(this.busy)throw Error('Подождите окончания сохранения');
    var openingState=this.conn?shared(this.get()):this.startState;
    var project=await this.call('read',{p_id:conn.id,p_key:conn.key||null});project.state=shared(project.state||{});
    var saved=null;try{saved=JSON.parse(this.storage.getItem(CONNECTION)||'null');}catch(e){}
    var same=!!(saved&&saved.id===conn.id&&(conn.public||saved.key===conn.key)),base=same&&saved.base?shared(saved.base):null,mergeResult;
    var backedUp=await this.journal.backup(this.get(),'before-open');
    var local=shared(this.get());
    if(conn.public&&!base&&valuable(openingState)&&!equal(openingState,project.state)&&!backedUp)throw Error('Не удалось сохранить прежние локальные правки. Скачайте копию перед открытием общего проекта.');
    if(base){mergeResult=merge(base,local,project.state);}
    else if(conn.public){
      // Unlinked legacy drafts remain in the device backup. Only edits made during this opening
      // can merge into the shared project; visiting must never publish stale local drafts.
      mergeResult=merge(openingState,local,project.state);
    }
    else if(valuable(local)&&!equal(local,project.state)){
      if(!valuable(project.state))mergeResult={state:local,conflicts:[]};
      else{if(!this.confirm('В браузере есть свои правки. Объединить их с общим проектом? Если один набор изменён по-разному, потребуется выбрать версию. Резервная копия уже сохранена.'))throw Error('Открытие отменено. Локальные правки сохранены.');mergeResult=merge(shared({}),local,project.state);}
    }else mergeResult={state:project.state,conflicts:[]};
    this.conn=conn;this.base=project;this.paused=false;this.retry=null;
    if(mergeResult.conflicts.length){this.paused=true;this.dirty=true;this.persistBase();this.notify('conflict','Есть разные изменения одних полей. Ваши правки сохранены локально; выберите версию.');return;}
    this.apply(clone(mergeResult.state));var applied=shared(this.get());this.lastLocal=stable(applied);this.journal.local(this.get());this.dirty=!equal(applied,project.state);this.persistBase();
    if(this.dirty){this.notify('pending','Переношу сохранённые правки в общий проект…');await this.flush();}else this.savedStatus();
  };
  Controller.prototype.persistBase=function(){try{this.storage.setItem(CONNECTION,JSON.stringify({id:this.conn.id,key:this.conn.key,public:!!this.conn.public,base:this.base.state,revision:this.base.revision}));}catch(e){this.notify('error','Ссылка проекта не сохранилась в браузере. Скопируйте её для следующего входа.');}};
  Controller.prototype.savedStatus=function(){this.notify('saved','Сохранено в общем проекте · версия '+this.base.revision+' · '+new Date(this.base.updatedAt).toLocaleString('ru-RU')+' · наборов '+this.base.state.customSets.length+' · новых услуг '+Object.keys(this.base.state.customServices).length);};
  Controller.prototype.flush=async function(allowEmpty){
    if(!this.conn||!this.base||!this.dirty||this.paused||this.busy)return;
    clearTimeout(this.timer);this.busy=true;
    try{
      var attempts=0;
      while(this.dirty&&!this.paused&&attempts++<5){
        var sent=shared(this.get()),seq=this.seq,args=this.args();
        if(!this.retry||!equal(this.retry.state,sent)||this.retry.revision!==this.base.revision)this.retry={state:sent,revision:this.base.revision,id:uuid()};
        Object.assign(args,{p_revision:this.retry.revision,p_state:sent,p_mutation:this.retry.id,p_allow_empty:!!allowEmpty});
        this.notify('pending','Сохраняю в общий проект…');
        var result=await this.call('save',args),project=result.project;project.state=shared(project.state||{});
        if(result.status==='empty_guard'){
          this.paused=true;this.notify('empty','Пустая версия не заменила сохранённые наборы. Подтвердите очистку или откройте общую версию.');break;
        }
        if(result.status==='conflict'){
          await this.journal.backup(this.get(),'before-merge');
          var combined=merge(this.base.state,shared(this.get()),project.state);
          this.base=project;this.retry=null;
          if(combined.conflicts.length){this.paused=true;this.notify('conflict','Одни поля изменены одновременно. Обе версии сохранены; выберите, как продолжить.');break;}
          this.apply(combined.state);this.journal.local(this.get());this.lastLocal=stable(combined.state);this.persistBase();continue;
        }
        if(result.status!=='saved')throw Error('Не получено подтверждение сохранения');
        this.base=project;this.retry=null;this.persistBase();this.dirty=this.seq!==seq||!equal(shared(this.get()),project.state);
        if(!this.dirty)this.savedStatus();
      }
      if(this.dirty&&!this.paused){var self=this;this.timer=setTimeout(function(){self.flush();},1000);}
    }catch(e){this.notify('error','Общий проект не обновлён: '+(e.name==='AbortError'?'нет ответа сервера':e.message)+'. Правки остаются на устройстве; нажмите «Повторить».');}
    finally{this.busy=false;}
  };
  Controller.prototype.poll=async function(){
    if(!this.conn||!this.base||this.busy||this.paused||this.dirty||this.editing())return;
    this.busy=true;var seq=this.seq;
    try{var p=await this.call('read',this.args());if(p.revision!==this.base.revision&&seq===this.seq&&!this.dirty&&!this.editing()){
      await this.journal.backup(this.get(),'before-remote');if(seq!==this.seq||this.dirty||this.editing())return;
      this.adopt(p);this.persistBase();this.savedStatus();
    }else if(p.revision===this.base.revision&&seq===this.seq&&!this.dirty)this.savedStatus();}catch(e){this.notify('error','Не удалось проверить общую версию. Доступна сохранённая копия на устройстве.');}finally{this.busy=false;}
  };
  Controller.prototype.useRemote=async function(){if(this.busy)return;var seq=this.seq,p=await this.call('read',this.args());await this.journal.backup(this.get(),'before-choose-remote');if(seq!==this.seq)throw Error('Появились новые правки. Общая версия не открыта; повторите выбор после сохранения.');this.adopt(p);this.dirty=false;this.paused=false;this.retry=null;this.persistBase();this.savedStatus();};
  Controller.prototype.confirmEmpty=async function(){this.paused=false;this.dirty=true;await this.flush(true);};
  var api={FIELDS:FIELDS,STORE:STORE,CONNECTION:CONNECTION,shared:shared,valuable:valuable,validate:validate,stable:stable,equal:equal,merge:merge,parseLink:parseLink,link:link,connection:connection,rpc:rpc,Journal:Journal,Controller:Controller};
  if(typeof module==='object'&&module.exports)module.exports=api;else root.WowlifePricingProjects=api;
})(typeof window==='object'?window:globalThis);
