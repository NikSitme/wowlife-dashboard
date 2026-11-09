(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.SalesAnalytics=factory();})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  var CITIES=['Москва','Санкт-Петербург','Не определён'];
  var SOURCES=['Сайт','Ozon','Wildberries','Яндекс Маркет','Flowwow','Мегамаркет','B2B'];
  var ACTIVATION_METRIC='certificate-selection-v1';
  var CRM_METRIC='certificates-all-successful-v3';
  function number(s){var n=Number(String(s==null?'':s).replace(/\s/g,'').replace(',','.'));return Number.isFinite(n)?n:0;}
  function iso(s){s=String(s||'').trim();var m=s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/),value;
    if(m)value=m[1]+'-'+m[2].padStart(2,'0')+'-'+m[3].padStart(2,'0');
    else if((m=s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})/)))value=m[3]+'-'+m[2].padStart(2,'0')+'-'+m[1].padStart(2,'0');
    if(!value)return null;var d=new Date(value+'T00:00:00Z');return Number.isFinite(+d)&&d.toISOString().slice(0,10)===value?value:null;}
  function today(now){return new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Moscow',year:'numeric',month:'2-digit',day:'2-digit'}).format(now||new Date());}
  function city(value){var v=String(value||'').trim().toLowerCase();if(/^(москва|мск)$/.test(v))return CITIES[0];if(/^(санкт[- ]петербург|петербург|спб)$/.test(v))return CITIES[1];return CITIES[2];}
  function source(value){var v=String(value||'').trim().toLowerCase();if(v==='ozon'||v==='озон')return 'Ozon';if(v==='wildberries'||v==='wildberries цифровой'||v==='вб')return 'Wildberries';if(v==='ям'||v==='яндекс маркет'||v==='яндекс.маркет')return 'Яндекс Маркет';if(/^flowwow/.test(v))return 'Flowwow';if(v==='мегамаркет')return 'Мегамаркет';if(v==='b2b')return 'B2B';return 'Сайт';}
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
  // Only this category chart uses the service scope. Unknown categories may
  // contain sets and cannot safely be presented as confirmed service sales.
  function serviceCategoryRows(rows){
    return rows.filter(function(r){
      var group=String(r.group||'').trim().toLowerCase().replace(/ё/g,'е');
      if(!group||/^(?:наборы(?:\s|$)|номинальн|доплат|доп[ ._-]*услуг|не классифицировано|без категории|не определено|—$)/.test(group))return false;
      var name=String(r.item||'').trim();
      return !/\((?:Add|Box)\)/i.test(name)&&!/^(?:подарочн(?:ый|ые)\s+набор|п\/н(?:\s|$)|набор(?:ы)?\s+впечатлен|номинальн|услуги доставки|доставка|упаковоч|упаковка|пакеты?(?:\s|\(|$)|премиум пакет|коробк|подарочная коробка|доплата|тест(?:\s|$))/i.test(name);
    });
  }
  function sum(rows){return rows.reduce(function(a,r){a.revenue+=number(r.revenue);a.count+=number(r.count);return a;},{revenue:0,count:0});}
  function serviceCategories(rows){
    var groups=new Map();
    serviceCategoryRows(rows).forEach(function(r){
      var name=String(r.group).trim(),item=String(r.item||'').trim()||'Услуга без названия';
      if(!groups.has(name))groups.set(name,{name:name,revenue:0,count:0,services:new Map()});
      var group=groups.get(name);
      if(!group.services.has(item))group.services.set(item,{name:item,revenue:0,count:0});
      [group,group.services.get(item)].forEach(function(v){v.revenue+=number(r.revenue);v.count+=number(r.count);});
    });
    return Array.from(groups.values()).map(function(g){return {name:g.name,revenue:g.revenue,count:g.count,services:Array.from(g.services.values())};});
  }
  function comparisonKey(value){return String(value||'').normalize('NFKC').trim().toLowerCase().replace(/ё/g,'е').replace(/^(?:подарочный\s+набор|п\/н)\s*/,'').replace(/[«»„“”"']/g,'').replace(/\s+/g,' ').trim();}
  function namedComparisonItem(name){return !!String(name||'').trim()&&!/^(?:без названия(?:\s|$)|не указано$|не определ[её]н(?:о)?$|—$)/i.test(String(name).trim());}
  // IDs find existing named series; they do not pretend that category-level
  // financial data contains a separate time series for each tariff or city.
  function comparisonIdIndex(names,products){
    var exact=new Map(),out=new Map();
    names.forEach(function(name){var key=comparisonKey(name);if(!exact.has(key))exact.set(key,[]);exact.get(key).push(name);});
    (products||[]).forEach(function(product){
      var aliases=[product.name].concat(product.aliases||[]),matches=new Set();
      var key=comparisonKey(product.name);
      (exact.get(key)||[]).forEach(function(n){matches.add(n);});
      if(!matches.size)aliases.forEach(function(alias){
        var full=comparisonKey(alias),base=full.split(':')[0].replace(/(?:,?\s+(?:в\s+)?(?:москве|москва|санкт-петербурге|санкт-петербург|спб|мск))$/,'').trim();
        (exact.get(full)||exact.get(base)||[]).forEach(function(n){matches.add(n);});
      });
      if(matches.size)out.set(String(product.id),{product:product,names:Array.from(matches)});
    });
    return out;
  }
  function comparisonSearch(names,index,query){
    var q=String(query||'').trim().toLowerCase(),idQuery=q.match(/^(?:id\s*[:#]?\s*|#)?(\d+)$/i),found=new Map();
    if(idQuery){
      var id=idQuery[1],entries=index.has(id)?[index.get(id)]:Array.from(index.values()).filter(function(e){return String(e.product.id).startsWith(id);});
      entries.forEach(function(e){e.names.forEach(function(name){if(!found.has(name))found.set(name,[]);found.get(name).push(e.product);});});
      return names.filter(function(name){return found.has(name);}).map(function(name){return {name:name,products:found.get(name)};});
    }
    return names.filter(function(name){return !q||comparisonKey(name).includes(comparisonKey(q));}).map(function(name){return {name:name,products:[]};});
  }
  // Activation is the certificate selection event, not the later visit or settlement.
  // A subsequent CRM stage must not erase an event that already has a valid date.
  function activations(rows){
    var h=rows[0]||[],index={};h.forEach(function(v,i){index[v]=i;});
    ['id сделки','дата активации','себестоимость','наименование услуги','партнеры','город'].forEach(function(k){if(index[k]===undefined)throw new Error('Активации: нет колонки '+k);});
    var seen=new Set(),out=[];
    rows.slice(1).forEach(function(r){
      if(!r)return;
      var d=iso(r[index['дата активации']]),id=String(r[index['id сделки']]||'').trim();
      if(!d||!id||seen.has(id))return;
      seen.add(id);
      out.push({date:d,cost:number(r[index['себестоимость']]),city:city(r[index['город']]),service:String(r[index['наименование услуги']]||'').trim(),partner:String(r[index['партнеры']]||'').trim()});
    });
    return out;
  }
  function successful(rows){var h=rows[0]||[],index={};h.forEach(function(v,i){index[v]=i;});['id сделки','стадия','дата оплаты','сумма','источник','город','из лида','тип товара','описание'].forEach(function(k){if(index[k]===undefined)throw new Error('CRM: нет колонки '+k);});
    var seen=new Set(),out=[];rows.slice(1).forEach(function(r){if(!r)return;var id=String(r[index['id сделки']]||'').trim(),d=iso(r[index['дата оплаты']]);if(!id||seen.has(id)||r[index['стадия']]!=='Сделка успешна'||!d)return;seen.add(id);
      var type=String(r[index['тип товара']]||'').trim();if(!['Электронный','Физический'].includes(type))type='Не указан';
      var items=certificateLines(r[index['описание']]);out.push({id:id,date:d,city:city(r[index['город']]),source:source(r[index['источник']]),type:type,lead:String(r[index['из лида']]||'').trim()==='Y',revenue:number(r[index['сумма']]),quantity:items.reduce(function(n,item){return n+item.quantity;},0),items:items});
    });return out;}
  function crm(rows){var groups=new Map();successful(rows).forEach(function(r){
      var key=JSON.stringify([r.date,r.city,r.source,r.type,r.lead]),g=groups.get(key);if(!g){g={date:r.date,city:r.city,source:r.source,type:r.type,lead:r.lead,revenue:0,orders:0,quantity:0};groups.set(key,g);}g.revenue+=r.revenue;g.orders++;g.quantity+=r.quantity;});
    return Array.from(groups.values()).map(function(g){g.revenue=Math.round(g.revenue*100)/100;return g;}).sort(function(a,b){return a.date.localeCompare(b.date);});}
  function purchases(rows,s){return(rows||[]).filter(function(r){return r.date>=s.start&&r.date<=s.end&&selected(s.cities,r.city)&&selected(s.sources,r.source);});}
  // Certificate delivery types always describe the Site channel. Only period
  // and cities come from the common filters; marketplace selections do not apply.
  function sitePurchases(rows,s){return purchases(rows,{start:s.start,end:s.end,cities:s.cities,sources:['Сайт']});}
  function purchaseStats(rows){function empty(){return{revenue:0,orders:0,quantity:0};}var out=empty();out.lead=empty();out.direct=empty();out.types={'Электронный':empty(),'Физический':empty(),'Не указан':empty()};rows.forEach(function(r){[out,out[r.lead?'lead':'direct'],out.types[r.type]||out.types['Не указан']].forEach(function(g){g.revenue+=r.revenue;g.orders+=r.orders;g.quantity+=r.quantity;});});out.avg=out.quantity?out.revenue/out.quantity:null;return out;}
  function certificateLines(description){
    var parts=String(description||'').split(/[;\n]/),items=[],parsed=0;
    parts.forEach(function(line){
      var m=line.trim().match(/^(.*?)\s+[xх×](\d+)\s*[—–-]/i);if(!m)return;
      parsed++;
      var name=m[1].trim();
      if(/\((?:Add|Box)\)/i.test(name)||/^(?:услуги доставки|доставка|упаковоч|упаковка|пакеты?(?:\s|\(|$)|премиум пакет|коробк|подарочная коробка|доплата)/i.test(name))return;
      var quantity=Number(m[2]);if(quantity>0)items.push({name:name,quantity:quantity});
    });
    // Preserve the documented one-certificate fallback when CRM has no readable
    // product lines. A readable basket containing only extras has no certificates.
    return parsed?items:[{name:'Без названия сертификата',quantity:1}];
  }
  function certificateQuantity(description){return certificateLines(description).reduce(function(n,item){return n+item.quantity;},0);}
  // Packaging is counted by SKU quantity, including zero-price positions. The
  // amount in the description is the line total; it must not be multiplied by xN.
  function packaging(rows){
    var h=rows[0]||[],index={};h.forEach(function(v,i){index[v]=i;});
    ['id сделки','стадия','дата оплаты','тип товара','город','источник','описание'].forEach(function(k){if(index[k]===undefined)throw new Error('Упаковка: нет колонки '+k);});
    var seen=new Set(),groups=new Map(),dates=[];
    rows.slice(1).forEach(function(r){
      if(!r)return;
      var id=String(r[index['id сделки']]||'').trim(),d=iso(r[index['дата оплаты']]);
      if(!id||!d||seen.has(id)||r[index['стадия']]!=='Сделка успешна'||r[index['тип товара']]!=='Физический')return;
      seen.add(id);dates.push(d);
      String(r[index['описание']]||'').split(/[;\n]/).forEach(function(line){
        var m=line.trim().match(/^(.*?)\s+[xх×](\d+)\s+[—–-]\s+(-?\d[\d\s]*(?:[.,]\d{1,2})?)\s*(?:руб\.?|₽)\s*$/i);
        if(!m)return;
        var name=m[1].trim().toLowerCase().replace(/\s+/g,' '),article;
        if(/^(?:пакет премиум|премиум пакет)(?:$|[\s,(])/.test(name))article='Пакеты';
        else if(/^упаковоч(?:ная|ая) бумага(?:$|[\s,(])/.test(name)||/^упаковка(?:$|[\s,(])/.test(name))article='Упаковка';
        else return;
        var qty=Number(m[2]),amount=number(m[3]);if(!Number.isSafeInteger(qty)||qty<=0||amount<0)return;
        var c=city(r[index['город']]),src=source(r[index['источник']]),key=JSON.stringify([d,c,src,article]),g=groups.get(key);
        if(!g){g={date:d,city:c,source:src,article:article,quantity:0,paidQuantity:0,zeroQuantity:0,revenue:0};groups.set(key,g);}
        g.quantity+=qty;g.paidQuantity+=amount>0?qty:0;g.zeroQuantity+=amount===0?qty:0;g.revenue+=amount;
      });
    });
    dates.sort();
    return{schemaVersion:1,generated_at:new Date().toISOString(),sourceStart:dates[0]||null,sourceEnd:dates[dates.length-1]||null,rows:Array.from(groups.values()).map(function(g){g.revenue=Math.round(g.revenue*100)/100;return g;}).sort(function(a,b){return a.date.localeCompare(b.date)||a.article.localeCompare(b.article)||a.city.localeCompare(b.city)||a.source.localeCompare(b.source);})};
  }
  return{CITIES:CITIES,SOURCES:SOURCES,ACTIVATION_METRIC:ACTIVATION_METRIC,CRM_METRIC:CRM_METRIC,activations:activations,isoDate:iso,number:number,today:today,city:city,source:source,shift:shift,days:days,preset:preset,previous:previous,filter:filter,serviceCategoryRows:serviceCategoryRows,serviceCategories:serviceCategories,comparisonKey:comparisonKey,namedComparisonItem:namedComparisonItem,comparisonIdIndex:comparisonIdIndex,comparisonSearch:comparisonSearch,sum:sum,successful:successful,crm:crm,purchases:purchases,sitePurchases:sitePurchases,purchaseStats:purchaseStats,certificateLines:certificateLines,certificateQuantity:certificateQuantity,packaging:packaging};
});
