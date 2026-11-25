(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('./sales-analytics-model.js'),require('./revenue-dynamics.js'));else root.ProductMetrics=factory(root.SalesAnalytics,root.RevenueDynamics);})(typeof globalThis!=='undefined'?globalThis:this,function(sales,revenue){
  'use strict';
  function end(ym){return new Date(Date.UTC(+ym.slice(0,4),+ym.slice(5,7),0)).toISOString().slice(0,10);}
  function add(ym,n){return new Date(Date.UTC(+ym.slice(0,4),+ym.slice(5,7)-1+n,1)).toISOString().slice(0,7);}
  function websiteHistory(rows,through){
    var h=rows[0]||[],ci=h.indexOf('id контакта'),di=h.indexOf('id сделки'),si=h.indexOf('стадия'),ti=h.indexOf('дата оплаты');
    if(ci<0)throw Error('Product metrics: missing contact column');
    var contacts=new Map(),seen=new Set();
    rows.slice(1).forEach(function(r){if(!r)return;var id=String(r[di]||'').trim();if(!id||seen.has(id)||r[si]!=='Сделка успешна'||!sales.isoDate(r[ti]))return;seen.add(id);contacts.set(id,String(r[ci]||'').trim());});
    return sales.successful(rows).filter(function(r){return r.source==='Сайт'&&r.date<=through;}).map(function(r){return Object.assign({contact:contacts.get(r.id)},r);}).sort(function(a,b){return a.date.localeCompare(b.date);});
  }
  function rangeStats(rows,from,to){
    if(!sales.isoDate(from)||!sales.isoDate(to)||from>to)throw Error('Product metrics: invalid range');
    var paid=websiteHistory(rows,to).filter(function(r){return r.date>=from&&sales.isPaidOrder(r);}),buyers=new Set(),cents=0;
    paid.forEach(function(r){buyers.add(r.contact?'contact:'+r.contact:'order:'+r.id);cents+=Math.round(r.revenue*100);});
    return {buyers:buyers.size,payments:paid.length,revenue:cents/100};
  }
  function fromRows(rows,through,generatedAt){
    if(!sales.isoDate(through))throw Error('Product metrics: invalid cutoff');
    var all=websiteHistory(rows,through);
    if(!all.length)throw Error('Product metrics: no website history');
    var first=new Map(),groups={},daily={};
    all.filter(sales.isPaidOrder).forEach(function(r){var contact=r.contact,ym=r.date.slice(0,7);if(contact&&!first.has(contact))first.set(contact,r.date);
      var g=groups[ym]||(groups[ym]={payments:0,cents:0,contacts:new Set(),newContacts:new Set(),missingContacts:0});
      g.payments++;g.cents+=Math.round(r.revenue*100);if(contact){g.contacts.add(contact);if(first.get(contact).slice(0,7)===ym)g.newContacts.add(contact);}else g.missingContacts++;
      var day=daily[r.date]||(daily[r.date]={payments:0,cents:0,contacts:new Set(),newContacts:new Set(),missingContacts:0});
      day.payments++;day.cents+=Math.round(r.revenue*100);if(contact){day.contacts.add(contact);if(first.get(contact)===r.date)day.newContacts.add(contact);}else day.missingContacts++;
    });
    var sourceStart=all[0].date,sourceEnd=all[all.length-1].date,months={};
    for(var ym=sourceStart.slice(0,7);ym<=sourceEnd.slice(0,7);ym=add(ym,1)){
      var g=groups[ym]||{payments:0,cents:0,contacts:new Set(),newContacts:new Set(),missingContacts:0},revenue=g.cents/100;
      months[ym]={from:ym===sourceStart.slice(0,7)?sourceStart:ym+'-01',to:ym===sourceEnd.slice(0,7)?sourceEnd:end(ym),buyers:g.contacts.size+g.missingContacts,knownBuyers:g.contacts.size,newBuyers:g.newContacts.size+g.missingContacts,knownNewBuyers:g.newContacts.size,missingContacts:g.missingContacts,payments:g.payments,revenue:revenue,avgPrice:g.payments?revenue/g.payments:null};
    }
    var days={};
    for(var date=sourceStart;date<=sourceEnd;date=sales.shift(date,1)){
      var g=daily[date]||{payments:0,cents:0,contacts:new Set(),newContacts:new Set(),missingContacts:0},revenue=g.cents/100;
      days[date]={from:date,to:date,buyers:g.contacts.size+g.missingContacts,knownBuyers:g.contacts.size,newBuyers:g.newContacts.size+g.missingContacts,knownNewBuyers:g.newContacts.size,missingContacts:g.missingContacts,payments:g.payments,revenue:revenue,avgPrice:g.payments?revenue/g.payments:null};
    }
    return {version:4,days:days,orderMetric:sales.ORDER_METRIC,scope:'website-direct',sourceStart:sourceStart,sourceEnd:sourceEnd,through:through,generated_at:generatedAt||new Date().toISOString(),months:months};
  }
  function valid(data){return !!data&&(data.version===3||data.version===4)&&data.orderMetric===sales.ORDER_METRIC&&data.scope==='website-direct'&&!!data.months&&sales.isoDate(data.sourceStart)&&sales.isoDate(data.sourceEnd);}
  // Same Adesk site series as the finance chart; never substitute CRM money.
  function withAdeskRevenue(points,timeline){
    return points.map(function(p){
      var keys=['siteMsk','siteSpb'],covered=timeline&&timeline.version===1&&timeline.days&&timeline.coverage&&keys.every(function(k){var c=timeline.coverage[k];return c&&c.from<=p.from&&c.to>=p.to;});
      var amount=null;
      if(covered){var values=revenue.series(timeline,{from:p.from,to:p.to,step:'month',sources:['site'],city:'all'});amount=values.length===1?values[0].current:null;}
      return Object.assign({},p,{revenue:amount,revenueSource:'adesk-site'});
    });
  }
  function withConversions(point){
    function ratio(n){return Number.isFinite(point.users)&&point.users>0&&Number.isFinite(n)&&n>=0?n/point.users:null;}
    return Object.assign({},point,{leadConversion:ratio(point.leads),payingConversion:ratio(point.buyers)});
  }
  function series(data,start,finish,report){
    if(!valid(data))return[];
    var points=[];for(var ym=start;ym<=finish;ym=add(ym,1)){var m=data.months[ym];if(m)points.push(Object.assign({month:ym,users:null,c1:null},m));}
    if(report&&report.version===1&&report.metric==='ym:s:users'&&report.step==='month'){
      var byRange=new Map((report.points||[]).map(function(p){return[p.from+'|'+p.to,p.users];}));
      points.forEach(function(p){var users=byRange.get(p.from+'|'+p.to);if(Number.isSafeInteger(users)&&users>=0){p.users=users;p.c1=users&&p.newBuyers!==null?p.newBuyers/users:null;}});
    }
    return points;
  }
  function dailySeries(data,ym,report){
    if(!valid(data)||!data.days||!/^\d{4}-(0[1-9]|1[0-2])$/.test(ym)||!data.months[ym])return[];
    var m=data.months[ym],byRange=new Map();
    if(report&&report.version===1&&report.metric==='ym:s:users'&&report.step==='day')
      (report.points||[]).forEach(function(p){if(p.from===p.to&&Number.isSafeInteger(p.users)&&p.users>=0)byRange.set(p.from+'|'+p.to,p.users);});
    var points=[];for(var d=m.from;d<=m.to;d=sales.shift(d,1)){
      var day=data.days[d];if(!day)return[];
      var users=byRange.has(d+'|'+d)?byRange.get(d+'|'+d):null;
      points.push(Object.assign({month:ym,date:d,users:users,c1:users>0?day.newBuyers/users:null},day));
    }
    return points;
  }
  return {withAdeskRevenue:withAdeskRevenue,withConversions:withConversions,rangeStats:rangeStats,dailySeries:dailySeries,fromRows:fromRows,valid:valid,series:series,monthEnd:end,addMonths:add};
});
