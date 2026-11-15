(function(root){
  'use strict';
  var KEYS = ['acq','tax','pack','logistics'];
  function sum(items, match){return (items || []).reduce(function(n,x){return n + (match(x.name) ? Math.abs(Number(x.value)||0) : 0);},0);}
  function defaults(months){
    var d={act:60,acq:2.1,pack:2,tax:7,logistics:0,disc:0,target:20,fixed:30,months:null};
    var last=(months||[]).filter(function(m){return m.revenue_total>0;}).slice(-6);
    var site=0,rev=0,fix=0,acq=0,pack=0,delivery=0;
    last.forEach(function(m){
      rev+=m.revenue_total;fix+=(m.personnel_total||0)+(m.indirect_total||0)+(m.admin_total||0);
      site+=sum(m.revenue_breakdown,function(n){return /^Wowlife (МСК|СПБ) (выручка|Выручка)$/.test(n);});
      acq+=sum(m.direct_breakdown,function(n){return n==='Эквайринговая комиссия';});
      pack+=sum(m.direct_breakdown,function(n){return n==='Создание продукта';});
      delivery+=sum((m.direct_breakdown||[]).concat(m.indirect_breakdown||[]),function(n){return /^Доставка(?:\s|$)/.test(n);});
    });
    if(site>0){d.acq=Math.round(acq/site*1000)/10;d.pack=Math.round(pack/site*1000)/10;d.logistics=Math.round(delivery/site*1000)/10;}
    if(rev>0)d.fixed=Math.round(fix/rev*200)/2;
    if(last.length)d.months=last[0].label+' … '+last[last.length-1].label;
    return d;
  }
  // Weighted by sold certificates, never by revenue or an average of monthly percentages.
  function certificateMix(data,city,asOf){
    var day=String(asOf||new Date().toISOString().slice(0,10)),year=Number(day.slice(0,4)),month=Number(day.slice(5,7))-1;
    var start=new Date(Date.UTC(year,month-12,1)).toISOString().slice(0,10),end=new Date(Date.UTC(year,month,0)).toISOString().slice(0,10);
    var cityName=city==='Мск'?'Москва':city==='СПб'?'Санкт-Петербург':null;
    var result={start:start,end:end,physical:0,electronic:0,unknown:0,total:0,physicalShare:null,available:false,city:cityName};
    var meta=data&&data.meta;
    if(!data||!Array.isArray(data.purchaseRows)||!meta||!meta.start||!meta.end||meta.start>start||meta.end<end)return result;
    data.purchaseRows.forEach(function(r){
      if(r.date<start||r.date>end||r.source!=='Сайт'||cityName&&r.city!==cityName)return;
      var n=Number(r.quantity);if(!Number.isFinite(n)||n<=0)return;
      if(r.type==='Физический')result.physical+=n;else if(r.type==='Электронный')result.electronic+=n;else result.unknown+=n;
    });
    result.total=result.physical+result.electronic;
    if(result.total>0){result.physicalShare=result.physical/result.total;result.available=true;}
    return result;
  }
  function certificateType(value){return value==='electronic'||value==='average'?value:'physical';}
  function parameters(values,modes,overrides,format,physicalShare){
    modes=modes||{};overrides=overrides||{};
    var p={a:Math.max(0,Math.min(100,Number(values.act)||0))/100,t:(Number(values.target)||0)/100,v:0,vr:0,costs:{},partner:overrides.partner||null};
    function read(k){var o=overrides[k];return {value:Math.max(0,Number(o?o.value:values[k])||0),mode:o?o.mode:modes[k]};}
    p.certificateType=certificateType(format);
    p.physicalWeight=p.certificateType==='electronic'?0:p.certificateType==='average'?(Number.isFinite(physicalShare)&&physicalShare>=0&&physicalShare<=1?physicalShare:null):1;
    p.formatAvailable=p.physicalWeight!==null;
    KEYS.forEach(function(k){var x=read(k);if(k==='pack'||k==='logistics')x.value*=p.physicalWeight===null?0:p.physicalWeight;p.costs[k]={pct:x.mode==='rub'?0:x.value/100,rub:x.mode==='rub'?x.value:0};p.v+=p.costs[k].pct;p.vr+=p.costs[k].rub;});
    var disc=read('disc'),fixed=read('fixed');p.discP=disc.mode==='rub'?0:Math.min(1,disc.value/100);p.discR=disc.mode==='rub'?disc.value:0;p.fP=fixed.mode==='rub'?0:fixed.value/100;p.fR=fixed.mode==='rub'?fixed.value:0;
    return p;
  }
  function netPrice(gross,p){return Math.max(0,gross*(1-p.discP)-p.discR);}
  function targetPrice(cost,p){
    if(p.formatAvailable===false)return null;
    var share=p.partner&&p.partner.mode==='pct'?Math.max(0,Number(p.partner.value)||0)/100:null;
    var amount=p.partner&&p.partner.mode!=='pct'?Math.max(0,Number(p.partner.value)||0):cost;
    var den=1-p.v-p.fP-(share===null?0:share*p.a);
    if(!(den>0)||!(p.discP<1)||(share===null&&(amount===null||amount===undefined||!Number.isFinite(amount))))return null;
    var net=((share===null?amount*p.a:0)+p.vr+p.fR)/den;
    if(!Number.isFinite(net)||net<0)return null;
    return (net+p.discR)/(1-p.discP);
  }

  function calculate(gross,cost,p){
    var price=Number.isFinite(gross)?netPrice(gross,p):null,parts={},V=price===null||p.formatAvailable===false?null:0;
    KEYS.forEach(function(k){parts[k]=price===null||p.formatAvailable===false&&(k==='pack'||k==='logistics')?null:price*p.costs[k].pct+p.costs[k].rub;if(V!==null)V+=parts[k];});
    if(p.partner)cost=p.partner.mode==='pct'?(price===null?null:price*Math.max(0,Number(p.partner.value)||0)/100):Math.max(0,Number(p.partner.value)||0);
    var r={price:price,V:V,expenses:parts,exp:cost,partnerShare:price>0&&cost!==null?cost/price:null,partnerForecast:cost===null?null:cost*p.a,target:targetPrice(cost,p),mpAct:null,mAct:null,npAct:null,nAct:null,discount:price===null?null:Math.max(0,gross-price),p:p};
    if(!(price>0)||cost===null||cost===undefined)return r;
    r.mpAct=price-cost*p.a;r.mAct=r.mpAct/price;
    if(p.formatAvailable===false)return r;
    r.npAct=r.mpAct-V-price*p.fP-p.fR;r.nAct=r.npAct/price;
    return r;
  }
  function worstCase(gross,maxCost,p){return calculate(gross,maxCost,Object.assign({},p,{a:1,partner:null}));}
  var api={certificateMix:certificateMix,certificateType:certificateType,expenseKeys:KEYS,defaults:defaults,parameters:parameters,netPrice:netPrice,targetPrice:targetPrice,calculate:calculate,worstCase:worstCase};
  if(typeof module==='object'&&module.exports)module.exports=api;else root.WowlifePricing=api;
})(typeof window==='object'?window:globalThis);
