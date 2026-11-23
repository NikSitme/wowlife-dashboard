const assert=require('node:assert/strict'),fs=require('node:fs');
const sales=require('./sales-analytics-model.js'),model=require('./product-metrics-model.js'),{parseCsv}=require('./build-revenue-timeline.cjs');
const h=['id сделки','стадия','id контакта','тип товара','город','дата оплаты','сумма','источник','из лида','описание'];
const row=(id,c,date,sum,src='Веб-сайт',desc='Массаж x2 — 1000 руб.')=>[id,'Сделка успешна',c,'Электронный','СПб',date,sum,src,'N',desc];
const r1=row('1','a','2026-01-01',100),raw=[h,r1,r1,row('2','a','2026-01-01',200),row('3','a','2026-01-03',300),row('4','','2026-01-03',400),row('5','','2026-01-03',500),row('6','b','2026-01-04',600),row('7','x','2026-01-02',0),row('8','y','2026-01-02',99,'Ozon'),row('9','z','2026-01-02',99,'Веб-сайт','Доплата x1 — 99 руб.'),row('10','future','2026-01-06',700)];
const d=model.fromRows(raw,'2026-01-04','2026-01-05T00:00:00Z');
assert.equal(d.version,4);assert.equal(Object.keys(d.days).length,4);assert(!d.days['2026-01-05']);
const report={version:1,metric:'ym:s:users',step:'day',points:[{from:'2026-01-01',to:'2026-01-01',users:10},{from:'2026-01-02',to:'2026-01-02',users:20},{from:'2026-01-03',to:'2026-01-03',users:30}]};
const days=model.dailySeries(d,'2026-01',report);
assert.equal(days[0].buyers,1);assert.equal(days[0].payments,2);assert.equal(days[0].newBuyers,1);assert.equal(days[0].avgPrice,150);assert.equal(days[0].c1,.1);
assert.equal(days[1].payments,0);assert.equal(days[1].avgPrice,null);assert.equal(days[1].c1,0);
assert.equal(days[2].buyers,3);assert.equal(days[2].newBuyers,2);assert.equal(days[2].c1,2/30);
assert.equal(days[3].users,null);assert.equal(days[3].c1,null);assert.equal(d.months['2026-01'].buyers,4);
assert.equal(days.reduce((n,r)=>n+r.buyers,0),5,'daily unique buyers cannot be summed as monthly unique buyers');
assert.equal(days.reduce((n,r)=>n+r.newBuyers,0),d.months['2026-01'].newBuyers);
assert.equal(model.dailySeries(d,'2026-01',{...report,step:'month'})[0].users,null);
assert.equal(model.dailySeries(d,'2026-01',{...report,points:[{from:'2026-01-01',to:'2026-01-02',users:999}]})[0].users,null,'mismatched audience ranges are not used');
assert.deepEqual(model.dailySeries({...d,days:undefined,version:3},'2026-01',report),[],'legacy cache does not pretend to contain zero daily sales');
assert.deepEqual(model.dailySeries(d,'2026-02',report),[]);
let dayChecks=0,monthChecks=0;
const file=process.argv[2];if(file){
 const rows=parseCsv(fs.readFileSync(file,'utf8').replace(/^\uFEFF/,'')),real=model.fromRows(rows,'2026-11-21'),groups=sales.crm(rows),old=JSON.parse(fs.readFileSync('data/product-metrics.json','utf8'));
 assert.deepEqual(real.months,old.months,'all existing monthly values must remain identical on the same snapshot');
 for(const ym of Object.keys(real.months)){
  const dd=model.dailySeries(real,ym),m=real.months[ym];assert.equal(dd.reduce((n,r)=>n+r.payments,0),m.payments);assert.equal(dd.reduce((n,r)=>n+Math.round(r.revenue*100),0),Math.round(m.revenue*100));assert.equal(dd.reduce((n,r)=>n+r.newBuyers,0),m.newBuyers);monthChecks++;
  for(const day of dd){const shared=sales.orderStats({orderMetric:sales.ORDER_METRIC,purchaseRows:groups},{start:day.from,end:day.to,sources:['Сайт'],cities:sales.CITIES});assert.equal(day.payments,shared.orders);assert.equal(day.revenue,shared.revenue);assert.equal(day.avgPrice,shared.avg);dayChecks++;}
 }
}
console.log(JSON.stringify({passed:true,dayChecks,monthChecks,checks:['day-level buyer deduplication','same-day new buyer once','anonymous orders follow approved rule','duplicates/marketplaces/extras/zero/future excluded','zero days/partial month','exact daily users/C1','old cache has no fake daily data','daily revenue/orders reconcile with shared sales model','monthly values unchanged']},null,2));
