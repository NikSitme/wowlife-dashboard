// Rebuild only the marketplace portion of the first-load analytics snapshot.
// Input: JSON {current,history,catalog}, from the named Adesk Sheets tabs A:G/A:D.
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const model=require('./sales-analytics-model.js');
const file=path.join(__dirname,'..','index.html'),html=fs.readFileSync(file,'utf8');
const input=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
let updater=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].find(m=>m[1].includes('var ADESK_SOURCE_ID'))[1];
updater=updater.replace('  if (document.readyState === "loading")','  window.buildLedger = {buildTaxonomy,marketplaceRowsWithHistory};\n  if (document.readyState === "loading")');
const context={window:{SalesAnalytics:model},document:{readyState:'loading',addEventListener(){}},console};
vm.runInNewContext(updater,context);
const classify=context.window.buildLedger.buildTaxonomy(input.catalog.map(row=>row.map(value=>value==null?'':value)));
const raw=context.window.buildLedger.marketplaceRowsWithHistory(input.current,input.history);
const mp=model.marketplaceSales(raw,classify);
const match=html.match(/(<script[^>]*id="ws-dashboard-data"[^>]*>)([\s\S]*?)(<\/script>)/);
if(!match)throw Error('Missing embedded analytics dataset');
const data=JSON.parse(match[2]),before=data.rows.filter(r=>r.channel==='Маркетплейсы');
const site=data.rows.filter(r=>r.channel!=='Маркетплейсы');
data.rows=site.concat(mp).sort((a,b)=>a.date.localeCompare(b.date));
data.salesMetric=model.SALES_METRIC;data.generated_at=model.today();
data.marketplaceSource={spreadsheetId:'1kBgHBbX4wbvRCO6KCJO6YfGGZWI1dfbukViWOa6K_EM',current:'маркетплейсы',history:'маркетплейсы-25',quantity:'one sale row; signed returns; no compensation or extras',readAt:new Date().toISOString()};
const dates=[...new Set(data.rows.map(r=>r.date))].sort();data.period_start=dates[0];data.period_end=dates.at(-1);
data.dates=Array.from({length:model.days(data.period_start,data.period_end)},(_,i)=>model.shift(data.period_start,i));
fs.writeFileSync(file,html.replace(match[0],match[1]+JSON.stringify(data)+match[3]));
const totals=rows=>Object.fromEntries([...new Set(rows.map(r=>r.date.slice(0,7)))].sort().map(m=>[m,model.sum(rows.filter(r=>r.date.startsWith(m)))]));
console.log(JSON.stringify({siteRowsPreserved:site.length,rawRows:raw.length,marketplaceRows:mp.length,before:totals(before),after:totals(mp)},null,2));
