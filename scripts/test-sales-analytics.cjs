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
  ['2','Сделка успешна','2026-09-02','2000','OZON','СПБ','','Физический','Подарочный набор «Тест» x1 — 2000 руб.'],
  ['3','Сделка успешна','2026-09-03','0','Веб-сайт','Москва','','Физический','Массаж x3 — 0 руб.'],
  ['4','Сделка провалена','2026-09-03','3000','Веб-сайт','Москва','','Физический'],
  ['5','Сделка успешна','','3000','Веб-сайт','Москва','','Физический'],
  ['6','Сделка успешна','2026-09-04','4000','Веб-сайт','','',''],
  ['7','Сделка успешна','2026-08-31','5000','Веб-сайт','Москва','','Физический']
];
const selection = {start:'2026-09-01',end:'2026-09-30',cities:model.CITIES,sources:model.SOURCES};
const purchases = model.crm(raw);
const stats = model.purchaseStats(model.purchases(purchases, selection));
assert.equal(stats.orders, 4);
assert.equal(stats.quantity, 6,'zero-sum deals and every certificate in a basket count');
assert.equal(stats.avg,stats.revenue/6,'average amount is per certificate');
assert.equal(stats.revenue, 7000.5);
assert.equal(stats.lead.revenue + stats.direct.revenue, stats.revenue);
assert.equal(Object.values(stats.types).reduce((sum,r)=>sum+r.quantity,0), stats.quantity);
assert.equal(model.purchaseStats(model.purchases(purchases,{...selection,cities:['Москва'],sources:['Сайт']})).quantity,4);
assert.equal(model.purchaseStats(model.purchases(purchases,{...selection,sources:[]})).orders,0);
assert.equal(model.purchaseStats(model.purchases(purchases,{...selection,cities:['Не определён']})).orders,1);
assert.equal(model.certificateQuantity('Подарочный набор «Релакс» x1 — 4050 руб.; Подарочный набор «Воплоти мечту» x2 — 8680 руб.'),3,'all certificate lines count, not only the first multiplier');
assert.equal(model.certificateQuantity('Премиум Пакет(Add) x4 — 1196 руб.; Сертификат на массаж x2 — 12000 руб.; Услуги доставки СПб, Мск x1 — 350 руб.; Мужские(Box) x2 — 0 руб.'),2,'extras before the main product must not determine certificate count');
assert.equal(model.certificateQuantity('Конная прогулка: Полный пакет х2 — 20000 руб.; Семейная фотосессия: Пакет «Стандарт» ×3 — 45000 руб.'),5,'package wording inside service names remains a certificate');
assert.equal(model.certificateQuantity('Упаковочная бумага (синяя)(Add) x3 — 1470 руб.; Пакет премиум(Add) x1 — 299 руб.'),0,'a basket of extras has no certificates');
assert.equal(model.certificateQuantity(''),1,'missing descriptions retain the documented fallback');
assert.equal(model.source('Wildberries Цифровой'),'Wildberries','digital Wildberries orders must not become direct website orders');
assert.equal(model.source('Мегамаркет'),'Мегамаркет','historical marketplace source remains separate from website');
assert.ok(model.SOURCES.includes('Мегамаркет'));

