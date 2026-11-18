const fs=require('node:fs');
const model=require('./lead-activity.js');
const {parseCsv}=require('./build-revenue-timeline.cjs');
if(require.main===module){
  const [source,output]=process.argv.slice(2);
  if(!source||!output)throw new Error('Usage: node scripts/build-lead-activity.cjs leads.csv output.json');
  const data=model.validate(model.fromRows(parseCsv(fs.readFileSync(source,'utf8').replace(/^\uFEFF/,''))));
  fs.writeFileSync(output,JSON.stringify(data)+'\n');
  console.log('Anonymous lead snapshot:',data.total,'unique leads,',data.coverageStart,'–',data.coverageEnd);
}
