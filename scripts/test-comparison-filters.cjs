const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const model=require('./sales-analytics-model.js');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
function fn(name){const start=html.indexOf('  function '+name+'(');assert(start>=0,name);return html.slice(start,html.indexOf('\n  }',start)+4);}
const elements={};
function element(id){return elements[id]||(elements[id]={value:'',listeners:{},addEventListener(k,f){this.listeners[k]=f;}});}
const state={view:'sales',start:'2026-09-01',end:'2026-09-30',sources:['Ozon'],cities:model.CITIES.slice(),trendStart:'2026-10-01',trendEnd:'2026-10-31',trendSource:'Сайт',trendPreset:'last_month',metricTrend:'revenue'};
const context={state,window:{SalesAnalytics:model},TODAY:'2026-11-14',PRESETS:[{key:'last_month',label:'Прошлый месяц'},{key:'custom',label:'Свой период'}],escapeHtml:s=>s,document:{getElementById:element},presetRange:k=>model.preset(k,'2026-11-14','2025-01-01'),renderTrend(){context.renders++;},renders:0};
vm.createContext(context);
vm.runInContext(['trendSelection','trendSeriesFor','changeTrendDate','renderTrendControls'].map(fn).join('\n'),context);
const fixture=[
 {date:'2026-10-01',item:'Набор',city:'Москва',channel:'Сайт',revenue:100,count:1},
 {date:'2026-10-01',item:'Набор',city:'Москва',channel:'Маркетплейсы',platform:'Ozon',revenue:200,count:2},
 {date:'2026-10-01',item:'Набор',city:'СПб',channel:'Маркетплейсы',platform:'B2B',revenue:300,count:3},
 {date:'2026-09-01',item:'Набор',city:'Москва',channel:'Сайт',revenue:400,count:4},
 {date:'2026-10-02',item:'Другой',city:'Москва',channel:'Сайт',revenue:500,count:5}
];
context.RAW=fixture;
assert.deepEqual(Array.from(context.trendSeriesFor('Набор',['2026-10-01'])),[100],'local channel/date override global Ozon/September');
state.trendSource='Ozon';assert.equal(context.trendSeriesFor('Набор',['2026-10-01'])[0],200);
state.trendSource='B2B';assert.equal(context.trendSeriesFor('Набор',['2026-10-01'])[0],300);
state.trendSource='all';assert.equal(context.trendSeriesFor('Набор',['2026-10-01'])[0],600);
state.cities=['Москва'];assert.equal(context.trendSeriesFor('Набор',['2026-10-01'])[0],300,'city still uses global selection');
state.metricTrend='count';assert.equal(context.trendSeriesFor('Набор',['2026-10-01'])[0],3);
context.changeTrendDate('start','2026-11-05');assert.equal(state.trendStart,'2026-11-05');assert.equal(state.trendEnd,'2026-11-05');assert.equal(state.trendPreset,'custom');
context.changeTrendDate('end','2026-10-10');assert.equal(state.trendStart,'2026-10-10');assert.equal(state.trendEnd,'2026-10-10');
const before=JSON.stringify(state);for(const date of ['2026-02-30','2026-11-15',''])context.changeTrendDate('start',date);assert.equal(JSON.stringify(state),before);
// Real snapshot: compare every local source/metric against an independent row scan.
context.RAW=JSON.parse(html.match(/<script[^>]+id="ws-dashboard-data"[^>]*>([\s\S]*?)<\/script>/)[1]).rows;
state.trendStart='2026-10-01';state.trendEnd='2026-10-31';
let checks=0;
const items=[...new Set(context.RAW.filter(r=>r.date>=state.trendStart&&r.date<=state.trendEnd).map(r=>r.item))].slice(0,12);
for(const source of ['all',...model.SOURCES])for(const cities of [model.CITIES,['Москва'],['Санкт-Петербург'],[]])for(const metric of ['revenue','count']){
 Object.assign(state,{trendSource:source,cities,metricTrend:metric});
 for(const item of items){const dates=['2026-10-01','2026-10-02','2026-10-31'];
 const expected=dates.map(date=>model.filter(context.RAW,{start:date,end:date,cities,sources:source==='all'?model.SOURCES:[source]}).filter(r=>r.item===item).reduce((sum,r)=>sum+r[metric],0));
 assert.deepEqual(Array.from(context.trendSeriesFor(item,dates)),expected);checks++;}
}
// Full rerenders must not silently resynchronize dates with the global filter.
assert(!fn('renderAll').includes('state.trendStart='));
// Graph and table both call the same filtered series.
assert(fn('renderTrendChart').includes('trendSeriesFor(t.name, dates)'));
assert(fn('renderTrendTable').includes('trendSeriesFor(t.name, dates)'));
context.renderTrendControls();assert.equal(element('ws-trend-source').disabled,false);
state.view='activations';context.renderTrendControls();assert.equal(element('ws-trend-source').disabled,true);assert.equal(element('ws-trend-source').value,'all');
assert(element('ws-trend-scope').textContent.includes('канал продажи не указан'));
console.log('PASS comparison filters: local sources/dates, shared cities, both metrics, invalid/crossed dates, activation honesty, graph/table parity; '+checks+' real-snapshot comparisons.');