const packagingHeader=['id сделки','стадия','дата оплаты','тип товара','город','источник','описание'];
const packagingFixture=[packagingHeader,
  ['p1','Сделка успешна','2026-10-01','Физический','Москва','Веб-сайт new','Премиум Пакет(Add) x2 — 598 руб.; Упаковочная бумага (синяя)(Add) x3 — 1470 руб.; Подарочный набор «Премиум» x1 — 10000 руб.'],
  ['p1','Сделка успешна','2026-10-01','Физический','Москва','Веб-сайт new','Премиум Пакет(Add) x2 — 598 руб.'],
  ['p2','Сделка успешна','2026-10-02','Физический','СПБ','flowwow','Пакет премиум(Add) x1 — 0 руб.; Упаковочная бумага (сердечки) x1 — 490 руб.'],
  ['p3','Сделка успешна','2026-10-03','Физический','Москва','Звонок','Пакеты курьерские, маленькие(Box) x5 — 0 руб.; Пакеты фирменные(Box) x1 — 0 руб.; Коробка для сертификата WOWlife (Box) x1 — 0 руб.; Конная прогулка: Полный пакет x1 — 28000 руб.'],
  ['p4','Сделка успешна','2026-10-04','Электронный','Москва','Веб-сайт','Премиум Пакет(Add) x1 — 299 руб.'],
  ['p5','Сделка провалена','2026-10-04','Физический','Москва','Веб-сайт','Премиум Пакет(Add) x1 — 299 руб.'],
  ['p6','Сделка успешна','31.02.2026','Физический','Москва','Веб-сайт','Премиум Пакет(Add) x1 — 299 руб.'],
  ['p7','Сделка успешна','2026-09-30','Физический','Москва','Веб-сайт','Премиум пакет х1 — 299,50 ₽; Упаковка winter (Новый год) ×1 — 490 руб.'],
  ['p8','Сделка успешна','2026-10-05','Физический','','Веб-сайт','Упаковочная бумага x2 — 0 руб.; Премиум Пакет(Add) x1 — -299 руб.'],
  ['','Сделка успешна','2026-10-05','Физический','Москва','Веб-сайт','Премиум Пакет(Add) x1 — 299 руб.']
];
const packaging=model.packaging(packagingFixture);
const packagingSelection={...selection,start:'2026-10-01',end:'2026-10-31'};
const packagingTotals=rows=>rows.reduce((out,r)=>{for(const key of ['quantity','paidQuantity','zeroQuantity','revenue'])out[key]+=r[key];return out;},{quantity:0,paidQuantity:0,zeroQuantity:0,revenue:0});
const packagingOctober=model.purchases(packaging.rows,packagingSelection);
assert.deepEqual(packagingTotals(packagingOctober.filter(r=>r.article==='Пакеты')),{quantity:3,paidQuantity:2,zeroQuantity:1,revenue:598},'count xN once per deal; zero-price packages count without adding revenue');
assert.deepEqual(packagingTotals(packagingOctober.filter(r=>r.article==='Упаковка')),{quantity:6,paidQuantity:4,zeroQuantity:2,revenue:1960},'use line totals rather than multiplying revenue by xN');
assert.equal(packagingTotals(model.purchases(packaging.rows,{...packagingSelection,cities:['Москва'],sources:['Сайт']})).quantity,5,'shared filters select date, city and CRM source');
assert.equal(packagingTotals(model.purchases(packaging.rows,{...packagingSelection,sources:['Flowwow']})).quantity,2);
assert.equal(packagingTotals(model.purchases(packaging.rows,{...packagingSelection,sources:[]})).quantity,0);
assert.equal(packagingTotals(model.purchases(packaging.rows,{...packagingSelection,cities:['Не определён']})).quantity,2);
assert.equal(packaging.rows.find(r=>r.date==='2026-09-30'&&r.article==='Пакеты').revenue,299.5,'historical SKU spellings and decimal comma remain supported');
assert.equal(packaging.sourceEnd,'2026-10-05');

