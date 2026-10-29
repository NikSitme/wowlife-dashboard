(function(root,factory){var api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.WowlifePriceStructure=api;})(typeof window==='undefined'?globalThis:window,function(){
  function norm(s){return String(s||'').normalize('NFKC').toLowerCase().replace(/ё/g,'е').replace(/\s+/g,' ').trim();}
  function index(rows,prices){var names={},ids={},openPrices={};(rows||[]).filter(function(r){return r.type==='Партнер';}).forEach(function(r){ids[r.id]=r;var n=norm(r.name);(names[n]||(names[n]=[])).push(r);});(prices||[]).forEach(function(p){if(Number.isFinite(p.open)&&p.open>0)openPrices[String(p.sid)]=p;});return {names:names,ids:ids,openPrices:openPrices};}
  function resolve(partner,lookup){
    var n=norm(partner),id=n.match(/^id\s*(\d+)$/),matches=id?(lookup.ids[id[1]]?[lookup.ids[id[1]]]:[]):lookup.names[n]||[];
    if(matches.length!==1)return {rate:null,terms:matches.length?'Несколько карточек партнёра':'Комиссия не найдена',id:null};
    var row=matches[0],text=norm(row.terms),m=text.match(/^(\d+(?:[.,]\d+)?)\s*%$/),rate=text==='без комиссии'?0:m?Number(m[1].replace(',','.'))/100:null;
    if(rate!==null&&(!(rate>=0)||rate>=1))rate=null;
    return {rate:rate,terms:row.terms||'Комиссия не указана',id:row.id};
  }
  function unknown(price,terms){return {price:price,open:null,markup:null,markupShare:null,commission:null,rate:null,terms:terms,derived:true};}
  function reference(sid,partner,lookup){var p=lookup.openPrices&&lookup.openPrices[String(sid)];return p&&resolve(partner,lookup).id===p.partner_id?p:null;}
  function defaultPayout(ref,partner,lookup){var rate=resolve(partner,lookup).rate;return ref&&rate!==null?ref.open*(1-rate):null;}
  function service(price,payout,partner,lookup,ref){
    var c=resolve(partner,lookup),r=unknown(price,c.terms);r.partnerId=c.id;r.rate=c.rate;
    if(ref&&ref.partner_id===c.id){
      r.open=ref.open;r.derived=false;r.confirmedAsOf=ref.as_of;r.markup=price===null?null:price-r.open;r.markupShare=price===null?null:r.markup/r.open;
      r.terms+=' · Прайс партнёра подтверждён '+ref.as_of;
      if(c.rate===null||payout===null||!Number.isFinite(payout))return r;
      var expected=ref.open*(1-c.rate);
      if(Math.abs(expected-payout)>0.01){r.mismatch=true;r.terms+=' · Выплата модели '+payout+' ₽ отличается от выплаты по прайсу '+expected+' ₽; проверьте себестоимость в таблице или правку модели';return r;}
      r.commission=r.open-payout;return r;
    }
    if(c.rate===null||payout===null||!Number.isFinite(payout)||payout<0)return r;
    r.open=payout/(1-c.rate);r.commission=r.open-payout;r.rate=c.rate;r.markup=price===null?null:price-r.open;r.markupShare=price!==null&&r.open>0?r.markup/r.open:null;
    return r;
  }
  function aggregate(price,payout,parts,lookup,mode){
    if(!parts.length)return unknown(price,'Нет услуг с известной выплатой');
    var total=0,open=0,commission=0,expected=0,terms=[],firstOpen=null,derived=false,dates=[];
    for(var i=0;i<parts.length;i++){
      var part=parts[i],r=service(price,part.cost,part.partner,lookup,part.reference);terms.push((part.partner||'Партнёр не указан')+': '+r.terms);
      if(r.open===null||r.commission===null)return unknown(price,'Нет единого расчёта: '+terms.join('; '));
      derived=derived||r.derived;if(r.confirmedAsOf)dates.push(r.confirmedAsOf);
      if(mode==='max'&&firstOpen!==null&&Math.abs(firstOpen-r.open)>0.01)return unknown(price,'Максимальная выплата одинакова у услуг с разными открытыми ценами; смотрите состав');
      firstOpen=r.open;
      total+=part.weight;open+=r.open*part.weight;commission+=r.commission*part.weight;expected+=part.cost*part.weight;
    }
    if(!(total>0)||payout===null||Math.abs(expected/total-payout)>0.01)return unknown(price,'Выплата изменена вручную; структура состава не совпадает');
    open/=total;commission/=total;
    return {price:price,open:open,markup:price-open,markupShare:open>0?(price-open)/open:null,commission:commission,rate:open>0?commission/open:null,terms:'По составу: '+Array.from(new Set(terms)).join('; '),derived:derived,confirmedAsOf:!derived?Array.from(new Set(dates)).join(', '):null};
  }
  function rule(s,payout,p){
    var margin=s.price>0&&Number.isFinite(payout)?(s.price-payout)/s.price:null;
    var r={margin:margin,net:null,gross:null,markup:null,status:'unknown',label:'Нужны данные',hint:'Нужны открытая цена, комиссия и полная выплата партнёру.'};
    if(!(s.open>0)||s.rate===null||s.commission===null||s.mismatch||!Number.isFinite(payout)||payout<0)return r;
    if(p.partner&&p.partner.mode==='pct'){r.hint='Выплата задана долей цены модели. Задайте полную выплату в рублях для проверки цены по комиссии.';return r;}
    if(!(p.discP<1)){r.hint='При скидке 100% невозможно получить маржу 20%.';return r;}
    r.net=s.rate>=.2-1e-10?s.open:payout/.8;r.markup=Math.max(0,r.net-s.open);
    r.gross=Math.ceil(((r.net+p.discR)/(1-p.discP))*100-1e-8)/100;
    r.status=s.price===null?'unknown':s.price<r.net-.01?'below':s.price>r.net+.01?'extra':'ok';
    r.label=r.status==='below'?(margin!==null&&margin<.2?'Маржа ниже 20%':'Цена ниже правила'):r.status==='extra'?'Лишняя наценка':'По правилу';
    if(s.price===null)r.label='Нет цены модели';
    r.hint='Проверка за одну полную активацию. При комиссии от 20% цена равна открытой; при комиссии ниже 20% цена = выплата / 0,8. Скидка учтена в рекомендуемой новой цене.';
    return r;
  }
  return {index:index,resolve:resolve,reference:reference,defaultPayout:defaultPayout,service:service,aggregate:aggregate,unknown:unknown,rule:rule};
});
