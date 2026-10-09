(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.SalesAnalytics=factory();})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  var CITIES=['Москва','Санкт-Петербург','Не определён'];
  var SOURCES=['Сайт','Ozon','Wildberries','Яндекс Маркет','Flowwow','B2B'];
  var ACTUAL_STAGES=['Сделка успешна','Погашен','Себес | отдел активаций','Ждем сверку','Ожидает оплаты'];
  function number(s){var n=Number(String(s==null?'':s).replace(/\s/g,'').replace(',','.'));return Number.isFinite(n)?n:0;}
  function iso(s){s=String(s||'').trim();var m=s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/),value;
    if(m)value=m[1]+'-'+m[2].padStart(2,'0')+'-'+m[3].padStart(2,'0');
    else if((m=s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})/)))value=m[3]+'-'+m[2].padStart(2,'0')+'-'+m[1].padStart(2,'0');
    if(!value)return null;var d=new Date(value+'T00:00:00Z');return Number.isFinite(+d)&&d.toISOString().slice(0,10)===value?value:null;}
  function today(now){return new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Moscow',year:'numeric',month:'2-digit',day:'2-digit'}).format(now||new Date());}
  function city(value){var v=String(value||'').trim().toLowerCase();if(/^(москва|мск)$/.test(v))return CITIES[0];if(/^(санкт[- ]петербург|петербург|спб)$/.test(v))return CITIES[1];return CITIES[2];}
  function source(value){var v=String(value||'').trim().toLowerCase();if(v==='ozon'||v==='озон')return 'Ozon';if(v==='wildberries'||v==='вб')return 'Wildberries';if(v==='ям'||v==='яндекс маркет'||v==='яндекс.маркет')return 'Яндекс Маркет';if(/^flowwow/.test(v))return 'Flowwow';if(v==='b2b')return 'B2B';return 'Сайт';}
  function date(s){return new Date(s+'T00:00:00Z');}
  function shift(s,n){var d=date(s);d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);}
  function shiftMonths(s,n){var d=date(s),day=d.getUTCDate();d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()+n);var end=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate();d.setUTCDate(Math.min(day,end));return d.toISOString().slice(0,10);}
  function monthEnd(s){var d=date(s);return new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).toISOString().slice(0,10);}
  function days(a,b){return Math.round((date(b)-date(a))/86400000)+1;}
  function preset(key,now,first){var start=now.slice(0,7)+'-01',mon=shift(now,-((date(now).getUTCDay()+6)%7));
    if(key==='today')return[now,now];if(key==='yesterday')return[shift(now,-1),shift(now,-1)];
    if(key==='this_week')return[mon,now];if(key==='last_week')return[shift(mon,-7),shift(mon,-1)];
    if(key==='this_month')return[start,now];if(key==='last_month')return[shiftMonths(start,-1),shift(start,-1)];
    if(key==='year')return[now.slice(0,4)+'-01-01',now];if(key==='2025')return['2025-01-01','2025-12-31'];
    if(key==='last3m'||key==='last6m')return[shiftMonths(start,key==='last3m'?-3:-6),shift(start,-1)];
    if(key==='last7'||key==='last14'||key==='last30')return[shift(now,-(Number(key.slice(4))-1)),now];
    return[first,now];}
  function previous(start,end,mode){if(mode==='year')return[shiftMonths(start,-12),shiftMonths(end,-12)];
    if(start.endsWith('-01')&&end===monthEnd(end)){var months=(Number(end.slice(0,4))-Number(start.slice(0,4)))*12+Number(end.slice(5,7))-Number(start.slice(5,7))+1;return[shiftMonths(start,-months),shift(start,-1)];}
    var n=days(start,end);return[shift(start,-n),shift(start,-1)];}
  function selected(list,value){return list==='all'||!list||Array.isArray(list)&&list.includes(value)||list===value;}
  function rowSource(r){return r.platform==='B2B'?'B2B':r.channel==='Маркетплейсы'?source(r.platform):r.channel==='Сайт'?'Сайт':'Активация';}
  function filter(rows,selection){var s=selection;return rows.filter(function(r){return r.date>=s.start&&r.date<=s.end&&selected(s.cities,city(r.city))&&(r.channel==='Активация'||selected(s.sources,rowSource(r)));});}
  function sum(rows){return rows.reduce(function(a,r){a.revenue+=number(r.revenue);a.count+=number(r.count);return a;},{revenue:0,count:0});}
  function crm(rows){var h=rows[0]||[],index={};h.forEach(function(v,i){index[v]=i;});['id сделки','стадия','дата оплаты','сумма','источник','город','из лида','тип товара'].forEach(function(k){if(index[k]===undefined)throw new Error('CRM: нет колонки '+k);});
    var seen=new Set(),groups=new Map();rows.slice(1).forEach(function(r){var id=String(r[index['id сделки']]||'').trim(),d=iso(r[index['дата оплаты']]),amount=number(r[index['сумма']]);if(!id||seen.has(id)||r[index['стадия']]!=='Сделка успешна'||!d||amount<=0)return;seen.add(id);
      var src=source(r[index['источник']]),c=city(r[index['город']]),type=String(r[index['тип товара']]||'').trim();if(!['Электронный','Физический'].includes(type))type='Не указан';var lead=String(r[index['из лида']]||'').trim()==='Y';
      var key=JSON.stringify([d,c,src,type,lead]),g=groups.get(key);if(!g){g={date:d,city:c,source:src,type:type,lead:lead,revenue:0,orders:0};groups.set(key,g);}g.revenue+=amount;g.orders++;});
    return Array.from(groups.values()).map(function(g){g.revenue=Math.round(g.revenue*100)/100;return g;}).sort(function(a,b){return a.date.localeCompare(b.date);});}
  function purchases(rows,s){return(rows||[]).filter(function(r){return r.date>=s.start&&r.date<=s.end&&selected(s.cities,r.city)&&selected(s.sources,r.source);});}
  function purchaseStats(rows){var out={revenue:0,orders:0,lead:{revenue:0,orders:0},direct:{revenue:0,orders:0},types:{'Электронный':{revenue:0,orders:0},'Физический':{revenue:0,orders:0},'Не указан':{revenue:0,orders:0}}};rows.forEach(function(r){out.revenue+=r.revenue;out.orders+=r.orders;var l=out[r.lead?'lead':'direct'];l.revenue+=r.revenue;l.orders+=r.orders;var t=out.types[r.type]||out.types['Не указан'];t.revenue+=r.revenue;t.orders+=r.orders;});out.avg=out.orders?out.revenue/out.orders:null;return out;}
  return{CITIES:CITIES,SOURCES:SOURCES,ACTUAL_STAGES:ACTUAL_STAGES,isoDate:iso,number:number,today:today,city:city,source:source,shift:shift,days:days,preset:preset,previous:previous,filter:filter,sum:sum,crm:crm,purchases:purchases,purchaseStats:purchaseStats};
});