const html = fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
let updater = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].find(m=>m[1].includes('var ADESK_SOURCE_ID'))[1];
updater = updater.replace('  if (document.readyState === "loading")',
  '  window.testAnalytics = { computeWowsales, computeSalesAct, computeMarketing };\n  if (document.readyState === "loading")');
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
catalog.push(['','Наборы впечатлений','Универсальные','Подарочный набор «Тест»']);
const datasets = context.window.testAnalytics.computeWowsales(catalog,tx,mp,act,raw);
assert.equal(model.sum(model.filter(datasets.sales.rows,selection)).revenue,570);
assert.equal(model.sum(model.filter(datasets.sales.rows,selection)).count,6,'category rows count certificates rather than financial records');
assert.equal(datasets.sales.salesMetric,model.CRM_METRIC);
assert.equal(datasets.sales.rows.find(r=>r.recordKind==='certificate'&&r.item==='Подарочный набор «Тест»').count,1,'CRM product names map to the same financial catalog');
const marketingRaw=raw.map((r,i)=>r.concat(i===0?['utm source','id контакта']:['','']));
const marketingAct=act.map((r,i)=>r.concat(i===0?['id контакта']:['']));
const marketingFixture=context.window.testAnalytics.computeMarketing(marketingRaw,marketingAct);
assert.equal(marketingFixture.months['2026-09'].orders,5,'marketing volume counts certificates, including zero-sum deals');
assert.equal(marketingFixture.months['2026-09'].byDay['2026-09-03'].orders,3);
assert.equal(marketingFixture.salesMetric,model.CRM_METRIC);
assert.equal(model.sum(model.filter(datasets.sales.rows,{...selection,cities:['Москва'],sources:['Сайт']})).revenue,100,'bank article wins over conflicting description; credit date selects month');
assert.equal(model.sum(model.filter(datasets.sales.rows,{...selection,sources:['B2B']})).revenue,200);
assert.equal(model.sum(datasets.activations.rows).count,8,'certificate selection is an activation even before the visit or settlement');
assert.equal(model.sum(datasets.activations.rows).revenue,800);
assert.deepEqual(model.sum(datasets.activations.rows),model.sum(datasets.partners.rows));
assert.equal(model.sum(model.filter(datasets.activations.rows,{...selection,cities:['Санкт-Петербург'],sources:[]})).count,8,'activation source filter does not hide activations');
const salesActFixture = context.window.testAnalytics.computeSalesAct(raw,act);
assert.equal(salesActFixture.meta.total_act,8,'trend and analytics must share the same activation definition and deduplication');
assert.equal(salesActFixture.meta.total_cost,800);
assert.equal(salesActFixture.revenueByTypeMonth['2026-09']['Не указан'].count,1,'missing type and missing city remain visible in OPiU totals');
assert.deepEqual(JSON.parse(JSON.stringify(salesActFixture.packaging.rows)),model.packaging(raw).rows,'live refresh includes the same packaging calculation as the source snapshot');
assert.equal(salesActFixture.activationMetric,model.ACTIVATION_METRIC);
assert.equal(datasets.activations.activationMetric,model.ACTIVATION_METRIC);
assert.equal(datasets.partners.activationMetric,model.ACTIVATION_METRIC);

