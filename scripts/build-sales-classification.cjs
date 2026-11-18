// Rebuild sales and the matching P&L source snapshot without changing P&L formulas.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const model=require('./sales-analytics-model.js'),{parseCsv}=require('./build-revenue-timeline.cjs');
const {readSnapshot,writeSnapshot}=require('./dashboard-snapshots.cjs');
const directory=process.argv[2],root=path.join(__dirname,'..'),file=path.join(root,'index.html');
if(!directory)throw Error('Usage: node scripts/build-sales-classification.cjs source-csv-directory [--write]');
const html=fs.readFileSync(file,'utf8');
const read=name=>parseCsv(fs.readFileSync(path.join(directory,name+'.csv'),'utf8').replace(/^\uFEFF/,''));
const catalog=read('catalog'),bank=read('transactions'),mp=read('marketplaces'),crm=read('marketing');
let source=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].find(m=>m[1].includes('var ADESK_SOURCE_ID'))[1];
source=source.replace('  if (document.readyState === "loading")','  window.classificationBuilder={computeWowsales,computeOpiu};\n  if (document.readyState === "loading")');
const ctx={window:{SalesAnalytics:model},document:{readyState:'loading',addEventListener(){}},console};vm.runInNewContext(source,ctx);
const sales=ctx.window.classificationBuilder.computeWowsales(catalog,bank,mp,[],crm,{salesOnly:true}).sales;
// Preserve the separate, complete marketplace history for 2025.
const old=readSnapshot(html,'ws-dashboard-data',{root});
sales.rows=sales.rows.filter(r=>r.channel!=='Маркетплейсы'||!r.date.startsWith('2025-')).concat(old.rows.filter(r=>r.channel==='Маркетплейсы'&&r.date.startsWith('2025-'))).sort((a,b)=>a.date.localeCompare(b.date));
sales.period_start=sales.rows[0].date;sales.period_end=sales.rows.at(-1).date;sales.dates=Array.from({length:model.days(sales.period_start,sales.period_end)},(_,i)=>model.shift(sales.period_start,i));
sales.marketplaceSource={spreadsheetId:'1kBgHBbX4wbvRCO6KCJO6YfGGZWI1dfbukViWOa6K_EM',current:'маркетплейсы',history:'previous verified 2025 snapshot',readAt:new Date().toISOString()};
const classify=model.taxonomy(catalog,bank);
const rows=bank.slice(1).map((r,i)=>({r,row:i+2})).filter(x=>model.isoDate(x.r[1])>='2026-06-01'&&model.isoDate(x.r[1])<='2026-11-18'&&['Wowlife СПБ Выручка','Wowlife МСК выручка','Выручка','B2B выручка'].includes(x.r[7])&&model.number(x.r[2])>0);
const unresolved=rows.filter(x=>!model.financialAllocations(x.r[8]||'',x.r[21]||'',x.r[9]||'',classify,model.number(x.r[2]))&&!(x.r[8]==='Номинальный сертификат')&&!(!x.r[8]&&/доплат/i.test(x.r[9]||'')));
const range=rows=>rows.filter(r=>r.date>='2026-06-01'&&r.date<='2026-11-18');
const current=range(sales.rows),unknown=current.filter(r=>r.group==='Не классифицировано');
const report={sourceRows:{bank:bank.length,mp:mp.length,crm:crm.length},metric:sales.salesMetric,totals:model.sum(current),unclassified:model.sum(unknown),unresolvedFinance:{rows:unresolved.length,amount:Math.round(unresolved.reduce((s,x)=>s+model.number(x.r[2]),0)*100)/100},unknownFinance:unresolved.map(x=>({row:x.row,date:x.r[1],amount:model.number(x.r[2]),article:x.r[7],project:x.r[8],description:x.r[9]}))};
fs.writeFileSync(path.join(directory,'classification-report.json'),JSON.stringify(report,null,2));
fs.writeFileSync(path.join(directory,'classified-sales.json'),JSON.stringify(sales));
if(process.argv.includes('--write')){
  let next=writeSnapshot(html,'ws-dashboard-data',sales,{root});
  // Source categories and credit dates can be corrected after the old snapshot.
  // Refresh P&L data from the same source without changing any P&L calculation.
  const opiu=ctx.window.classificationBuilder.computeOpiu(read('opiu'),read('marketplaces-2025'));
  opiu.forEach(m=>{m.source_fetched_at=fs.statSync(path.join(directory,'opiu.csv')).mtime.toISOString();});
  next=next.replace(/  var DATA = ([^\n]+);/,()=> '  var DATA = '+JSON.stringify(opiu).replace(/</g,'\\u003c')+';');
  fs.writeFileSync(file,next);
}
console.log(JSON.stringify({...report,unknownFinance:undefined,unknownCrm:undefined},null,2));
