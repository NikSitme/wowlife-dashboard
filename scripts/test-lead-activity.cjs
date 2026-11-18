const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const m=require('./lead-activity.js'),snapshot=require('../data/lead-activity.json');
assert.equal(m.creation('2025-11-17 22:29:02'),'2025-11-18T01:29:02');
assert.equal(m.creation('2026-11-06 08:19:09'),'2026-11-06T11:19:09');
assert.equal(m.creation('2026-11-06T11:19:09+03:00'),'2026-11-06T11:19:09');
for(const s of ['2026-02-30 10:20:00','2026-11-17 24:00:00','35:31:34','2026-11-17 15:99:00',''])assert.equal(m.creation(s),null);
const h=['id лида','источник','менеджер','время обработки','дата создания'];
const data=m.fromRows([h,['1','any','private name','35:31:34','2026-11-01 22:00:00'],['1','','','','2026-11-01 22:00:00'],['2','','','','2026-11-02 12:00:00'],['3','','','','2026-11-08 12:00:00'],[]]);
assert.equal(data.total,3);assert.equal(data.duplicates,1);assert(!JSON.stringify(data).includes('private name'));
const a=m.analyze(data,'2026-11-02','2026-11-08');
assert.equal(a.total,3);assert.deepEqual(a.exposure,[1,1,1,1,1,1,1]);assert.equal(a.matrix[0][1],1);assert.equal(a.matrix[0][15],1);assert.equal(a.matrix[6][15],1);
assert.equal(a.weekdays[0].average,2);assert.equal(a.weekdays[1].average,0);
assert.equal(m.analyze(data,'2026-11-03','2026-11-07').total,0);
assert.equal(m.analyze(data,'2026-10-01','2026-11-07').partial,true);
assert.equal(m.analyze(data,'2027-01-01','2027-01-02').days,0);
assert.throws(()=>m.fromRows([h,['x','','','','bad']]),/сохранён предыдущий/);
assert.throws(()=>m.fromRows([['other']]));assert.throws(()=>m.validate({...data,total:99}));assert.throws(()=>m.analyze(data,'2026-11-09','2026-11-08'));
assert.deepEqual(m.annualRange('2026-11-18'),{from:'2025-11-18',to:'2026-11-17'});
assert.deepEqual(m.annualRange('2024-02-29'),{from:'2023-02-28',to:'2024-02-28'});
const year=m.analyze(snapshot,'2025-11-18','2026-11-17');
assert.equal(year.total,17818);assert.equal(year.days,365);assert.deepEqual(year.exposure,[52,53,52,52,52,52,52]);
assert.deepEqual(year.weekdays.map(x=>x.count),[2755,2678,2683,2650,2735,2338,1979]);
assert.deepEqual(year.topDays.map(x=>x.day),[0,4,2]);assert.deepEqual(year.topHours.map(x=>[x.hour,x.count]),[[15,1669],[14,1601],[16,1592]]);
assert.deepEqual(year.topCells.map(x=>[x.day,x.hour,x.count]),[[0,15,285],[0,17,271],[0,16,257]]);
assert.equal(year.hours.reduce((s,n)=>s+n,0),year.total);assert.equal(year.matrix.flat().reduce((s,n)=>s+n,0),year.total);
assert.equal(year.hours.slice(14,17).reduce((s,n)=>s+n,0),4862);
// Each monthly and daily partition must conserve the same unique-lead count.
let total=0;for(const d of Object.keys(snapshot.days)){const s=m.analyze(snapshot,d,d);assert.equal(s.total,snapshot.days[d].reduce((s,n)=>s+n,0));total+=s.total;}assert.equal(total,year.total);
// Exercise real UI rendering, independent filters, partial/failed refresh and racing snapshots.
const nodes={},events={};function node(id){return nodes[id]||(nodes[id]={value:'',innerHTML:'',textContent:'',addEventListener(event,fn){events[id+':'+event]=fn;}});}
let resolveFetch;const context={window:{LeadActivity:m},document:{getElementById:node},Intl,Date,console,fetch:()=>new Promise(r=>resolveFetch=r)};
node('ws-lead-activity').addEventListener=()=>{};vm.createContext(context);vm.runInContext(fs.readFileSync(path.join(__dirname,'lead-activity-ui.js'),'utf8'),context);
assert(context.window.__leadActivitySetData(snapshot));
assert(nodes['la-kpis'].innerHTML.includes('Понедельник'));assert(nodes['la-kpis'].innerHTML.includes('15:00–16:00'));assert.equal((nodes['la-heat'].innerHTML.match(/<td /g)||[]).length,168);
nodes['la-from'].value='2026-10-01';events['la-from:change'].call(nodes['la-from']);nodes['la-to'].value='2026-10-31';events['la-to:change'].call(nodes['la-to']);assert(nodes['la-scope'].textContent.includes('778'));
context.window.__leadActivityError('HTTP 500');assert(nodes['la-warning'].textContent.includes('HTTP 500'));assert(nodes['la-scope'].textContent.includes('778'));
assert.equal(context.window.__leadActivitySetData({...snapshot,latest:'2025-01-01T12:00:00'}),false);
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');assert(html.includes('safeFetch("nikitaLeads", NIKITA_ID, "Лиды", 1782624462)'));assert(html.includes('cache.leadActivity = leadData'));assert(html.includes('cache.leadActivity && window.__leadActivitySetData'));assert(html.includes('leads:"Активность лидов"'));
console.log('PASS lead activity: UTC→MSK rollover/offset, strict dates, unique IDs, anonymous snapshot, conservation for 365 daily partitions, weekday exposure, annual peaks, date filters, heatmap rendering, cache/live integration, failed refresh and stale-response retention.');