const embedded = id => JSON.parse(html.match(new RegExp('<script[^>]*id="'+id+'"[^>]*>([\\s\\S]*?)</script>'))[1]);
const sales = embedded('ws-dashboard-data'), activations = embedded('ws-dashboard-data-activations'), partners = embedded('ws-dashboard-data-partners');
const bodies = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(m=>m[1]);
const opiu = JSON.parse(bodies.find(s=>s.includes('window.__opiuData = DATA;')).match(/var DATA = ([^\n]+);/)[1]);
const salesAct = JSON.parse(bodies.find(s=>s.includes('window.__salesActData = DATA;')).match(/const DATA = ([^\n]+);/)[1]);
assert.equal(model.purchaseStats(model.purchases(salesAct.purchaseRows,selection)).quantity,1038,'all certificates, including successful zero-sum deals');
assert.equal(model.purchaseStats(model.purchases(salesAct.purchaseRows,selection)).revenue,8609590);
for(const month of opiu){
  // In-progress months change between independently downloaded exports.
  if(month.source_fetched_at && month.label >= month.source_fetched_at.slice(0,7)) continue;
  const rows = sales.rows.filter(r=>r.date.startsWith(month.label)&&!r.opiuExcluded);
  assert.ok(Math.abs(model.sum(rows).revenue-month.revenue_total)<0.02,'same revenue scope must reconcile with OПиУ in '+month.label);
}
assert.equal(sales.schemaVersion,2);
assert.equal(sales.salesMetric,model.CRM_METRIC);
assert.equal(model.sum(model.filter(sales.rows,selection)).revenue,8755966);
assert.equal(activations.activationMetric,model.ACTIVATION_METRIC);
assert.equal(partners.activationMetric,model.ACTIVATION_METRIC);
assert.equal(salesAct.activationMetric,model.ACTIVATION_METRIC);
assert.equal(model.sum(model.filter(activations.rows,selection)).count,869);
assert.equal(model.sum(model.filter(activations.rows,{...selection,start:'2026-10-01',end:'2026-10-29'})).count,693);
assert.equal(salesAct.daily.act.dates.reduce((total,d,i)=>total+(d.startsWith('2026-10-')?salesAct.daily.act.count[i]:0),0),738);
assert.equal(salesAct.crmMetric,model.CRM_METRIC);
assert.deepEqual(model.sum(model.filter(activations.rows,selection)),model.sum(model.filter(partners.rows,selection)));
// Old browser caches may contain the former five-stage metric. Reject their
// activation data while allowing independently cached financial sales to load.
const cachedSaSetter=html.match(/window\.__salesActSetData = function\(newData\)\{[\s\S]*?\n\};/)[0];
const cachedWsSetter=html.match(/window\.__wowSalesSetData = function\(newSales, newAct, newPart\)\{[\s\S]*?\n  \};/)[0];
const cacheContext={window:{SalesAnalytics:model},DATA:{activationMetric:model.ACTIVATION_METRIC},DATASETS:{activations,partners},state:{view:'activations',preset:'custom'},loadDataset(){},defaultTrendItems(){return[];},renderAll(){}};
vm.runInNewContext(cachedSaSetter+'\n'+cachedWsSetter,cacheContext);
cacheContext.window.__salesActSetData({purchaseRows:[],meta:{total_act:8}});
assert.equal(cacheContext.DATA.activationMetric,model.ACTIVATION_METRIC);
cacheContext.window.__salesActSetData({purchaseRows:[],activationMetric:model.ACTIVATION_METRIC,meta:{total_sales:999}});
assert.equal(cacheContext.DATA.meta,undefined,'old CRM cache must not restore incorrect source mapping or first-product counts');
const cachedSales={schemaVersion:2,rows:[]};
cacheContext.window.__wowSalesSetData(cachedSales,{schemaVersion:2},{schemaVersion:2});
assert.equal(cacheContext.DATASETS.sales,undefined,'old financial row counts must not replace certificate counts');
cachedSales.salesMetric=model.CRM_METRIC;
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
for(const month of [...new Set(salesAct.purchaseRows.map(r=>r.date.slice(0,7)))]){
  const sel={...selection,start:month+'-01',end:month+'-31'};
  const stats=model.purchaseStats(model.purchases(salesAct.purchaseRows,sel));
  const site=model.purchaseStats(model.purchases(salesAct.purchaseRows,{...sel,sources:['Сайт']}));
  assert.equal(Object.values(salesAct.revenueByTypeMonth[month]||{}).reduce((n,r)=>n+r.count,0),site.quantity,'OPiU and analytics share the same site certificates in '+month);
  assert.equal(model.sum(model.filter(sales.rows,sel)).count,stats.quantity,'all category quantities match CRM in '+month);
  assert.equal(salesAct.daily.sales.dates.reduce((n,d,i)=>n+(d.startsWith(month)?salesAct.daily.sales.count[i]:0),0),stats.quantity,'sales timeline uses certificates in '+month);
  for(const cities of [model.CITIES,['Москва'],['Санкт-Петербург'],['Не определён']])for(const src of [model.SOURCES,['Сайт'],['Wildberries']]){
    const filter={...sel,cities,sources:src};
    assert.equal(model.sum(model.filter(sales.rows,filter)).count,model.purchaseStats(model.purchases(salesAct.purchaseRows,filter)).quantity,'quantity across period/city/source');
  }
}
const oct={...selection,start:'2026-10-01',end:'2026-10-31',sources:['Сайт']};
const octSite=model.purchaseStats(model.purchases(salesAct.purchaseRows,oct));
assert.equal(octSite.quantity,730);
assert.equal(octSite.types['Электронный'].quantity,430);
assert.equal(octSite.types['Физический'].quantity,300);
assert.equal(model.purchaseStats(model.purchases(salesAct.purchaseRows,{...oct,cities:['Москва','Санкт-Петербург']})).quantity,727);
assert.equal(Object.values(salesAct.revenueByTypeMonth['2026-10']).reduce((n,r)=>n+r.count,0),730,'OPiU includes unknown-city certificates too');
console.log('Sales analytics: certificate quantities, zero-sum deals, baskets, category/source/city/timeline consistency, caches and financial reconciliation passed.');

