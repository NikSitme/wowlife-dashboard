const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const model=require('./sales-analytics-model.js'),classifier=require('./sales-classifier.js'),{parseCsv}=require('./build-revenue-timeline.cjs');
const {readSnapshot}=require('./dashboard-snapshots.cjs');
const catalog=[[],[],[],[],...Array.from({length:300},(_,i)=>['','Тестовая категория','Подкатегория','Услуга '+i]),
 ['','Наборы впечатлений','Премиум','Подарочный набор «Премиум»'],['','Наборы впечатлений','Для женщин','Подарочный набор «Релакс»'],['','Наборы впечатлений','Для женщин','Подарочный набор «Женское счастье»'],['','Наборы впечатлений','Для двоих','Подарочный набор «Рай для двоих»'],['','Наборы впечатлений','Для мужчин','Подарочный набор «Время побед»'],
 ['','Прочее','Упаковка','Упаковочная бумага (Премиум, цветы)'],['','Красота и здоровье','СПА','СПА-программа «Ариан Релакс»'],['','Красота и здоровье','Массаж','Тайский оил-массаж']];
const bank=[['Проект','подбор артикула'],['Тайский оил массаж','Тайский оил-массаж']];
const classify=model.taxonomy(catalog,bank);
assert.equal(classify('Премиум')[2],'Подарочный набор «Премиум»');
assert.equal(classify('Релакс')[2],'Подарочный набор «Релакс»');
assert.equal(classify('Подарочный набор «Премиум», Москва')[2],'Подарочный набор «Премиум»');
assert.equal(classify('Сертификат "Женское счастье" подарочный набор из впечатлений на выбор')[2],'Подарочный набор «Женское счастье»');
assert.equal(classify('Тайский оил массаж для одного: 60 минут')[0],'Красота и здоровье');
assert.equal(classify('Услуга 1: 60 минут')[2],'Услуга 1');
assert.equal(classify('Услуга'),null,'short ambiguous names must not choose a random tariff');
assert.equal(classify('Подарочный пакет, Москва'),null);
assert.equal(classify('Номинальный сертификат: 7000 рублей')[0],'Номинальный сертификат');
assert.equal(classify('тестовый тест14')[0],'Технические позиции');
assert(!classifier.technical('Тест-драйв автомобиля'));
assert.equal(model.marketplaceQuantity(['','290','Подарочный пакет, Москва','Оплачено клиентом','не найдено']),0);
const mp=model.marketplaceSales([['28.08.2026','12012','Рай для двоих, Москва(9380)','Оплачено клиентом','#N/A','#N/A','Flowwow_МСК']],classify);
assert.equal(mp[0].group,'Наборы впечатлений');assert.equal(mp[0].city,'Москва');assert.equal(mp[0].count,1);
assert.equal(mp[0].opiuExcluded,true,'retain the source P&L scope while recovering the analytics city');
const description='Заказ 207737: Подарочный набор «Релакс» x1 — 3028,50 руб.; Тайский оил-массаж x1 — 2155,50 руб.';
const allocation=model.financialAllocations('','',description,classify,5184);
assert.deepEqual(allocation.map(r=>r.amount),[3028.5,2155.5]);assert.equal(allocation.reduce((s,r)=>s+r.amount,0),5184);
assert.equal(model.financialAllocations('','',description,classify,4000),null,'an unexplained discount must not be divided by guesswork');
assert.equal(model.financialAllocations('','','Заказ 207737',classify,5184),null,'an order ID without Adesk product lines cannot recover a CRM basket');
assert.equal(model.financialAllocations('','','Доплата по заказу',classify,500),null);
assert.equal(model.financialAllocations('','','Оплата по счету 123. Сертификат.',classify,10000),null);
const first=model.financialAllocations('Релакс','',description,classify,5184);
assert.equal(first[0].classification[2],'Подарочный набор «Релакс»','an explicit source project remains authoritative');
assert.equal(model.certificateQuantity('тест10 x3 — 3 руб.; main x1 — 0 руб.; Тест-драйв автомобиля x2 — 8000 руб.'),2,'technical labels excluded, real test drives preserved');
assert.equal(classifier.orderId('Оплата по заказу №218755'),'218755');
assert.equal(classifier.orderId('по сделке 55882'),'55882');
console.log('Sales classification: set/package/SPA collisions, exact aliases, tariff prefixes, technical labels, marketplace quantities/cities, baskets and discounts passed.');
const directory=process.argv[2];
if(directory){
 const read=n=>parseCsv(fs.readFileSync(path.join(directory,n+'.csv'),'utf8').replace(/^\uFEFF/,''));
 const rawBank=read('transactions'),rawMp=read('marketplaces'),mkt=read('marketing'),html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
 const sales=readSnapshot(html,'ws-dashboard-data');
 let months=0;for(const mo of [...new Set(rawBank.slice(1).map(r=>model.isoDate(r[1])).filter(Boolean).filter(d=>d.startsWith('2026-')).map(d=>d.slice(0,7)))]){
  const bankTotal=rawBank.slice(1).filter(r=>model.isoDate(r[1])?.startsWith(mo)&&['Wowlife СПБ Выручка','Wowlife МСК выручка','Выручка','B2B выручка'].includes(r[7])&&model.number(r[2])>0).reduce((s,r)=>s+model.number(r[2]),0);
  const mpTotal=rawMp.filter(r=>model.isoDate(r[0])?.startsWith(mo)).reduce((s,r)=>s+model.number(r[1]),0);
  const actual=model.sum(sales.rows.filter(r=>r.date.startsWith(mo)));
  assert(Math.abs(actual.revenue-bankTotal-mpTotal)<0.02,'raw money conservation '+mo);months++;
 }
 const window=rows=>rows.filter(r=>r.date>='2026-06-01'&&r.date<='2026-11-18');
 const siteCount=model.successful(mkt).filter(d=>d.date>='2026-06-01'&&d.date<='2026-11-18'&&['Сайт','B2B'].includes(d.source)).reduce((s,d)=>s+d.items.reduce((t,it)=>t+it.quantity,0),0);
 assert.equal(model.sum(window(sales.rows).filter(r=>r.recordKind==='certificate')).count,siteCount);
 const cl=model.taxonomy(read('catalog'),rawBank),marketplace=model.marketplaceSales(rawMp,cl);
 assert.equal(model.sum(window(marketplace)).count,5474,'12 gift-package rows removed from the former 5486 certificate count');
 assert.equal(model.sum(window(sales.rows).filter(r=>r.channel==='Маркетплейсы'&&r.group==='Не классифицировано')).revenue,0);
 assert(!window(sales.rows).some(r=>r.item==='Упаковочная бумага (Премиум, цветы)'&&r.revenue>0));
 console.log('Source controls:',months,'months conserve raw money; site quantities exclude technical labels; 12 marketplace package units removed; no unclassified marketplace sales.');
}
