const assert=require('node:assert/strict');
const M=require('./unit-economics-model.js'),P=require('./unit-economics-periods.js'),d=require('../data/unit-economics-periods.json');
function near(a,b){assert.ok(Math.abs(a-b)<Math.max(1e-7,Math.abs(b)*1e-12),`${a} != ${b}`);}
assert.equal(P.months(d).length,10);
for(const p of d.months){const b=P.build(d,p.month,p.month);assert.equal(b.valid,true);assert.deepEqual(b.input,p.input);const r=M.calculate(b.input);for(const [k,v] of Object.entries(p.expected))near(r[k],v);}
for(let i=0;i<10;i++)for(let j=i;j<10;j++){
 const rows=d.months.slice(i,j+1),b=P.build(d,rows[0].month,rows.at(-1).month,123456);assert.equal(b.valid,true);const r=M.calculate(b.input);
 for(const k of ['payments','revenue','acquisition','fixed','cogsTotal','grossProfit','profit'])near(r[k],rows.reduce((s,p)=>s+M.calculate(p.input)[k],0));
 for(const k of M.costKeys)near(r.revenue*b.input.costs[k]/100,rows.reduce((s,p)=>s+M.calculate(p.input).revenue*p.input.costs[k]/100,0));
}
assert.equal(P.options(d,'quarter','2026').length,4);assert.deepEqual(P.options(d,'quarter','2026').map(p=>p.count),[3,3,3,1]);assert.equal(P.options(d,'quarter','2026')[3].partial,true);assert.equal(P.options(d,'year','2026')[0].partial,true);assert.equal(P.options(d,'year','2026')[0].to,'2026-10');assert.equal(P.options(d,'month','2025').length,0);
for(const [a,b] of [['2026-01','2026-12'],['2026-11','2026-11'],['2026-03','2026-02'],['bad','2026-01']])assert.equal(P.build(d,a,b).valid,false);
assert.equal(P.build({...d,months:d.months.filter(p=>p.month!=='2026-02')},'2026-01','2026-03').valid,false);
const annual=M.calculate(P.build(d,'2026-01','2026-10',300000).input);near(annual.revenue,63689304);near(annual.profit,3117894.07);near(annual.users,300000);near(annual.buyers,7564);near(annual.payments,8380);
assert.equal(P.build(d,'2026-01','2026-10').valid,false,'Never sum monthly unique audience as annual people');
assert.equal(P.build({...d,ranges:{}},'2026-01','2026-10',300000).valid,false);
for(let i=0;i<10;i++)for(let j=i+1;j<10;j++){const from=d.months[i].month,to=d.months[j].month,r=M.calculate(P.build(d,from,to,300000).input);near(r.buyers,d.ranges[from+'|'+to].buyers);near(r.users,300000);}

console.log('OK: 10 monthly source cases, 55 ranges, weighted costs/profit reconciliation, partial periods, missing months, annual totals, exact-range unique audience, missing audience fails closed');

if(process.argv[2]){
 const fs=require('fs'),R=require('./product-metrics-model.js'),{parseCsv}=require('./build-revenue-timeline.cjs'),raw=parseCsv(fs.readFileSync(process.argv[2],'utf8'));
 for(const [key,r]of Object.entries(d.ranges)){const [a,b]=key.split('|'),end=new Date(Date.UTC(+b.slice(0,4),+b.slice(5),0)).toISOString().slice(0,10);assert.equal(r.buyers,R.rangeStats(raw,a+'-01',end).buyers,key);}
 console.log('45 ranges reconciled with shared ProductMetrics.rangeStats on CRM snapshot');
}
