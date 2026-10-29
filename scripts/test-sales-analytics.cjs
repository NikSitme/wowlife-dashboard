const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const model = require('./sales-analytics-model.js');

assert.equal(model.today(new Date('2026-10-08T21:30:00Z')), '2026-10-09');
assert.equal(model.isoDate('29.02.2025'), null);
assert.equal(model.isoDate('29.02.2024'), '2024-02-29');
assert.deepEqual(model.preset('last_month', '2026-10-09', '2025-01-01'), ['2026-09-01','2026-09-30']);
assert.deepEqual(model.preset('year', '2026-10-09', '2026-03-01'), ['2026-01-01','2026-10-09']);
assert.deepEqual(model.preset('last3m', '2026-10-09', '2025-01-01'), ['2026-07-01','2026-09-30']);
assert.deepEqual(model.previous('2026-09-01','2026-09-30','period'), ['2026-08-01','2026-08-31']);
assert.deepEqual(model.previous('2024-02-01','2024-02-29','year'), ['2023-02-01','2023-02-28']);
assert.deepEqual(model.previous('2026-09-10','2026-09-15','period'), ['2026-09-04','2026-09-09']);

const header = ['id сделки','стадия','дата оплаты','сумма','источник','город','из лида','тип товара','описание'];
const raw = [header,
  ['1','Сделка успешна','2026-09-01','1 000,50','Веб-сайт','Москва','Y','Электронный'],
  ['1','Сделка успешна','2026-09-01','1 000,50','Веб-сайт','Москва','Y','Электронный'],
  ['2','Сделка успешна','2026-09-02','2000','OZON','СПБ','','Физический'],
  ['3','Сделка успешна','2026-09-03','0','Веб-сайт','Москва','','Физический'],
  ['4','Сделка провалена','2026-09-03','3000','Веб-сайт','Москва','','Физический'],
  ['5','Сделка успешна','','3000','Веб-сайт','Москва','','Физический'],
  ['6','Сделка успешна','2026-09-04','4000','Веб-сайт','','',''],
  ['7','Сделка успешна','2026-08-31','5000','Веб-сайт','Москва','','Физический']
];
const selection = {start:'2026-09-01',end:'2026-09-30',cities:model.CITIES,sources:model.SOURCES};
const purchases = model.crm(raw);
const stats = model.purchaseStats(model.purchases(purchases, selection));
assert.equal(stats.orders, 3);
assert.equal(stats.revenue, 7000.5);
assert.equal(stats.lead.revenue + stats.direct.revenue, stats.revenue);
assert.equal(Object.values(stats.types).reduce((sum,r)=>sum+r.orders,0), stats.orders);
assert.equal(model.purchaseStats(model.purchases(purchases,{...selection,cities:['Москва'],sources:['Сайт']})).orders,1);
assert.equal(model.purchaseStats(model.purchases(purchases,{...selection,sources:[]})).orders,0);
assert.equal(model.purchaseStats(model.purchases(purchases,{...selection,cities:['Не определён']})).orders,1);

const html = fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
let updater = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].find(m=>m[1].includes('var ADESK_SOURCE_ID'))[1];
updater = updater.replace('  if (document.readyState === "loading")',
  '  window.testAnalytics = { computeWowsales, computeSalesAct };\n  if (document.readyState === "loading")');
const context = {window:{SalesAnalytics:model},document:{readyState:'loading',addEventListener(){}},console};
vm.runInNewContext(updater,context);
const actHeader = ['id сделки','стадия','дата активации','себестоимость','наименование услуги','партнеры','город'];
const stages = ['Сделка успешна','Погашен','Себес | отдел активаций','Ждем сверку','Ожидает оплаты','Активация','Ожидает посещения'];
const act = [actHeader, ...stages.map((stage,i)=>[String(i+1),stage,'01.09.2026','100','Услуга','Партнёр','СПБ']),
  ['8','Сделка провалена','01.09.2026','100','Услуга','Партнёр','СПБ'],
  ['7','Ожидает посещения','01.09.2026','999','Услуга','Партнёр','СПБ'],
  ['9','Активация','','999','Услуга','Партнёр','СПБ'],
  ['10','Активация','31.02.2026','999','Услуга','Партнёр','СПБ'],
  ['','Активация','01.09.2026','999','Услуга','Партнёр','СПБ']];
