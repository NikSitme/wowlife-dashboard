(function(root){
  'use strict';
  var KEYS = ['acq','tax','pack','logistics'];
  function sum(items, match){return (items || []).reduce(function(n,x){return n + (match(x.name) ? Math.abs(Number(x.value)||0) : 0);},0);}
  function defaults(months){
    var d={act:60,acq:2.1,pack:2,tax:7,logistics:0,disc:0,target:40,fixed:30,months:null};
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
  function parameters(values,modes,overrides){
    modes=modes||{};overrides=overrides||{};
    var p={a:Math.max(0,Math.min(100,Number(values.act)||0))/100,t:(Number(values.target)||0)/100,v:0,vr:0,costs:{},partner:overrides.partner||null};
    function read(k){var o=overrides[k];return {value:Math.max(0,Number(o?o.value:values[k])||0),mode:o?o.mode:modes[k]};}
    KEYS.forEach(function(k){var x=read(k);p.costs[k]={pct:x.mode==='rub'?0:x.value/100,rub:x.mode==='rub'?x.value:0};p.v+=p.costs[k].pct;p.vr+=p.costs[k].rub;});
    var disc=read('disc'),fixed=read('fixed');p.discP=disc.mode==='rub'?0:Math.min(1,disc.value/100);p.discR=disc.mode==='rub'?disc.value:0;p.fP=fixed.mode==='rub'?0:fixed.value/100;p.fR=fixed.mode==='rub'?fixed.value:0;
    return p;
  }
  function netPrice(gross,p){return Math.max(0,gross*(1-p.discP)-p.discR);}
  function targetPrice(cost,p){
    var share=p.partner&&p.partner.mode==='pct'?Math.max(0,Number(p.partner.value)||0)/100:null;
    var amount=p.partner&&p.partner.mode!=='pct'?Math.max(0,Number(p.partner.value)||0):cost;
    var den=1-p.v-p.t-(share===null?0:share*p.a);
    if(!(den>0)||!(p.discP<1)||(share===null&&(amount===null||amount===undefined)))return null;
    var net=(p.vr+(share===null?amount*p.a:0))/den;
    if(!(net>0))return null;
    return (net+p.discR)/(1-p.discP);
  }
  function calculate(gross,cost,p){
    var price=netPrice(gross,p),parts={},V=0;
    KEYS.forEach(function(k){parts[k]=price*p.costs[k].pct+p.costs[k].rub;V+=parts[k];});
    if(p.partner)cost=p.partner.mode==='pct'?price*Math.max(0,Number(p.partner.value)||0)/100:Math.max(0,Number(p.partner.value)||0);
    var r={price:price,V:V,expenses:parts,exp:cost,partnerShare:price>0&&cost!==null?cost/price:null,partnerForecast:cost===null?null:cost*p.a,target:targetPrice(cost,p),mpAct:null,mAct:null,mp100:null,m100:null,npAct:null,nAct:null,discount:Math.max(0,gross-price),p:p};
    if(!(price>0)||cost===null||cost===undefined)return r;
    r.mpAct=price-V-cost*p.a;r.mAct=r.mpAct/price;r.mp100=price-V-cost;r.m100=r.mp100/price;
    r.npAct=r.mpAct-price*p.fP-p.fR;r.nAct=r.npAct/price;
    return r;
  }
  function worstCase(gross,maxCost,p){return calculate(gross,maxCost,Object.assign({},p,{a:1,partner:null}));}
  var api={expenseKeys:KEYS,defaults:defaults,parameters:parameters,netPrice:netPrice,targetPrice:targetPrice,calculate:calculate,worstCase:worstCase};
  if(typeof module==='object'&&module.exports)module.exports=api;else root.WowlifePricing=api;
})(typeof window==='object'?window:globalThis);
