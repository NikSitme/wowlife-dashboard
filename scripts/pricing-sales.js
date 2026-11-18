(function(root,factory){var api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.WowlifePricingSales=api;})(typeof window==='undefined'?globalThis:window,function(){
  'use strict';
  function period(data){return data.start.split('-').reverse().join('.')+'–'+data.end.split('-').reverse().join('.');}
  function validate(data){
    if(!data||data.schemaVersion!==1||!/^\d{4}-\d{2}-01$/.test(data.start)||!/^\d{4}-\d{2}-\d{2}$/.test(data.end)||data.start>data.end)throw Error('Неверный период продаж');
    ['services','sets'].forEach(function(k){if(!data[k]||typeof data[k]!=='object'||Array.isArray(data[k]))throw Error('Нет счётчиков '+k);Object.keys(data[k]).forEach(function(id){if(!/^\d+$/.test(id)||!Number.isSafeInteger(data[k][id])||data[k][id]<0)throw Error('Неверное количество продаж');});});
    return data;
  }
  function info(data,row,activationPeriod){
    if(!data)return {count:null,reason:'Продажи ещё не загружены'};
    if(activationPeriod&&activationPeriod.replace(/\s/g,'')!==period(data))return {count:null,reason:'Период продаж отличается от периода активаций'};
    var kind=row.items?'sets':'services',id=String(row.sid||row.id||'');
    if(row.custom||!Object.prototype.hasOwnProperty.call(data[kind],id))return {count:null,reason:'Нет привязки к историческим продажам CRM'};
    return {count:data[kind][id],period:period(data),reason:'Проданные '+(kind==='sets'?'наборы':'отдельные услуги')+' · '+period(data)+' · все источники CRM · без возвратов. Снимок '+data.sourceAsOf};
  }
  return {validate:validate,period:period,info:info};
});
