const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {parseCsv}=require('./build-revenue-timeline.cjs'),sales=require('./sales-analytics-model.js'),product=require('./product-metrics-model.js');
const source=process.argv[2];if(!source)throw Error('Pass marketing.csv [--write]');
const raw=parseCsv(fs.readFileSync(source,'utf8').replace(/^\uFEFF/,''));
const data=product.fromRows(raw,sales.shift(sales.today(),-1)),groups=sales.crm(raw);
for(const m of Object.values(data.months)){
  const check=sales.orderStats({orderMetric:sales.ORDER_METRIC,purchaseRows:groups},{start:m.from,end:m.to,sources:['Сайт'],cities:sales.CITIES});
  assert.equal(m.payments,check.orders);assert.equal(m.revenue,check.revenue);assert.equal(m.avgPrice,check.avg);
}
if(process.argv.includes('--write'))fs.writeFileSync(path.join(__dirname,'../data/product-metrics.json'),JSON.stringify(data));
console.log(JSON.stringify({months:Object.keys(data.months).length,sourceStart:data.sourceStart,sourceEnd:data.sourceEnd,october:data.months['2026-10'],checks:'all months = shared paid-order implementation'},null,2));