// The service category chart must not present sets, nominal certificates or
// ancillary goods as services, even when their source category is generic.
const serviceFixture=[
  {group:'Мастер классы и обучение',item:'Мастер-класс',revenue:100,count:0},
  {group:'Мастер классы и обучение',item:'Мастер-класс',revenue:0,count:3},
  {group:'Прочее',item:'Кофейный мастер-класс',revenue:20,count:1},
  {group:'Катание и управление',item:'Конная прогулка: Полный пакет',revenue:30,count:2},
  {group:'Наборы впечатлений',item:'Мужские радости',revenue:999,count:10},
  {group:'Не классифицировано',item:'Мужские радости, Москва',revenue:999,count:10},
  {group:'Номинальный сертификат',item:'Сертификат',revenue:999,count:10},
  {group:'Прочее',item:'Номинальный подарочный сертификат',revenue:999,count:10},
  {group:'Прочее',item:'Упаковочная бумага (Премиум, цветы)',revenue:999,count:10},
  {group:'Доплата/не определено',item:'Доплата',revenue:999,count:0},
  {group:'Доп услуги',item:'Открытка',revenue:999,count:10},
  {group:'Прочее',item:'Открытка (Елка)(Add)',revenue:999,count:10},
  {group:'Прочее',item:'Мужские(Box)',revenue:999,count:10},
  {group:'Прочее',item:'Тест',revenue:0,count:10},
];
const fixtureBefore=JSON.stringify(serviceFixture);
assert.deepEqual(model.sum(model.serviceCategoryRows(serviceFixture)),{revenue:150,count:6},'service quantities include zero-price certificates; money is not multiplied by quantity');
assert.equal(JSON.stringify(serviceFixture),fixtureBefore,'the chart scope must not mutate overall totals or detail rows');
const serviceRows=model.serviceCategoryRows(sales.rows);
const categories=new Set(serviceRows.map(r=>r.group));
assert(categories.size>10,'the real service chart needs every category beyond the former top ten');
assert(!categories.has('Наборы впечатлений')&&!categories.has('Номинальный сертификат')&&!categories.has('Не классифицировано'));
assert(!serviceRows.some(r=>/^Упаковоч/i.test(r.item)));
const chartContext={state:{view:'sales',metricCat:'count'},PROFILE:{catNounPlural:'категорий',catTopLabel:'Категории первого уровня'},renderServiceCategories(rows){chartContext.services=rows;},renderBarPanel(...args){chartContext.rendered=args;}};
const chartBody=html.match(/  function renderChart\(tree, rows\)\{[\s\S]*?\n  \}/)[0];
const aggBody=html.match(/  function flatAgg\(rows, keyFn\)\{[\s\S]*?\n  \}/)[0];
vm.runInNewContext(aggBody+'\n'+chartBody,chartContext);
chartContext.renderChart({},sales.rows);
assert.equal(chartContext.services,sales.rows,'sales use the expandable service categories');
chartContext.state.metricCat='revenue';chartContext.renderChart({},sales.rows);
assert.equal(chartContext.services,sales.rows);
chartContext.state.view='activations';chartContext.renderChart({'Наборы впечатлений':{revenue:1,count:2}},sales.rows);
assert.equal(chartContext.rendered[3][0][0],'Наборы впечатлений','the activation chart retains its own original scope');
assert.equal(chartContext.rendered[4].foldTop10,true);
console.log('Service category chart: all categories, service-only scope, both metrics, zero-price certificates and unchanged detail/activation scopes passed.');

