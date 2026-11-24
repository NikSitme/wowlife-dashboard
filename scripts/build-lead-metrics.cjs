const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{spawnSync}=require('node:child_process');
const model=require('./lead-metrics.js'),sales=require('./sales-analytics-model.js');
const source=process.argv[2],through=process.argv[3]||sales.shift(sales.today(),-1);
if(!source)throw Error('Usage: node scripts/build-lead-metrics.cjs private-leads.csv [YYYY-MM-DD] [--baskets population.csv creation-dates.csv ...] [--write]');
const read=spawnSync(process.env.WOW_LEADS_PYTHON||'python3',[path.join(__dirname,'read-lead-export.py'),source],{encoding:'utf8',maxBuffer:40*1024*1024});
if(read.status!==0)throw Error(read.stderr||'Lead CSV extraction failed');
const normalized=JSON.parse(read.stdout);let data=model.fromRows(normalized.rows,through);
data.sourceFile=path.basename(source);data.sourceSha256=crypto.createHash('sha256').update(fs.readFileSync(source)).digest('hex');
const basketIndex=process.argv.indexOf('--baskets');
if(basketIndex>=0){
  const basketFile=process.argv[basketIndex+1],dateFiles=process.argv.slice(basketIndex+2).filter(p=>p!=='--write');
  if(!basketFile||!dateFiles.length)throw Error('--baskets requires the population CSV and creation-date CSV files');
  const basketRead=spawnSync(process.env.WOW_LEADS_PYTHON||'python3',[path.join(__dirname,'read-basket-export.py'),basketFile,...dateFiles],{encoding:'utf8',maxBuffer:40*1024*1024});
  if(basketRead.status!==0)throw Error(basketRead.stderr||'Basket date join failed');
  const basketRows=JSON.parse(basketRead.stdout);data=model.withBaskets(data,basketRows.rows);
  data.sources.baskets.sourceFile=path.basename(basketFile);data.sources.baskets.sourceSha256=crypto.createHash('sha256').update(fs.readFileSync(basketFile)).digest('hex');
  data.sources.baskets.dateSources=basketRows.dateSources;data.sources.baskets.populationDuplicates=basketRows.populationDuplicates;
  data.totals.duplicates+=basketRows.populationDuplicates;data.sources.baskets.duplicates+=basketRows.populationDuplicates;
}
if(!model.valid(data))throw Error('Lead totals did not reconcile');
if(process.argv.includes('--write'))fs.writeFileSync(path.join(__dirname,'../data/lead-metrics.json'),JSON.stringify(data)+'\n');
console.log(JSON.stringify({valid:true,sourceSha256:data.sourceSha256,coverageStart:data.coverageStart,coverageEnd:data.coverageEnd,totals:data.totals,sourceColumns:normalized.columns,october:model.rangeStats(data,'2026-10-01','2026-10-31'),november:model.rangeStats(data,'2026-11-01','2026-11-23')},null,2));
