(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('./sales-analytics-model.js'));else root.ProductMetrics=factory(root.SalesAnalytics);})(typeof globalThis!=='undefined'?globalThis:this,function(sales){
  'use strict';
  function end(ym){return new Date(Date.UTC(+ym.slice(0,4),+ym.slice(5,7),0)).toISOString().slice(0,10);}
  function add(ym,n){return new Date(Date.UTC(+ym.slice(0,4),+ym.slice(5,7)-1+n,1)).toISOString().slice(0,7);}
  function fromRows(rows,through,generatedAt){
    if(!sales.isoDate(through))throw Error('Product metrics: invalid cutoff');
    var h=rows[0]||[],ci=h.indexOf('id контакта'),di=h.indexOf('id сделки'),si=h.indexOf('стадия'),ti=h.indexOf('дата оплаты');
    if(ci<0)throw Error('Product metrics: missing contact column');
    var contacts=new Map(),seen=new Set();
    rows.slice(1).forEach(function(r){if(!r)return;var id=String(r[di]||'').trim();if(!id||seen.has(id)||r[si]!=='Сделка успешна'||!sales.isoDate(r[ti]))return;seen.add(id);contacts.set(id,String(r[ci]||'').trim());});
    var all=sales.successful(rows).filter(function(r){return r.source==='Сайт'&&r.date<=through;}).sort(function(a,b){return a.date.localeCompare(b.date);});
    if(!all.length)throw Error('Product metrics: no website history');
    var first=new Map(),groups={};
    all.filter(sales.isPaidOrder).forEach(function(r){var contact=contacts.get(r.id),ym=r.date.slice(0,7);if(contact&&!first.has(contact))first.set(contact,ym);
      var g=groups[ym]||(groups[ym]={payments:0,cents:0,contacts:new Set(),newContacts:new Set(),missingContacts:0});
      g.payments++;g.cents+=Math.round(r.revenue*100);if(contact){g.contacts.add(contact);if(first.get(contact)===ym)g.newContacts.add(contact);}else g.missingContacts++;
    });
    var sourceStart=all[0].date,sourceEnd=all[all.length-1].date,months={};
    for(var ym=sourceStart.slice(0,7);ym<=sourceEnd.slice(0,7);ym=add(ym,1)){
      var g=groups[ym]||{payments:0,cents:0,contacts:new Set(),newContacts:new Set(),missingContacts:0},revenue=g.cents/100;
      months[ym]={from:ym===sourceStart.slice(0,7)?sourceStart:ym+'-01',to:ym===sourceEnd.slice(0,7)?sourceEnd:end(ym),buyers:g.contacts.size+g.missingContacts,knownBuyers:g.contacts.size,newBuyers:g.missingContacts?null:g.newContacts.size,missingContacts:g.missingContacts,payments:g.payments,revenue:revenue,avgPrice:g.payments?revenue/g.payments:null};
    }
    return {version:2,orderMetric:sales.ORDER_METRIC,scope:'website-direct',sourceStart:sourceStart,sourceEnd:sourceEnd,through:through,generated_at:generatedAt||new Date().toISOString(),months:months};
  }
  function valid(data){return !!data&&data.version===2&&data.orderMetric===sales.ORDER_METRIC&&data.scope==='website-direct'&&!!data.months&&sales.isoDate(data.sourceStart)&&sales.isoDate(data.sourceEnd);}
  function series(data,start,finish,report){
    if(!valid(data))return[];
    var points=[];for(var ym=start;ym<=finish;ym=add(ym,1)){var m=data.months[ym];if(m)points.push(Object.assign({month:ym,users:null,c1:null},m));}
    if(report&&report.version===1&&report.metric==='ym:s:users'&&report.step==='month'){
      var byRange=new Map((report.points||[]).map(function(p){return[p.from+'|'+p.to,p.users];}));
      points.forEach(function(p){var users=byRange.get(p.from+'|'+p.to);if(Number.isSafeInteger(users)&&users>=0){p.users=users;p.c1=users&&p.newBuyers!==null?p.newBuyers/users:null;}});
    }
    return points;
  }
  return {fromRows:fromRows,valid:valid,series:series,monthEnd:end,addMonths:add};
});
