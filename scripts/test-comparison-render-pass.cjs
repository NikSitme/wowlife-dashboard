const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const model=require('./sales-analytics-model');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
function source(name){const start=html.indexOf('  function '+name+'(');assert(start>=0,name);return html.slice(start,html.indexOf('\n  }',start)+4);}
class Element{
 constructor(){this.style={};this.handlers={};this.innerHTML='';this.hidden=false;this.textContent='';this.parentElement={getBoundingClientRect:()=>({width:800})};}
 querySelectorAll(){return [];}
 setAttribute(){}
 addEventListener(name,fn){this.handlers[name]=fn;}
}
const dates=['2026-10-01','2026-10-02','2026-10-03'];
const rows=[
 {date:dates[0],item:'Набор',city:'Москва',channel:'Сайт',revenue:100,count:0,recordKind:'finance'},
 {date:dates[1],item:'Набор',city:'Москва',channel:'Сайт',revenue:20,count:0,recordKind:'finance'},
 {date:dates[0],item:'Набор',city:'Москва',channel:'Сайт',revenue:0,count:1,recordKind:'certificate'},
 {date:dates[1],item:'Набор',city:'СПб',channel:'Маркетплейсы',platform:'Ozon',revenue:300,count:2,recordKind:'marketplace'},
];
const state={view:'sales',metricTrend:'revenue',trendStart:dates[0],trendEnd:dates[2],trendShowTable:false,trendItems:[
 {name:'Набор',source:'Сайт',city:'Москва',colorIdx:0},
 {name:'Набор',source:'Ozon',city:'all',colorIdx:1},
 {name:'Нет записей',source:'all',city:'all',colorIdx:2},
]};
let calculations=0;const nodes=new Map();
const context={state,RAW:rows,window:{SalesAnalytics:{...model,comparisonSeries(...args){calculations++;return model.comparisonSeries(...args);}}},
 document:{getElementById(id){if(!nodes.has(id))nodes.set(id,new Element());return nodes.get(id);}},
 fmtMoney:n=>n+' ₽',fmtInt:String,shortItem:s=>s,escapeHtml:s=>String(s),dayLabel:s=>s,
 shiftDate(s,n){const d=new Date(s+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);},
 renderTrendMode(){},renderTrendControls(){},renderTrendPicker(){}
};
vm.createContext(context);
vm.runInContext(['trendDateList','trendDataFor','trendLineLabel','niceStep','trendAxisFmt','trendTotalLabel','renderTrendChips','renderTrendTotals','renderTrendChart','renderTrendTable','renderTrend'].map(source).join('\n'),context);

context.renderTrend();
assert.equal(calculations,3,'Chips, totals and chart share one calculation for each of the three selected lines');
assert(nodes.get('ws-trend-totals').innerHTML.includes('120 ₽'));
assert(nodes.get('ws-trend-totals').innerHTML.includes('300 ₽'));
assert(nodes.get('ws-trend-chips').innerHTML.includes('Это не подтверждённый ноль продаж'));
assert.equal((nodes.get('ws-trend-svg').innerHTML.match(/class="trend-line"/g)||[]).length,2,'Missing records still have no invented curve');

state.trendShowTable=true;calculations=0;context.renderTrend();
assert.equal(calculations,3,'Table mode also shares one result across chips, totals and the table');
assert(nodes.get('ws-trend-table').innerHTML.includes('Итого за период'));
assert(nodes.get('ws-trend-table').innerHTML.includes('120 ₽'));

calculations=0;context.renderTrendChart();
assert.equal(calculations,3,'A standalone resize/chart draw calculates values and hasData together once per line');

const pass={},line=state.trendItems[0];calculations=0;
const first=context.trendDataFor(line,dates,pass);
assert.equal(context.trendDataFor({...line},dates.slice(),pass),first);assert.equal(calculations,1);
state.metricTrend='count';const count=context.trendDataFor(line,dates,pass);assert.equal(count.total,1);assert.equal(calculations,2);
state.trendStart=dates[1];assert.equal(context.trendDataFor(line,dates,pass).total,0);assert.equal(calculations,3);
state.trendStart=dates[0];context.RAW=rows.concat([{...rows[0],revenue:0,count:4,recordKind:'certificate'}]);
assert.equal(context.trendDataFor(line,dates,pass).total,5);assert.equal(calculations,4,'A refreshed RAW reference invalidates the pass');
assert.equal(context.trendDataFor({...line,source:'Ozon',city:'all'},dates,pass).total,2);assert.equal(calculations,5,'Line source and city are part of the key');
assert.equal(context.trendDataFor(line,dates.slice(0,1),pass).values.length,1);assert.equal(calculations,6,'Changed plotted dates invalidate the pass');

state.metricTrend='revenue';context.RAW=rows;state.trendShowTable=false;calculations=0;context.renderTrend();
rows[0].revenue=101;context.renderTrend();
assert.equal(calculations,6,'Every full render starts a new pass, even when the input array identity is unchanged');
assert(nodes.get('ws-trend-totals').innerHTML.includes('121 ₽'));
console.log('PASS comparison render pass: one scan per line for graph/table/resize, source/city/metric/date/data invalidation, missing-vs-zero and fresh totals without cross-render caching');
