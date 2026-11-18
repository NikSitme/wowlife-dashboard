const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const model=require('./sales-analytics-model.js');
const {readSnapshot}=require('./dashboard-snapshots.cjs');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
function fn(name){const start=html.indexOf('  function '+name+'(');assert(start>=0,name);return html.slice(start,html.indexOf('\n  }',start)+4);}
const dates=['2026-10-01','2026-10-02','2026-10-03'],range={start:dates[0],end:dates[2]};
const rows=[
 {date:dates[0],item:'Подарочный набор «Набор»',city:'Москва',channel:'Сайт',revenue:100,count:0,recordKind:'finance'},
 {date:dates[0],item:'Набор, Москва',city:'Москва',channel:'Маркетплейсы',platform:'Ozon',revenue:200,count:0,recordKind:'finance'},
 {date:dates[0],item:'п/н «Набор»',city:'Москва',channel:'Сайт',revenue:0,count:1,recordKind:'certificate'},
 {date:dates[0],item:'Набор, Москва',city:'Москва',channel:'Маркетплейсы',platform:'Ozon',revenue:0,count:2,recordKind:'certificate'},
 {date:dates[1],item:'Набор',city:'СПб',channel:'Маркетплейсы',platform:'Ozon',revenue:300,count:0,recordKind:'finance'},
 {date:dates[1],item:'Набор',city:'СПб',channel:'Маркетплейсы',platform:'Ozon',revenue:0,count:3,recordKind:'certificate'},
 {date:dates[2],item:'Набор: 60 минут',city:'Москва',channel:'Сайт',revenue:900,count:0,recordKind:'finance'},
 {date:dates[2],item:'Набор',city:'Москва',channel:'Маркетплейсы',platform:'B2B',revenue:400,count:0,recordKind:'finance'},
 {date:'2026-09-30',item:'Набор',city:'Москва',channel:'Сайт',revenue:999,count:0,recordKind:'finance'}
];
const line={name:'Подарочный набор «Набор»',source:'Сайт',city:'Москва'};
assert.deepEqual(model.comparisonSeries(rows,line,dates,'revenue',range).values,[100,0,0]);
assert.deepEqual(model.comparisonSeries(rows,{...line,source:'Ozon'},dates,'count',range).values,[2,0,0]);
assert.deepEqual(model.comparisonSeries(rows,{...line,source:'Ozon',city:'Санкт-Петербург'},dates,'revenue',range).values,[0,300,0]);
assert.deepEqual(model.comparisonSeries(rows,{...line,source:'Ozon',city:'all'},dates,'count',range).values,[2,3,0]);
assert.equal(model.comparisonSeries(rows,{...line,source:'Wildberries'},dates,'count',range).hasData,false);
assert.equal(model.comparisonSeries(rows,{...line,source:'B2B'},dates,'count',range).hasData,false,'finance rows cannot claim CRM certificates exist');
assert.equal(model.comparisonSeries(rows,{...line,source:'B2B'},dates,'revenue',range).hasData,true);
const cancel=[{...rows[0],revenue:0}];assert.equal(model.comparisonSeries(cancel,line,dates,'revenue',range).hasData,true,'a recorded zero differs from missing data');
assert.equal(model.comparisonSeriesKey('Набор: 60 минут')===model.comparisonSeriesKey('Набор'),false,'do not merge tariffs');
const raw=readSnapshot(html,'ws-dashboard-data').rows;
const oct={start:'2026-10-01',end:'2026-10-31'},sampleDates=['2026-10-01','2026-10-02','2026-10-31'];
const names=[...new Set(raw.filter(r=>r.date>=oct.start&&r.date<=oct.end).map(r=>r.item))].slice(0,12);let checks=0;
for(const source of ['all',...model.SOURCES])for(const city of ['all',...model.CITIES])for(const metric of ['revenue','count'])for(const name of names){
 const l={name,source,city};const result=model.comparisonSeries(raw,l,sampleDates,metric,oct);
 const selected=model.filter(raw,{...oct,sources:source==='all'?model.SOURCES:[source],cities:city==='all'?model.CITIES:[city]}).filter(r=>model.comparisonSeriesKey(r.item)===model.comparisonSeriesKey(name)).filter(r=>metric==='count'?r.recordKind!=='finance':r.recordKind!=='certificate');
 const expected=sampleDates.map(d=>selected.filter(r=>r.date===d).reduce((n,r)=>n+r[metric],0));
 assert.deepEqual(result.values,expected);assert.equal(result.hasData,!!selected.length);
 assert(Math.abs(result.total-selected.reduce((n,r)=>n+r[metric],0))<0.001,'period total includes every selected day, independently of displayed samples');checks++;
}
const character={name:'Подарочный набор «Характер впечатлений»',source:'Ozon',city:'all'};
assert.equal(model.comparisonSeries(raw,character,sampleDates,'count',oct).hasData,false);
const happy={name:'Подарочный набор «Счастливы вместе»',source:'Ozon',city:'all'};
assert.equal(model.comparisonSeries(raw,happy,sampleDates,'count',oct).hasData,true,'Ozon contains other products; do not break the entire source');
// UI functions: series identity, duplicate product across source/city, stable colors and cap.
const state={view:'sales',cities:[],sources:[],start:'2025-01-01',end:'2025-01-01',trendStart:oct.start,trendEnd:oct.end,trendPreset:'last_month',metricTrend:'revenue',trendItems:[]};
const nodes={};const context={state,window:{SalesAnalytics:model},TODAY:'2026-11-14',document:{getElementById(id){return nodes[id]||(nodes[id]={});}},renderTrend(){},renderTrendChips(){},shortItem:s=>s};vm.createContext(context);
vm.runInContext(['addTrendItem','changeTrendLine','changeTrendDate','trendLineLabel'].map(fn).join('\n'),context);
context.addTrendItem(line.name);context.addTrendItem(line.name);context.addTrendItem(line.name);
assert.deepEqual(state.trendItems.map(t=>t.source),['all','Сайт','Ozon']);
assert.equal(new Set(state.trendItems.map(t=>t.colorIdx)).size,3);
context.changeTrendLine(2,'city','Москва');assert.equal(state.trendItems[2].city,'Москва');
context.changeTrendLine(1,'source','all');assert.equal(state.trendItems[1].source,'Сайт','identical lines are rejected without deleting another line');
context.changeTrendDate('start','2026-11-05');assert.equal(state.trendEnd,'2026-11-05');
context.changeTrendDate('end','2026-10-10');assert.equal(state.trendStart,'2026-10-10');
const before=JSON.stringify(state);for(const d of ['2026-02-30','2026-11-15',''])context.changeTrendDate('start',d);assert.equal(JSON.stringify(state),before);
for(let i=0;i<9;i++)context.addTrendItem('Другой '+i);assert.equal(state.trendItems.length,8);
assert(!fn('renderAll').includes('state.trendStart='));
assert(!fn('trendDataFor').includes('state.cities'));
assert(!fn('trendDataFor').includes('state.sources'));
assert(fn('renderTrendChart').includes('s.hasData'));
assert(fn('renderTrendTable').includes('s.hasData'));
assert(fn('renderTrendChips').includes('data-line-city'));
assert(!html.match(/window.__wowSalesSetData = function[\s\S]*?\n  };/)[0].includes('state.trendItems = defaultTrendItems()'),'live refresh preserves selected lines');
console.log('PASS independent comparison series: same product/source/city, exact aliases, both metrics, missing vs zero, Ozon regression, stable colors, duplicates/cap, dates and refresh; '+checks+' real-snapshot checks.');