assert.equal(model.activations(act).length,8,'dated activation events survive later stages; duplicates and invalid/missing dates or IDs do not count');
assert.equal(model.activations([actHeader, ...act.slice(1).map(row=>[row[0],'Новая стадия CRM',...row.slice(2)])]).length,8,'changing later stages must not rewrite activation history');
const tx = [['Дата операции','Дата зачисления','Сумма операции','Статья','Проект','Описание'],
  ['31.08.2026','01.09.2026','100','Wowlife МСК выручка','','Доплата Санкт-Петербург'],
  ['01.09.2026','01.09.2026','200','B2B выручка','Услуга','Москва'],
  ['01.09.2026','01.09.2026','-50','Wowlife МСК выручка','Услуга','Москва']];
const mp = [['Дата операции','Цена','','','','город','площадка'],
  ['01.09.2026','300','','','Услуга','СПБ','ВБ'],
  ['01.09.2026','-30','','','Услуга','СПБ','ВБ']];
const catalog = [[],[],[],[],...Array.from({length:300},(_,i)=>['','Категория','Подкатегория','Услуга '+i])];
const datasets = context.window.testAnalytics.computeWowsales(catalog,tx,mp,act);
assert.equal(model.sum(model.filter(datasets.sales.rows,selection)).revenue,570);
assert.equal(model.sum(model.filter(datasets.sales.rows,{...selection,cities:['Москва'],sources:['Сайт']})).revenue,100,'bank article wins over conflicting description; credit date selects month');
assert.equal(model.sum(model.filter(datasets.sales.rows,{...selection,sources:['B2B']})).revenue,200);
assert.equal(model.sum(datasets.activations.rows).count,8,'certificate selection is an activation even before the visit or settlement');
assert.equal(model.sum(datasets.activations.rows).revenue,800);
assert.deepEqual(model.sum(datasets.activations.rows),model.sum(datasets.partners.rows));
assert.equal(model.sum(model.filter(datasets.activations.rows,{...selection,cities:['Санкт-Петербург'],sources:[]})).count,8,'activation source filter does not hide activations');
const salesActFixture = context.window.testAnalytics.computeSalesAct(raw,act);
assert.equal(salesActFixture.meta.total_act,8,'trend and analytics must share the same activation definition and deduplication');
assert.equal(salesActFixture.meta.total_cost,800);
assert.equal(salesActFixture.activationMetric,model.ACTIVATION_METRIC);
assert.equal(datasets.activations.activationMetric,model.ACTIVATION_METRIC);
assert.equal(datasets.partners.activationMetric,model.ACTIVATION_METRIC);

