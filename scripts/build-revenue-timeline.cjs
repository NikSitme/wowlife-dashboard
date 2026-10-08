const fs = require('node:fs');
const model = require('./revenue-dynamics.js');
function parseCsv(text){
  const rows=[]; let row=[],field='',quoted=false;
  for(let i=0;i<text.length;i++){
    const c=text[i];
    if(quoted){if(c==='"'){if(text[i+1]==='"'){field+='"';i++;}else quoted=false;}else field+=c;}
    else if(c==='"')quoted=true;
    else if(c===','){row.push(field);field='';}
    else if(c==='\n'){row.push(field);rows.push(row);row=[];field='';}
    else if(c!=='\r')field+=c;
  }
  if(field.length||row.length){row.push(field);rows.push(row);}
  return rows;
}
function mergeHistory(current,history){
  return [current[0]].concat(current.slice(1).filter(r=>model.isoDate(r[0])?.slice(0,4)!=='2025'),history.slice(1).filter(r=>model.isoDate(r[0])?.slice(0,4)==='2025'));
}
if(require.main===module){
  const [site,current,history,asOf,output]=process.argv.slice(2);
  if(!output)throw new Error('Usage: node scripts/build-revenue-timeline.cjs transactions.csv marketplaces.csv archive2025.csv YYYY-MM-DD output.json');
  const read=p=>parseCsv(fs.readFileSync(p,'utf8'));
  const data=model.fromRows(read(site),mergeHistory(read(current),read(history)),asOf);
  fs.writeFileSync(output,JSON.stringify(data)+'\n');
  console.log('Revenue snapshot:',Object.keys(data.days).length,'days; as of',data.asOf);
}
module.exports={parseCsv,mergeHistory};