// Totals share the exact series scope and distinguish missing from recorded zero.
assert.equal(model.comparisonSeries(rows,line,dates,'revenue',range).total,100);
assert.equal(model.comparisonSeries(rows,{...line,source:'Ozon',city:'all'},dates,'revenue',range).total,500);
assert.equal(model.comparisonSeries(rows,{...line,source:'Ozon',city:'all'},dates,'count',range).total,5);
const returns=[{...rows[1],recordKind:'marketplace',count:1},{...rows[1],date:dates[1],recordKind:'marketplace',revenue:-200,count:-1}];
assert.equal(model.comparisonSeries(returns,{...line,source:'Ozon'},dates,'revenue',range).total,0);
const totalContext={state:{metricTrend:'revenue'},fmtMoney:n=>n+' ₽',fmtInt:n=>String(n)};vm.createContext(totalContext);vm.runInContext(fn('trendTotalLabel'),totalContext);
assert.equal(totalContext.trendTotalLabel({hasData:true,total:0}),'0 ₽');
assert.equal(totalContext.trendTotalLabel({hasData:false,total:0}),'—');
totalContext.state.metricTrend='count';assert.equal(totalContext.trendTotalLabel({hasData:true,total:5}),'5 шт');
assert(!fn('renderTrendChips').includes('trendTotalLabel(data)'));
assert(fn('renderTrendTotals').includes('trendTotalLabel(data)'));
assert(html.indexOf('id="ws-trend-totals"')>html.indexOf('id="ws-trend-chart-wrap"'));
assert(fn('renderTrendTable').includes('trendTotalLabel(s)'));
console.log('PASS per-line period totals: every date, product/channel/city filters, money/count switch, returns, recorded zero vs missing, identical chips/table summary.');

