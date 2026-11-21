const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),cp=require('node:child_process');
const model=require('./sales-analytics-model.js');
const header=['id сделки','стадия','дата оплаты','сумма','источник','город','из лида','тип товара','описание'];
const raw=[header,
 ['1','Сделка успешна','2026-10-01',9000,'Веб-сайт','Москва','','Физический','Массаж x2 — 10000 руб.; Пакет премиум(Add) x1 — 0 руб.'],
 ['1','Сделка успешна','2026-10-01',9000,'Веб-сайт','Москва','','Физический','Массаж x2 — 10000 руб.'],
 ['2','Сделка успешна','2026-10-01',3000,'Веб-сайт','Москва','','Электронный','Йога x1 — 3000 руб.'],
 ['3','Сделка успешна','2026-10-01',0,'Веб-сайт','Москва','','Физический','Массаж x3 — 0 руб.'],
 ['4','Сделка успешна','2026-10-01',800,'Веб-сайт','Москва','','Физический','Доплата x1 — 800 руб.'],
 ['5','Сделка успешна','2026-10-01',500,'Веб-сайт','Москва','','Физический','Упаковочная бумага(Add) x1 — 500 руб.'],
 ['6','Сделка успешна','2026-10-01',100,'Веб-сайт','Москва','','Физический','Тест x1 — 100 руб.'],
 ['7','Сделка провалена','2026-10-01',20000,'Веб-сайт','Москва','','Физический','Массаж x1 — 20000 руб.'],
 ['8','Сделка успешна','2026-10-01',-100,'Веб-сайт','Москва','','Физический','Массаж x1 — 100 руб.'],
 ['9','Сделка успешна','2026-10-02',5000,'OZON','СПБ','','Физический','Йога x1 — 5000 руб.'],
 ['10','Сделка успешна','2026-09-01',4000,'Веб-сайт','Москва','','Физический','Йога x1 — 4000 руб.']];
const data={orderMetric:model.ORDER_METRIC,purchaseRows:model.crm(raw)},s={start:'2026-10-01',end:'2026-10-31',cities:model.CITIES,sources:['Сайт']};
assert.deepEqual(model.orderStats(data,s),{available:true,revenue:12000,orders:2,avg:6000},'two certificates and a discount belong to one paid basket; duplicates/extras/zero/test/failed/refunds do not add checks');
assert.equal(model.orderStats(data,{...s,sources:['Ozon']}).avg,5000);
assert.equal(model.orderStats(data,{...s,sources:['Сайт','Ozon']}).avg,17000/3);
assert.equal(model.orderStats(data,{...s,cities:['Санкт-Петербург']}).avg,null);
assert.equal(model.orderStats(data,{...s,start:'2026-09-01',end:'2026-09-30'}).avg,4000);
assert.equal(model.orderStats(data,{...s,sources:[]}).avg,null);
assert.equal(model.orderStats({purchaseRows:data.purchaseRows},s).available,false,'old caches cannot masquerade as paid-order data');
assert.equal(model.orderStats({...data,purchaseRows:data.purchaseRows.map(({paidOrders,...r})=>r)},s).available,false);

const html=fs.readFileSync('index.html','utf8');
function snapshot(h){return JSON.parse([...h.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(m=>m[1]).find(s=>s.includes('window.__salesActData = DATA;')).match(/const DATA = ([^\n]+);/)[1]);}
const old=snapshot(cp.execFileSync('git',['show','af88de2:index.html'],{encoding:'utf8',maxBuffer:15e6})),current=snapshot(html);
const cleaned=JSON.parse(JSON.stringify(current));delete cleaned.orderMetric;cleaned.purchaseRows.forEach(r=>{delete r.paidOrders;delete r.paidOrderRevenue;});
assert.deepEqual(cleaned,old,'all previous sales/activations, money, quantities, packaging and embedded metadata are unchanged');
assert.equal(current.orderMetric,model.ORDER_METRIC);
const october=model.orderStats(current,s);
assert.equal(october.orders,664);assert.equal(october.revenue,4846421);assert.equal(october.avg,4846421/664);
let checked=0;
for(const month of [...new Set(current.purchaseRows.map(r=>r.date.slice(0,7)))]){
 const range={...s,start:month+'-01',end:model.shift(model.shift(month+'-01',32).slice(0,7)+'-01',-1),sources:model.SOURCES};
 const total=model.orderStats(current,range);
 for(const key of ['cities','sources']){
  const parts=(key==='cities'?model.CITIES:model.SOURCES).map(v=>model.orderStats(current,{...range,[key]:[v]}));
  assert.equal(parts.reduce((n,p)=>n+p.orders,0),total.orders);
  assert(Math.abs(parts.reduce((n,p)=>n+p.revenue,0)-total.revenue)<0.011);checked++;
 }
}
// Execute the real KPI renderer with deliberately unrelated bank revenue and
// certificate quantity: neither may be used to compute the order average.
const functions=['computeKPIs','deltaBadge','renderKPIs'].map(name=>html.match(new RegExp('  function '+name+'\\([^]*?\\n  }'))[0]).join('\n');
const element={innerHTML:''},ctx={window:{SalesAnalytics:model,__salesActData:data},document:{getElementById(){return element;}},
 state:{view:'sales',compare:true,compareMode:'period',start:s.start,end:s.end},PROFILE:{moneyLabel:'Выручка',countLabel:'Сертификаты',avgLabel:'Средний чек заказа'},FIRST:'2024-01-01',
 currentRows:()=>[{revenue:99999,count:99}],rowsInRange:()=>[{revenue:88888,count:88}],selection:()=>s,previousRange:()=>['2026-09-01','2026-09-30'],daysBetween:()=>30,fmtMoney:n=>String(n),fmtInt:n=>String(n)};
vm.runInNewContext(functions+'\nrenderKPIs();',ctx);
assert(element.innerHTML.includes('Средний чек заказа'));assert(element.innerHTML.includes('6000'));assert(element.innerHTML.includes('12000 ÷ 2'));assert(element.innerHTML.includes('50%'),'comparison uses prior order check 4000, not bank revenue / certificates');
ctx.state.view='activations';ctx.state.compare=false;vm.runInNewContext('renderKPIs();',ctx);assert(element.innerHTML.includes(String(99999/99)),'activation average retains its own event denominator');
console.log(JSON.stringify({orderCheck:'passed',partitionChecks:checked,previousSnapshotUnchanged:true,october,kpiRendererAndComparison:'passed'},null,2));
