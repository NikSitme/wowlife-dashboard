const assert=require('node:assert/strict'),fs=require('node:fs');
const product=require('./product-metrics-model.js'),revenue=require('./revenue-dynamics.js'),{parseCsv}=require('./build-revenue-timeline.cjs');
const fixture={version:1,asOf:'2026-01-03',coverage:{siteMsk:{from:'2026-01-01',to:'2026-01-03'},siteSpb:{from:'2026-01-01',to:'2026-01-03'}},days:{'2026-01-01':{siteMsk:1.23,siteSpb:2.34,b2bAll:900,ozonMsk:800},'2026-01-03':{siteSpb:5.67}}};
const original={from:'2026-01-01',to:'2026-01-03',revenue:999,avgPrice:333,payments:3,buyers:2,c1:.01};
const p=product.withAdeskRevenue([original],fixture)[0];assert.equal(p.revenue,9.24);assert.equal(original.revenue,999);assert.equal(p.avgPrice,333);assert.equal(p.payments,3);assert.equal(p.c1,.01);
for(const timeline of [null,{}, {...fixture,coverage:{siteMsk:fixture.coverage.siteMsk}}, {...fixture,coverage:{...fixture.coverage,siteSpb:{from:'2026-01-02',to:'2026-01-03'}}}])assert.equal(product.withAdeskRevenue([original],timeline)[0].revenue,null,'missing source/partial city never falls back to CRM or another channel');
assert.equal(product.withAdeskRevenue([{...original,from:'2026-01-02',to:'2026-01-02'}],fixture)[0].revenue,0,'covered day without receipts is zero');
assert.equal(product.withAdeskRevenue([{...original,to:'2026-01-04'}],fixture)[0].revenue,null,'incomplete range stays missing');
const crm=JSON.parse(fs.readFileSync('data/product-metrics.json')),before=JSON.stringify(crm),snapshot=JSON.parse(fs.readFileSync('data/revenue-timeline.json'));
let timeline=snapshot,primary=null;
if(process.argv[2]){
 const rows=parseCsv(fs.readFileSync(process.argv[2],'utf8').replace(/^\uFEFF/,''));
 timeline=revenue.fromRows(rows,[[],['01.01.2025','0','','','','Москва','ОЗОН']],'2026-11-25');
 const h=rows[0],dc=h.indexOf('Дата зачисления'),ac=h.indexOf('Сумма операции'),sc=h.indexOf('Статья');primary={};
 for(const r of rows.slice(1)){if(!['Wowlife МСК выручка','Wowlife СПБ Выручка'].includes(r[sc]))continue;const d=revenue.isoDate(r[dc]),v=Number(String(r[ac]).replace(/\s/g,'').replace(',','.'));if(d&&d<='2026-11-25'&&v>0)primary[d]=(primary[d]||0)+Math.round(v*100);}
}
let months=0,days=0;
for(const [ym,m] of Object.entries(crm.months)){
 const a=product.withAdeskRevenue([{month:ym,...m}],timeline)[0];
 if(a.revenue===null)continue;
 const dd=product.withAdeskRevenue(product.dailySeries(crm,ym),timeline);
 assert.equal(dd.reduce((n,d)=>n+Math.round(d.revenue*100),0),Math.round(a.revenue*100));months++;
 for(const d of dd){const shared=revenue.series(timeline,{from:d.from,to:d.to,step:'day',sources:['site'],city:'all'})[0];assert.equal(d.revenue,shared.current);if(primary)assert.equal(Math.round(d.revenue*100),primary[d.date]||0);for(const key of ['buyers','payments','avgPrice','newBuyers','c1'])assert.equal(d[key],product.dailySeries(crm,ym).find(x=>x.date===d.date)[key]);days++;}
}
assert.equal(JSON.stringify(crm),before,'underlying CRM snapshot untouched');
const october=product.withAdeskRevenue([{...crm.months['2026-10']}],timeline)[0];
const ui=fs.readFileSync('scripts/product-metrics-ui.js','utf8'),html=fs.readFileSync('index.html','utf8');
assert(ui.includes('revenueLive&&!live'),'late static snapshot cannot overwrite live data');
assert(html.includes('window.__productMetricsSetRevenueData(data)'),'shared update/cache pipeline forwards the same finance snapshot');
assert(html.indexOf('src="scripts/revenue-dynamics.js')<html.indexOf('src="scripts/product-metrics-model.js'),'browser dependency order');
assert(html.includes('Адеск · сайт, ₽'));assert(html.includes('CRM, ₽ / заказ'));assert(!html.includes('Revenue — сумма этих заказов'));
console.log(JSON.stringify({passed:true,months,days,primarySourceChecked:!!primary,through:timeline.coverage.siteMsk.to,october:{revenue:october.revenue,crmAverage:october.avgPrice,orders:october.payments},checks:['same site series as finance chart','SPb+Moscow, excludes B2B/marketplaces','complete date/city coverage only','zero versus missing','daily/monthly cents reconcile','all other CRM metrics unchanged','refresh/cache hook and stale-static guard']},null,2));
