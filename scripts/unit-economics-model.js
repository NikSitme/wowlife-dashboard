(function(root,factory){var api=factory(typeof module==='object'&&module.exports?require('./profit-calculator-model.js'):root.WowlifeProfitCalculator);if(typeof module==='object'&&module.exports)module.exports=api;else root.WowlifeUnitEconomics=api;})(typeof window==='undefined'?globalThis:window,function(profitModel){
  'use strict';
  var costKeys=['packaging','vat','usn','bank','acquiring','partners','delivery','other'];
  function copy(v){return JSON.parse(JSON.stringify(v));}
  function calculate(input){
    var s=copy(input),issues={};
    ['users','conversion','frequency','avgPrice','acquisition','fixed'].forEach(function(k){s[k]=profitModel.parse(s[k]);if(!Number.isFinite(s[k])||s[k]<0)issues[k]='Введите число не меньше нуля.';});
    if(s.conversion>100)issues.conversion='Конверсия не может превышать 100%.';
    if(s.frequency<1)issues.frequency='На платящего приходится хотя бы один оплаченный заказ.';
    s.costs=s.costs||{};costKeys.forEach(function(k){s.costs[k]=profitModel.parse(s.costs[k]);if(!Number.isFinite(s.costs[k])||s.costs[k]<0)issues[k]='Доля расходов должна быть числом не меньше нуля.';});
    if(Object.keys(issues).length)return {valid:false,issues:issues};
    var buyers=s.users*s.conversion/100,payments=buyers*s.frequency,revenue=payments*s.avgPrice,cogs=costKeys.reduce(function(t,k){return t+s.costs[k];},0),margin=100-cogs;
    var result=profitModel.calculate({revenue:revenue,margin:margin,fixed:s.acquisition+s.fixed});
    if(!result.valid)return {valid:false,issues:{users:'Значения слишком велики для расчёта.'}};
    var grossProfit=result.contribution,profit=result.profit,ampPu=s.avgPrice*margin/100*s.frequency;
    var out={valid:true,input:s,users:s.users,conversion:s.conversion,frequency:s.frequency,avgPrice:s.avgPrice,acquisition:s.acquisition,fixed:s.fixed,buyers:buyers,payments:payments,revenue:revenue,cogs:cogs,margin:margin,cogsTotal:revenue*cogs/100,grossProfit:grossProfit,profitBeforeFixed:grossProfit-s.acquisition,profit:profit,profitPercent:revenue?profit/revenue*100:null,ampPu:ampPu,ampu:s.conversion/100*ampPu,cpu:s.users?s.acquisition/s.users:null,cac:buyers?s.acquisition/buyers:null,cpo:payments?s.acquisition/payments:null,roi:s.acquisition?(grossProfit-s.acquisition)/s.acquisition*100:null,breakEvenRevenue:margin>0?(s.acquisition+s.fixed)/(margin/100):null};
    if(Object.keys(out).some(function(k){return typeof out[k]==='number'&&!Number.isFinite(out[k]);}))return {valid:false,issues:{users:'Значения слишком велики для расчёта.'}};
    return out;
  }
  function edit(input,key,value){
    var n=profitModel.parse(value),s=copy(input),r=calculate(s);if(!r.valid)return {valid:false,issues:r.issues};
    if(!Number.isFinite(n))return {valid:false,issues:{[key]:'Введите число.'}};
    function fail(msg){return {valid:false,issues:{[key]:msg}};}
    if(costKeys.includes(key)){s.costs[key]=n;}
    else if(key==='buyers'){if(!s.users)return fail('Сначала задайте пользователей.');s.conversion=n/s.users*100;}
    else if(key==='payments'){if(!r.buyers)return fail('Сначала задайте платящих пользователей.');s.frequency=n/r.buyers;}
    else if(key==='revenue'){if(!r.payments)return fail('Сначала задайте оплаченные заказы.');s.avgPrice=n/r.payments;}
    else if(key==='margin'||key==='cogs'){
      var total=key==='margin'?100-n:n;if(total<0)return fail('COGS не может быть отрицательным.');
      costKeys.forEach(function(k){s.costs[k]=r.cogs?s.costs[k]*total/r.cogs:0;});if(!r.cogs)s.costs.other=total;
    }
    else if(key==='profit'){
      if(r.margin<=0||!r.payments)return fail('Для цели прибыли нужны заказы и положительная маржинальность.');
      var needed=(n+s.acquisition+s.fixed)/(r.margin/100);if(needed<0)return fail('Эта цель требует отрицательной выручки.');s.avgPrice=needed/r.payments;
    }
    else if(key==='cac'){s.acquisition=n*r.buyers;}
    else if(key==='cpu'){s.acquisition=n*s.users;}
    else if(['users','conversion','frequency','avgPrice','acquisition','fixed'].includes(key)){s[key]=n;}
    else return fail('Неизвестный показатель.');
    var checked=calculate(s);return checked.valid?{valid:true,input:checked.input,result:checked}:checked;
  }
  function sensitivity(input){
    var base=calculate(input);if(!base.valid)return [];
    return [{key:'users',label:'Пользователи +10%',factor:1.1},{key:'conversion',label:'Конверсия +10%',factor:1.1},{key:'frequency',label:'Заказов на платящего +10%',factor:1.1},{key:'avgPrice',label:'Средний чек +10%',factor:1.1},{key:'cogs',label:'COGS −10%',factor:.9},{key:'acquisition',label:'Привлечение −10%',factor:.9},{key:'fixed',label:'Фиксы −10%',factor:.9}].map(function(x){var changed=edit(input,x.key,base[x.key]*x.factor);return {key:x.key,label:x.label,delta:changed.valid?changed.result.profit-base.profit:null};});
  }
  return {copy:copy,calculate:calculate,edit:edit,sensitivity:sensitivity,costKeys:costKeys};
});
