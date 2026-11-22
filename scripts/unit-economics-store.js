(function(root,factory){var api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.WowlifeUnitCases=api;})(typeof window!=='undefined'?window:this,function(){
  'use strict';
  var PROJECT='2ad61b72-d95c-4e89-b56a-d9790012d583';
  function clone(x){return JSON.parse(JSON.stringify(x));}
  function Store(config,fetcher,storage){this.config=config;this.fetcher=fetcher;this.storage=storage;this.pending=null;try{this.pending=JSON.parse(storage.getItem('wowlife-unit-case-pending')||'null');}catch(ignored){}}
  Store.prototype.persist=function(){try{if(this.pending)this.storage.setItem('wowlife-unit-case-pending',JSON.stringify(this.pending));else this.storage.removeItem('wowlife-unit-case-pending');}catch(ignored){}};
  Store.prototype.call=async function(name,args){var ctrl=new AbortController(),timer=setTimeout(function(){ctrl.abort();},15000);try{var r=await this.fetcher(this.config.url+'/rest/v1/rpc/pricing_project_'+name,{method:'POST',headers:{apikey:this.config.anonKey,'Content-Type':'application/json'},body:JSON.stringify(Object.assign({p_id:PROJECT,p_key:null},args||{})),signal:ctrl.signal});if(!r.ok)throw Error('Общее хранилище недоступно ('+r.status+').');return await r.json();}finally{clearTimeout(timer);}};
  Store.prototype.list=async function(){var p=await this.call('read');return Object.values(p.state.unitCases||{}).sort(function(a,b){return b.createdAt.localeCompare(a.createdAt);});};
  Store.prototype.save=async function(name,base,current){
    name=name.trim();if(!name||name.length>160)throw Error('Название должно содержать от 1 до 160 символов.');
    var signature=JSON.stringify([name,base,current]);
    if(!this.pending||this.pending.signature!==signature)this.pending={signature:signature,record:{id:crypto.randomUUID(),name:name,createdAt:new Date().toISOString(),base:clone(base),current:clone(current)}};
    this.persist();var record=this.pending.record;
    for(var i=0;i<4;i++){
      var p=await this.call('read'),state=clone(p.state);if(state.unitCases&&state.unitCases[record.id]){this.pending=null;this.persist();return state.unitCases[record.id];}
      state.unitCases=state.unitCases||{};state.unitCases[record.id]=record;
      var saved=await this.call('save',{p_revision:p.revision,p_state:state,p_mutation:crypto.randomUUID(),p_allow_empty:false});
      if(saved.status==='saved'){if(!saved.project.state.unitCases||!saved.project.state.unitCases[record.id])throw Error('Сервер не подтвердил кейс.');this.pending=null;this.persist();return saved.project.state.unitCases[record.id];}
      if(saved.status!=='conflict')throw Error('Сохранение не подтверждено сервером.');
    }
    throw Error('Другой посетитель сохраняет расчёт. Повторите сохранение.');
  };
  return {Store:Store,PROJECT:PROJECT};
});
