const assert=require('node:assert/strict'),fs=require('node:fs');
const model=require('./lead-metrics.js'),sales=require('./sales-analytics-model.js');
const h=['ID','Стадия','Дата создания'],row=(id,stage,date)=>[id,stage,date];
const records=[h,row('1','Качественный лид','01.01.2026 00:01:00'),row('2',model.EXCLUDED,'01.01.2026 23:59:59'),row('3','Спам','03.01.2026 10:00:00'),row('4','Дубль','03.01.2026 11:00:00'),row('5','Партнеры','04.01.2026 00:00:00'),row('6','Активации — другой статус','04.01.2026 01:00:00'),row('7','Не обработан','05.01.2026 01:00:00')];
const d=model.fromRows(records.concat([records[1]]),'2026-01-04','2026-01-05T00:00:00Z');
assert(model.valid(d));assert.deepEqual(d.totals,{inputUnique:7,duplicates:1,afterCutoff:1,leads:5,activationExcluded:1});
assert.equal(model.creation('01.01.2026 23:59:59'),'2026-01-01','Moscow timestamps are not shifted twice');
assert.equal(model.creation('29.02.2025 00:00:00'),null);assert.equal(model.creation('01.01.2026 24:00:00'),null);
assert.deepEqual(model.rangeStats(d,'2026-01-02','2026-01-02'),{leads:0,activationExcluded:0});
assert.equal(model.rangeStats(d,'2026-01-01','2026-01-05'),null,'partial coverage is unavailable, never an understated total');
assert.equal(model.rangeStats(d,'2025-12-31','2026-01-04'),null);assert.equal(model.rangeStats(null,'2026-01-01','2026-01-01'),null);
assert.deepEqual(model.rangeStats(d,'2026-01-01','2026-01-04'),{leads:5,activationExcluded:1});
assert.throws(()=>model.fromRows(records.concat([row('1','Спам','01.01.2026 00:01:00')]),'2026-01-04'),/противоречащие/);
assert.throws(()=>model.fromRows([h,row('1','Спам','31.02.2026 00:00:00')],'2026-03-01'),/корректного/);
assert(!model.valid({...d,days:{...d.days,'2026-01-01':{leads:99,activationExcluded:1}}}));
const old=model.fromRows([h,row('1','Спам','01.01.2026 00:00:00')],'2026-02-01');
assert.equal(old.coverageEnd,'2026-01-01');assert.equal(model.rangeStats(old,'2026-01-02','2026-01-02'),null,'old exports do not invent subsequent zero days');
const real=JSON.parse(fs.readFileSync('data/lead-metrics.json','utf8')),product=JSON.parse(fs.readFileSync('data/product-metrics.json','utf8'));
assert(model.valid(real));assert.equal(real.totals.inputUnique,55209);assert.equal(real.totals.activationExcluded,19607);assert.equal(real.totals.afterCutoff,2);
assert.deepEqual(model.rangeStats(real,'2026-10-01','2026-10-31'),{leads:471,activationExcluded:307});
let days=0,months=0;
for(const m of Object.values(product.months)){
 const total=model.rangeStats(real,m.from,m.to);assert(total);let sum=0,excluded=0;
 for(let day=m.from;day<=m.to;day=sales.shift(day,1)){const v=model.rangeStats(real,day,day);sum+=v.leads;excluded+=v.activationExcluded;days++;}
 assert.equal(sum,total.leads);assert.equal(excluded,total.activationExcluded);months++;
}
const text=JSON.stringify(real);assert(!/@|\+7\d{10}|"rows"|"contact"|"phone"/.test(text),'published data contain no CRM contacts or raw rows');
const ui=fs.readFileSync('scripts/product-metrics-ui.js','utf8'),html=fs.readFileSync('index.html','utf8');
assert(ui.includes("['users','leads','buyers','payments','avgPrice','revenue','c1']"));assert(ui.includes('colspan="8"'));assert(ui.includes('withLeads(model.dailySeries'));
assert(html.includes('Лиды<small>CRM без активаций'));assert(ui.includes("selected:['users','revenue']"));
console.log(JSON.stringify({passed:true,months,days,totals:real.totals,checks:['exact excluded stage only','unique lead IDs and conflict detection','Moscow midnight','daily/monthly equality','outside coverage is unavailable','other product metrics preserved','only aggregates published']},null,2));