const embedded = id => JSON.parse(html.match(new RegExp('<script[^>]*id="'+id+'"[^>]*>([\\s\\S]*?)</script>'))[1]);
const sales = embedded('ws-dashboard-data'), activations = embedded('ws-dashboard-data-activations'), partners = embedded('ws-dashboard-data-partners');
const bodies = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(m=>m[1]);
const opiu = JSON.parse(bodies.find(s=>s.includes('window.__opiuData = DATA;')).match(/var DATA = ([^\n]+);/)[1]);
const salesAct = JSON.parse(bodies.find(s=>s.includes('window.__salesActData = DATA;')).match(/const DATA = ([^\n]+);/)[1]);
assert.equal(model.purchaseStats(model.purchases(salesAct.purchaseRows,selection)).orders,993,'fresh 29 October source snapshot; zero-value deals remain excluded');
assert.equal(model.purchaseStats(model.purchases(salesAct.purchaseRows,selection)).revenue,8609590);
for(const month of opiu){
  // In-progress months change between independently downloaded exports.
  if(month.source_fetched_at && month.label >= month.source_fetched_at.slice(0,7)) continue;
  const rows = sales.rows.filter(r=>r.date.startsWith(month.label)&&!r.opiuExcluded);
  assert.ok(Math.abs(model.sum(rows).revenue-month.revenue_total)<0.02,'same revenue scope must reconcile with OПиУ in '+month.label);
}
assert.equal(sales.schemaVersion,2);
assert.equal(model.sum(model.filter(sales.rows,selection)).revenue,8755966);
assert.equal(activations.activationMetric,model.ACTIVATION_METRIC);
assert.equal(partners.activationMetric,model.ACTIVATION_METRIC);
assert.equal(salesAct.activationMetric,model.ACTIVATION_METRIC);
assert.equal(model.sum(model.filter(activations.rows,selection)).count,869);
assert.equal(model.sum(model.filter(activations.rows,{...selection,start:'2026-10-01',end:'2026-10-29'})).count,687);
assert.equal(salesAct.daily.act.dates.reduce((total,d,i)=>total+(d.startsWith('2026-10-')?salesAct.daily.act.count[i]:0),0),687);
assert.deepEqual(model.sum(model.filter(activations.rows,selection)),model.sum(model.filter(partners.rows,selection)));
// Old browser caches may contain the former five-stage metric. Reject their
// activation data while allowing independently cached financial sales to load.
const cachedSaSetter=html.match(/window\.__salesActSetData = function\(newData\)\{[\s\S]*?\n\};/)[0];
const cachedWsSetter=html.match(/window\.__wowSalesSetData = function\(newSales, newAct, newPart\)\{[\s\S]*?\n  \};/)[0];
const cacheContext={window:{SalesAnalytics:model},DATA:{activationMetric:model.ACTIVATION_METRIC},DATASETS:{activations,partners},state:{view:'activations',preset:'custom'},loadDataset(){},defaultTrendItems(){return[];},renderAll(){}};
vm.runInNewContext(cachedSaSetter+'\n'+cachedWsSetter,cacheContext);
cacheContext.window.__salesActSetData({purchaseRows:[],meta:{total_act:8}});
assert.equal(cacheContext.DATA.activationMetric,model.ACTIVATION_METRIC);
const cachedSales={schemaVersion:2,rows:[]};
cacheContext.window.__wowSalesSetData(cachedSales,{schemaVersion:2},{schemaVersion:2});
assert.equal(cacheContext.DATASETS.sales,cachedSales);
assert.equal(cacheContext.DATASETS.activations,activations);
assert.equal(cacheContext.DATASETS.partners,partners);
for(const month of ['2025-01','2025-09','2026-01','2026-09']) {
  const start=month+'-01',end=model.shift(month==='2025-01'?'2025-02-01':month==='2025-09'?'2025-10-01':month==='2026-01'?'2026-02-01':'2026-10-01',-1);
  const sel={...selection,start,end};
  const total=model.sum(model.filter(sales.rows,sel));
  const citySum=model.CITIES.reduce((s,c)=>s+model.sum(model.filter(sales.rows,{...sel,cities:[c]})).revenue,0);
  const sourceSum=model.SOURCES.reduce((s,c)=>s+model.sum(model.filter(sales.rows,{...sel,sources:[c]})).revenue,0);
  assert.ok(Math.abs(total.revenue-citySum)<0.02);
  assert.ok(Math.abs(total.revenue-sourceSum)<0.02);
}
console.log('Sales analytics: paid orders, deduplication, shared filters, Moscow calendar, refunds, dated certificate selections independent of later stages, trend/analytics/partners consistency and embedded snapshot reconciliation passed.');
