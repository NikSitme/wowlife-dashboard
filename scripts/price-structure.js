(function(root,factory){var api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.WowlifePriceStructure=api;})(typeof window==='undefined'?globalThis:window,function(){
  function norm(s){return String(s||'').normalize('NFKC').toLowerCase().replace(/ё/g,'е').replace(/\s+/g,' ').trim();}
  function index(rows){var names={},ids={};(rows||[]).filter(function(r){return r.type==='Партнер';}).forEach(function(r){ids[r.id]=r;var n=norm(r.name);(names[n]||(names[n]=[])).push(r);});return {names:names,ids:ids};}
  function resolve(partner,lookup){
    var n=norm(partner),id=n.match(/^id\s*(\d+)$/),matches=id?(lookup.ids[id[1]]?[lookup.ids[id[1]]]:[]):lookup.names[n]||[];
    if(matches.length!==1)return {rate:null,terms:matches.length?'Несколько карточек партнёра':'Комиссия не найдена',id:null};
    var row=matches[0],text=norm(row.terms),m=text.match(/^(\d+(?:[.,]\d+)?)\s*%$/),rate=text==='без комиссии'?0:m?Number(m[1].replace(',','.'))/100:null;
    if(rate!==null&&(!(rate>=0)||rate>=1))rate=null;
    return {rate:rate,terms:row.terms||'Комиссия не указана',id:row.id};
  }
  function unknown(price,terms){return {price:price,open:null,markup:null,markupShare:null,commission:null,rate:null,terms:terms,derived:true};}
  function service(price,payout,partner,lookup){
    var c=resolve(partner,lookup),r=unknown(price,c.terms);r.partnerId=c.id;r.rate=c.rate;
    if(c.rate===null||payout===null||!Number.isFinite(payout)||payout<0)return r;
    r.open=payout/(1-c.rate);r.commission=r.open-payout;r.rate=c.rate;r.markup=price-r.open;r.markupShare=r.open>0?r.markup/r.open:null;
    return r;
  }
  function aggregate(price,payout,parts,lookup,mode){
    if(!parts.length)return unknown(price,'Нет услуг с известной выплатой');
    var total=0,open=0,commission=0,expected=0,terms=[],firstOpen=null;
    for(var i=0;i<parts.length;i++){
      var part=parts[i],r=service(price,part.cost,part.partner,lookup);terms.push((part.partner||'Партнёр не указан')+': '+r.terms);
      if(r.open===null)return unknown(price,'Нет единого расчёта: '+terms.join('; '));
      if(mode==='max'&&firstOpen!==null&&Math.abs(firstOpen-r.open)>0.01)return unknown(price,'Максимальная выплата одинакова у услуг с разными открытыми ценами; смотрите состав');
      firstOpen=r.open;
      total+=part.weight;open+=r.open*part.weight;commission+=r.commission*part.weight;expected+=part.cost*part.weight;
    }
    if(!(total>0)||payout===null||Math.abs(expected/total-payout)>0.01)return unknown(price,'Выплата изменена вручную; структура состава не совпадает');
    open/=total;commission/=total;
    return {price:price,open:open,markup:price-open,markupShare:open>0?(price-open)/open:null,commission:commission,rate:open>0?commission/open:null,terms:'По составу: '+Array.from(new Set(terms)).join('; '),derived:true};
  }
  return {index:index,resolve:resolve,service:service,aggregate:aggregate,unknown:unknown};
});