// Parent bars and their concrete services share exactly the same filtered rows.
const detailed=model.serviceCategories(serviceFixture);
assert.equal(detailed.length,3);
assert.deepEqual(detailed.find(c=>c.name==='Мастер классы и обучение').services,[{name:'Мастер-класс',revenue:100,count:3}]);
assert.equal(JSON.stringify(serviceFixture),fixtureBefore);
const groupingFixture=[
  {group:'A',item:'Одинаковое название',revenue:100,count:2},
  {group:'B',item:'Одинаковое название',revenue:60,count:1},
  {group:'A',item:'',revenue:10,count:0},
  {group:'A',item:'Бесплатная услуга',revenue:0,count:1},
];
assert.equal(model.serviceCategories(groupingFixture)[0].services.length,3,'retain unnamed and zero-revenue rows without merging names across categories');
let reconciled=0;
for(const period of [{start:'2026-10-01',end:'2026-10-31'},{start:'2025-01-01',end:'2026-11-09'}]){
  for(const cities of ['all',...model.CITIES.map(c=>[c])])for(const sources of ['all',...model.SOURCES.map(s=>[s])]){
    const rows=model.filter(sales.rows,{...period,cities,sources});
    const groups=model.serviceCategories(rows);
    const grouped=model.sum(groups),raw=model.sum(model.serviceCategoryRows(rows));
    assert(Math.abs(grouped.revenue-raw.revenue)<0.000001);
    assert.equal(grouped.count,raw.count);
    for(const g of groups){
      const totals=model.sum(g.services);
      assert(Math.abs(totals.revenue-g.revenue)<0.01);
      assert.equal(totals.count,g.count);reconciled++;
    }
  }
}

// Real renderer: escaping, metric sorting, totals and remembered disclosure state.
const nodes={},listeners=[];
const uiContext={window:{SalesAnalytics:model},state:{metricCat:'revenue',expandedServiceCategories:new Set(['A'])},
 document:{getElementById(id){return nodes[id]||(nodes[id]={innerHTML:'',textContent:'',querySelectorAll(){return listeners;}});}},
 metricFmt(m){return v=>String(v)+(m==='revenue'?' ₽':' шт');},metricNoun(){return 'выручке';},fmtMoney(v){return String(v)+' ₽';},fmtInt(v){return String(v);},
 escapeHtml(s){return String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));}};
