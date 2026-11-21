// Add paid-order aggregates to the exact existing CRM snapshot. No IDs or
// customer fields are published, and no existing metric may change.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {parseCsv}=require('./build-revenue-timeline.cjs'),model=require('./sales-analytics-model.js');
const file=path.join(__dirname,'..','index.html'),source=process.argv[2];
if(!source)throw Error('Usage: node scripts/build-order-check.cjs marketing.csv [--write]');
const html=fs.readFileSync(file,'utf8'),scripts=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)];
const body=scripts.find(m=>m[1].includes('window.__salesActData = DATA;'))[1],match=body.match(/const DATA = ([^\n]+);/);
const data=JSON.parse(match[1]),raw=parseCsv(fs.readFileSync(source,'utf8').replace(/^\uFEFF/,'')),rows=model.crm(raw);
const strip=rows=>rows.map(({paidOrderRevenue,paidOrders,...r})=>r);
assert.deepEqual(strip(rows),strip(data.purchaseRows),'Rebuild needs the same complete CRM snapshot, not a different period');
data.orderMetric=model.ORDER_METRIC;data.purchaseRows=rows;
const next=html.replace(match[0],()=> 'const DATA = '+JSON.stringify(data).replace(/</g,'\\u003c')+';');
if(process.argv.includes('--write'))fs.writeFileSync(file,next);
console.log(JSON.stringify({sourceRows:raw.length,aggregatedRows:rows.length,sourceEnd:data.meta.end,existingMetricsUnchanged:true,october:model.orderStats(data,{start:'2026-10-01',end:'2026-10-31',cities:model.CITIES,sources:['Сайт']})},null,2));
