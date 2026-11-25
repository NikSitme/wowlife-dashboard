const assert=require('node:assert/strict'),fs=require('node:fs');
const leads=require('./lead-metrics.js'),product=require('./product-metrics-model.js');
const data=JSON.parse(fs.readFileSync('data/lead-metrics.json','utf8'));
const before=JSON.stringify(data);
assert(leads.valid(data));
const november=leads.availableRangeStats(data,'2026-11-01','2026-11-24');
assert.deepEqual({from:november.from,to:november.to,partial:november.partial,leads:november.counts.leads,crm:november.counts.crmLeads,baskets:november.counts.baskets},
  {from:'2026-11-01',to:'2026-11-23',partial:true,leads:2221,crm:263,baskets:1958});
assert.equal(leads.rangeStats(data,'2026-11-01','2026-11-24'),null,'strict range API remains strict');
const converted=product.withConversions({users:28595,leads:november.counts.leads,leadsPartial:november.partial,buyers:436});
assert.equal(converted.leadConversion,null,'never divide 23-day leads by a 24-day audience');
assert.equal(converted.payingConversion,436/28595,'unrelated conversion is retained');
let daySum=0;
for(let day=1;day<=24;day++){
  const date='2026-11-'+String(day).padStart(2,'0'),daily=leads.availableRangeStats(data,date,date);
  if(day===24){assert.equal(daily,null,'missing day is not zero');continue;}
  assert.equal(daily.partial,false);daySum+=daily.counts.leads;
}
assert.equal(daySum,november.counts.leads,'visible days equal the available monthly total');
const october=leads.availableRangeStats(data,'2026-10-01','2026-10-31');
assert.equal(october.partial,false);assert.equal(october.counts.leads,2917);
assert.equal(product.withConversions({users:37787,leads:october.counts.leads,leadsPartial:false}).leadConversion,2917/37787);
assert.equal(leads.availableRangeStats(data,'2026-12-01','2026-12-31'),null);
assert.equal(leads.availableRangeStats(data,'2026-11-24','2026-11-01'),null);
assert.equal(leads.availableRangeStats(data,'bad','2026-11-01'),null);
assert.equal(leads.availableRangeStats(null,'2026-11-01','2026-11-24'),null);
const first=leads.availableRangeStats(data,'2000-01-01',data.coverageStart);
assert.equal(first.from,data.coverageStart);assert.equal(first.partial,true);
const withGap=structuredClone(data);delete withGap.days['2026-11-10'];
assert.equal(leads.availableRangeStats(withGap,'2026-11-01','2026-11-24'),null,'a hole inside coverage is not silently ignored');
const zeroData=structuredClone(data);zeroData.days['2026-11-23'].leads=0;
assert.equal(leads.availableRangeStats(zeroData,'2026-11-23','2026-11-23').counts.leads,0,'known zero remains zero');
assert.equal(JSON.stringify(data),before,'source data is unchanged');
console.log(JSON.stringify({passed:true,november,novemberDailySum:daySum,october:october.counts.leads,checks:['strict API preserved','partial monthly total labelled with exact range','matching-period conversions only','daily/monthly equality','missing versus zero','internal gaps rejected','source unchanged']},null,2));