vm.runInNewContext(html.match(/  function renderServiceCategories\(rows\)\{[\s\S]*?\n  \}/)[0],uiContext);
const uiRows=[{group:'A',item:'<Услуга> "один"',revenue:100,count:1},{group:'A',item:'Услуга два',revenue:50,count:3}];
const element={isConnected:true,open:false,dataset:{category:'A'},addEventListener(type,fn){this.toggle=fn;}};
listeners.push(element);
uiContext.renderServiceCategories(uiRows);
assert(nodes['ws-barchart'].innerHTML.includes('data-category="A" open'));
assert(nodes['ws-barchart'].innerHTML.includes('&lt;Услуга&gt; &quot;один&quot;'));
assert(nodes['ws-barchart'].innerHTML.includes('<td class="num">150 ₽</td><td class="num">4</td>'));
assert(nodes['ws-barchart'].innerHTML.indexOf('&lt;Услуга&gt;')<nodes['ws-barchart'].innerHTML.indexOf('Услуга два'));
uiContext.state.metricCat='count';uiContext.renderServiceCategories(uiRows);
assert(nodes['ws-barchart'].innerHTML.indexOf('Услуга два')<nodes['ws-barchart'].innerHTML.indexOf('&lt;Услуга&gt;'));
assert(nodes['ws-barchart'].innerHTML.includes('data-category="A" open'),'metric switch keeps disclosure open');
element.toggle();assert(!uiContext.state.expandedServiceCategories.has('A'));
element.open=true;element.toggle();assert(uiContext.state.expandedServiceCategories.has('A'));
element.isConnected=false;element.open=false;element.toggle();assert(uiContext.state.expandedServiceCategories.has('A'),'discarded DOM cannot erase new disclosure state');
uiContext.renderServiceCategories([]);assert(nodes['ws-barchart'].innerHTML.includes('Нет услуг'));

// Site-only panel must ignore the global source selection, not period or cities.
for(const sources of ['all',[],['Сайт'],['Ozon'],['B2B'],model.SOURCES]){
  const selection={...oct,sources},before=JSON.stringify(selection);
  const stats=model.purchaseStats(model.sitePurchases(salesAct.purchaseRows,selection));
  assert.equal(stats.quantity,730);assert.equal(stats.types['Электронный'].quantity,430);assert.equal(stats.types['Физический'].quantity,300);
  assert.equal(JSON.stringify(selection),before);
}
assert.equal(model.purchaseStats(model.sitePurchases(salesAct.purchaseRows,{...oct,sources:['Ozon'],cities:['Москва','Санкт-Петербург']})).quantity,727);
assert.equal(model.sitePurchases(salesAct.purchaseRows,{...oct,start:'2099-01-01',end:'2099-01-31'}).length,0);
const panels={},panelContext={window:{__wowSalesSelection:{...oct,view:'sales',sources:['Ozon']},__salesActData:salesAct},model,
 document:{getElementById(id){return panels[id]||(panels[id]={});}},renderPackagingPanel(){},money(v){return String(v);}};
