(function(root,factory){var api=factory(typeof module==='object'&&module.exports?require('./unit-economics-model.js'):root.WowlifeUnitEconomics);if(typeof module==='object'&&module.exports)module.exports=api;else root.WowlifeUnitPeriods=api;})(typeof window==='undefined'?globalThis:window,function(M){
  'use strict';
  function validMonth(s){return /^\d{4}-(0[1-9]|1[0-2])$/.test(s||'');}
  function next(s){var d=new Date(s+'-01T00:00:00Z');d.setUTCMonth(d.getUTCMonth()+1);return d.toISOString().slice(0,7);}
  function months(data){if(!data||data.version!==1||!Array.isArray(data.months))return [];return data.months.filter(function(p){return validMonth(p.month)&&M.calculate(p.input).valid;}).sort(function(a,b){return a.month.localeCompare(b.month);});}
  function options(data,kind,year){var rows=months(data).filter(function(p){return p.month.slice(0,4)===String(year);}),groups={};rows.forEach(function(p){var key=kind==='year'?String(year):kind==='quarter'?String(year)+'-Q'+Math.ceil(Number(p.month.slice(5))/3):p.month;(groups[key]||(groups[key]=[])).push(p);});return Object.keys(groups).sort().map(function(key){var a=groups[key],q=kind==='quarter'?Number(key.slice(-1)):null;return {id:key,from:a[0].month,to:a[a.length-1].month,count:a.length,partial:kind==='year'?a.length!==12:kind==='quarter'?a.length!==3:false,label:kind==='year'?String(year):kind==='quarter'?q+' квартал '+year:a[0].label};});}
  function build(data,from,to,audience){
    if(!validMonth(from)||!validMonth(to)||from>to)return {valid:false,error:'Выберите корректный диапазон месяцев.'};
    var rows=months(data),chosen=rows.filter(function(p){return p.month>=from&&p.month<=to;}),expected=from;
    for(var p of chosen){if(p.month!==expected)return {valid:false,error:'В диапазоне есть месяцы без расчёта в юнитке.'};expected=next(expected);}
    if(!chosen.length||expected!==next(to))return {valid:false,error:'В диапазоне есть месяцы без расчёта в юнитке.'};
    if(chosen.length===1)return {valid:true,input:M.copy(chosen[0].input),from:from,to:to,count:1};
    var totals={users:0,buyers:0,payments:0,revenue:0,acquisition:0,fixed:0},costs={};M.costKeys.forEach(function(k){costs[k]=0;});
    chosen.forEach(function(p){var r=M.calculate(p.input);Object.keys(totals).forEach(function(k){totals[k]+=r[k];});M.costKeys.forEach(function(k){costs[k]+=r.revenue*p.input.costs[k]/100;});});
    var customers=data.ranges&&data.ranges[from+'|'+to];
    if(!Number.isSafeInteger(audience)||audience<=0||!customers||!Number.isSafeInteger(customers.buyers)||customers.buyers<=0)return {valid:false,needsAudience:true,error:'Нет уникальной аудитории за выбранный диапазон.'};
    totals.users=audience;totals.buyers=customers.buyers;
    if(totals.buyers>totals.payments||totals.buyers>totals.users)return {valid:false,error:'Аудитория не согласована с заказами периода.'};
    var input={users:totals.users,conversion:totals.buyers/totals.users*100,frequency:totals.payments/totals.buyers,avgPrice:totals.revenue/totals.payments,acquisition:totals.acquisition,fixed:totals.fixed,costs:{}};
    M.costKeys.forEach(function(k){input.costs[k]=costs[k]/totals.revenue*100;});
    return {valid:true,input:input,from:from,to:to,count:chosen.length};
  }
  return {months:months,options:options,build:build};
});
