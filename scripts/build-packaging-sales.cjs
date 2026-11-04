const fs = require('node:fs');
const model = require('./sales-analytics-model.js');
const { parseCsv } = require('./build-revenue-timeline.cjs');

const [source, output] = process.argv.slice(2);
if (!source || !output) throw new Error('Usage: node scripts/build-packaging-sales.cjs marketing.csv output.json');
const data = model.packaging(parseCsv(fs.readFileSync(source, 'utf8').replace(/^\uFEFF/, '')));
if (!data.sourceEnd || !data.rows.length) throw new Error('CRM snapshot has no packaging sales');
fs.writeFileSync(output, JSON.stringify(data) + '\n');
console.log('Packaging snapshot:', data.rows.length, 'daily groups; through', data.sourceEnd);