vm.runInNewContext(html.match(/  function card\(label,value,total\)\{[^\n]+/)[0]+'\n'+html.match(/  function renderPurchasePanels\(\)\{[\s\S]*?\n  \}/)[0],panelContext);
panelContext.renderPurchasePanels();
assert(panels['ws-cert-stat'].innerHTML.includes('Всего по сайту: 730'));
assert(panels['ws-lead-stat'].innerHTML.includes('Нет сертификатов сайта'),'unrelated panels still respect global source selection');
console.log(`Service disclosures: ${reconciled} category totals reconciled; service sorting, state, escaping and site-only certificate panel with period/city filters passed.`);

// Catalog ID search selects the existing named series, with exact tariff priority.
const comparisonNames=['Без названия товара','п/н «Релакс»','Массаж','Массаж: 60 минут','Массаж спины','Полёт'];
const comparisonProducts=[
  {id:'16139',name:'Подарочный набор «Релакс»',city:'СПб',aliases:[]},
  {id:'30671',name:'Массаж: 60 минут',city:'СПб',aliases:['Массаж']},
  {id:'30672',name:'Массаж, Москва: 90 минут',city:'Москва',aliases:[]},
  {id:'30673',name:'Полёт: 10 минут',city:'Москва',aliases:[]},
  {id:'8',name:'Массаж стоп: 20 минут',city:'СПб',aliases:[]},
];
const idIndex=model.comparisonIdIndex(comparisonNames,comparisonProducts);
for(const query of ['16139','ID 16139','#16139','id:16139'])assert.deepEqual(model.comparisonSearch(comparisonNames,idIndex,query).map(r=>r.name),['п/н «Релакс»']);
assert.deepEqual(model.comparisonSearch(comparisonNames,idIndex,'30671').map(r=>r.name),['Массаж: 60 минут'],'exact tariff wins over broad parent alias');
assert.deepEqual(model.comparisonSearch(comparisonNames,idIndex,'30672').map(r=>r.name),['Массаж'],'unaggregated tariff can find its existing parent series');
assert.equal(model.comparisonSearch(comparisonNames,idIndex,'3067').length,3,'partial ID can find several services');
assert.equal(model.comparisonSearch(comparisonNames,idIndex,'8').length,0,'no fuzzy matching of unrelated services');
assert.equal(model.comparisonSearch(comparisonNames,idIndex,'999999999').length,0);
assert.deepEqual(model.comparisonSearch(comparisonNames,idIndex,'  Подарочный набор РЕЛАКС ').map(r=>r.name),['п/н «Релакс»']);
assert.equal(model.comparisonSearch(comparisonNames,idIndex,'без названия').length,1,'unnamed rows remain manually searchable');
const defaultsContext={window:{SalesAnalytics:model},itemUniverse:()=>comparisonNames};
vm.runInNewContext(html.match(/  function defaultTrendItems\(\)\{[\s\S]*?\n  \}/)[0],defaultsContext);
assert.equal(JSON.stringify(defaultsContext.defaultTrendItems()),JSON.stringify(comparisonNames.slice(1,4).map((name,colorIdx)=>({name,colorIdx}))));

const idCatalog=JSON.parse(fs.readFileSync(path.join(__dirname,'../data/comparison-products.json'),'utf8'));
assert.equal(new Set(idCatalog.products.map(p=>p.id)).size,idCatalog.products.length);
assert(idCatalog.products.every(p=>Object.keys(p).every(k=>['id','name','city','aliases'].includes(k))),'public lookup contains only catalog IDs and names');
const actualNames=[...new Set(sales.rows.map(r=>r.item).filter(Boolean))],actualIndex=model.comparisonIdIndex(actualNames,idCatalog.products);
assert(model.comparisonSearch(actualNames,actualIndex,'30671').some(r=>r.name==='RF-лифтинг лица: Лицо + зона декольте'));
assert(model.comparisonSearch(actualNames,actualIndex,'16139').some(r=>r.name==='Подарочный набор «Релакс»'));

const pickerNodes={'ws-trend-search':{value:'30671'},'ws-trend-options':{innerHTML:'',querySelectorAll(){return [];}}};
const pickerContext={window:{SalesAnalytics:model},state:{trendItems:[]},document:{getElementById:id=>pickerNodes[id]},
  itemUniverse:()=>comparisonNames,comparisonIds:()=>idIndex,comparisonProductsLoaded:true,comparisonProductsLoading:null,
  escapeHtml:uiContext.escapeHtml,shortItem:s=>s};
vm.runInNewContext(html.match(/  function renderTrendPicker\(\)\{[\s\S]*?\n  \}/)[0],pickerContext);
pickerContext.renderTrendPicker();
assert(pickerNodes['ws-trend-options'].innerHTML.includes('data-name="Массаж: 60 минут"'));
assert(pickerNodes['ws-trend-options'].innerHTML.includes('ID 30671'));
pickerNodes['ws-trend-search'].value='999999';pickerContext.renderTrendPicker();
assert(pickerNodes['ws-trend-options'].innerHTML.includes('Ничего не найдено'));
pickerContext.comparisonProductsLoaded=false;pickerContext.comparisonProductsLoading=true;pickerContext.renderTrendPicker();
assert(pickerNodes['ws-trend-options'].innerHTML.includes('Загружаю справочник ID'));
console.log(`Cross comparison: ${idCatalog.products.length} catalog IDs, exact and prefix lookup, tariff priority, real ID matches, defaults and picker passed.`);