// Channel mode aggregates every product, without product-name matching.
const everyDate=Array.from({length:31},(_,i)=>'2026-10-'+String(i+1).padStart(2,'0'));let channelChecks=0;
for(const source of ['all',...model.SOURCES])for(const city of ['all',...model.CITIES])for(const metric of ['revenue','count']){
 const channel={kind:'channel',name:'Все товары',source,city};
 const actual=model.comparisonSeries(raw,channel,everyDate,metric,oct);
 const selected=model.filter(raw,{...oct,sources:source==='all'?model.SOURCES:[source],cities:city==='all'?model.CITIES:[city]}).filter(r=>metric==='count'?r.recordKind!=='finance':r.recordKind!=='certificate');
 const expected=selected.reduce((sum,r)=>sum+r[metric],0);
 assert(Math.abs(actual.total-expected)<0.001);assert(Math.abs(actual.values.reduce((a,b)=>a+b,0)-expected)<0.001);assert.equal(actual.hasData,!!selected.length);channelChecks++;
}
const ozone=model.comparisonSeries(raw,{kind:'channel',source:'Ozon',city:'all'},everyDate,'count',oct);assert.equal(ozone.total,577);
const ozRub=model.comparisonSeries(raw,{kind:'channel',source:'Ozon',city:'all'},everyDate,'revenue',oct);assert.equal(ozRub.total,2377842);
// Switching modes preserves each mode's lines and the common dates/metric.
const modeState={view:'sales',trendMode:'products',trendItems:[{name:'Мой товар',source:'Сайт',city:'Москва',colorIdx:0}],trendStart:oct.start,trendEnd:oct.end,metricTrend:'count'};
const modes={state:modeState,renderTrend(){},defaultTrendItems(){throw Error('must restore product lines');}};vm.createContext(modes);vm.runInContext(fn('switchTrendMode'),modes);
const products=modeState.trendItems;modes.switchTrendMode('channels');assert.deepEqual(Array.from(modeState.trendItems,t=>t.source),['Сайт','Ozon']);
modeState.trendItems[0].city='Москва';const channels=modeState.trendItems;modes.switchTrendMode('products');assert.equal(modeState.trendItems,products);modes.switchTrendMode('channels');assert.equal(modeState.trendItems,channels);assert.equal(modeState.trendStart,oct.start);assert.equal(modeState.metricTrend,'count');
modeState.view='activations';modes.switchTrendMode('products');modes.switchTrendMode('channels');assert.equal(modeState.trendMode,'products','unattributed activations must not be assigned a sales channel');
console.log('PASS channel mode: '+channelChecks+' independent source/city/metric totals and daily sums; Ozon 577 / 2,377,842; separate mode selections and unsupported activation scope.');
