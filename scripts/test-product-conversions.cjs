const assert=require('node:assert/strict'),fs=require('node:fs');
const model=require('./product-metrics-model.js'),leads=require('./lead-metrics.js');
const original={users:100,leads:20,buyers:7,payments:10,newBuyers:3,c1:.03};
const calculated=model.withConversions(original);
assert.equal(calculated.leadConversion,.2);assert.equal(calculated.payingConversion,.07);
assert.equal(calculated.c1,.03,'first-purchase conversion remains independent of all paying users');
assert.equal(original.leadConversion,undefined,'source point is not mutated');
assert.equal(model.withConversions({...original,buyers:0,leads:0}).payingConversion,0);
assert.equal(model.withConversions({...original,buyers:0,leads:0}).leadConversion,0);
for(const users of [null,undefined,0,-1,NaN,Infinity]){const p=model.withConversions({...original,users});assert.equal(p.leadConversion,null);assert.equal(p.payingConversion,null);}
assert.equal(model.withConversions({...original,leads:null}).leadConversion,null);
assert.equal(model.withConversions({...original,buyers:undefined}).payingConversion,null);
assert.equal(model.withConversions({...original,leads:200}).leadConversion,2,'aggregate lead events are not capped or disguised as unique visitors');
const data=JSON.parse(fs.readFileSync('data/product-metrics.json','utf8')),leadData=JSON.parse(fs.readFileSync('data/lead-metrics.json','utf8'));
let monthly=0,daily=0;
function check(p,users){const count=leads.rangeStats(leadData,p.from,p.to);const x=model.withConversions({...p,users,leads:count?count.leads:null});assert.equal(x.payingConversion,p.buyers/users);assert.equal(x.leadConversion,count?count.leads/users:null);assert.equal(x.revenue,p.revenue);assert.equal(x.payments,p.payments);return x;}
for(const p of Object.values(data.months)){check(p,37787);monthly++;}
for(const p of Object.values(data.days)){check(p,1361);daily++;}
const october=check(data.months['2026-10'],37787);
assert.equal(october.payingConversion,639/37787);assert.equal(october.leadConversion,leads.rangeStats(leadData,'2026-10-01','2026-10-31').leads/37787);
const ui=fs.readFileSync('scripts/product-metrics-ui.js','utf8'),html=fs.readFileSync('index.html','utf8');
assert(ui.includes('model.withConversions(Object.assign({},p,'));assert(html.includes('Все платящие / пользователи'));
assert(ui.includes("saved.selected.filter"));assert(ui.includes('colspan="10"'));
console.log(JSON.stringify({passed:true,monthly,daily,october:{users:october.users,leads:october.leads,buyers:october.buyers,leadConversion:october.leadConversion,payingConversion:october.payingConversion},checks:['same-date numerators and audience','all buyers, not new buyers or payments','zero versus missing values','no source mutation','no cap for aggregate lead events','shared monthly/daily conversion function']},null,2));

assert(html.includes('product-metrics-model.js?v=20261124-conversions'));
assert(html.includes('product-metrics-ui.js?v=20261124-conversions'));
