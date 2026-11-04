const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const model = require('./sales-analytics-model.js');
const revenue = require('./revenue-dynamics.js');
const { parseCsv } = require('./build-revenue-timeline.cjs');

function computeSnapshots(directory, html) {
  let source = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].find(m => m[1].includes('var ADESK_SOURCE_ID'))[1];
  source = source.replace('  if (document.readyState === "loading")', '  window.builder = { computeOpiu, computeSalesAct, computeWowsales, marketplaceRowsWithHistory };\n  if (document.readyState === "loading")');
  const context = { window: { SalesAnalytics: model }, document: { readyState: 'loading', addEventListener() {} }, console };
  vm.runInNewContext(source, context);
  const read = name => parseCsv(fs.readFileSync(path.join(directory, name + '.csv'), 'utf8').replace(/^\uFEFF/, ''));
  const api = context.window.builder;
  const opiuSource = read('opiu'), history = read('marketplaces-2025');
  const marketing = read('marketing'), activations = read(fs.existsSync(path.join(directory, 'activations-full.csv')) ? 'activations-full' : 'activations');
  const transactions = read('transactions'), marketplaces = api.marketplaceRowsWithHistory(read('marketplaces'), history);
  const opiu = api.computeOpiu(opiuSource, history);
  const stamp = fs.statSync(path.join(directory, 'opiu.csv')).mtime.toISOString();
  opiu.forEach(m => { m.source_fetched_at = stamp; });
  return {
    opiu,
    salesact: api.computeSalesAct(marketing, activations),
    wowsales: api.computeWowsales(read('catalog'), transactions, marketplaces, activations),
    revenueTimeline: revenue.fromRows(transactions, marketplaces, model.today()),
    packaging: model.packaging(marketing)
  };
}

if (require.main === module) {
  const directory = process.argv[2];
  if (!directory) throw new Error('Usage: node scripts/build-finance-snapshot.cjs directory-with-source-csvs');
  const root = path.join(__dirname, '..'), file = path.join(root, 'index.html');
  let html = fs.readFileSync(file, 'utf8');
  const data = computeSnapshots(directory, html);
  const inlineJson = value => JSON.stringify(value).replace(/</g, '\\u003c');
  html = html.replace(/const DATA = ([^\n]+);/, () => 'const DATA = ' + inlineJson(data.salesact) + ';');
  html = html.replace(/  var DATA = ([^\n]+);/, () => '  var DATA = ' + inlineJson(data.opiu) + ';');
  for (const [id, key] of [['ws-dashboard-data', 'sales'], ['ws-dashboard-data-activations', 'activations'], ['ws-dashboard-data-partners', 'partners']]) {
    const regex = new RegExp('(<script[^>]*id="' + id + '"[^>]*>)[\\s\\S]*?(</script>)');
    html = html.replace(regex, (_, start, end) => start + inlineJson(data.wowsales[key]) + end);
  }
  fs.writeFileSync(file, html);
  fs.writeFileSync(path.join(root, 'data', 'revenue-timeline.json'), JSON.stringify(data.revenueTimeline) + '\n');
  fs.writeFileSync(path.join(root, 'data', 'packaging-sales.json'), JSON.stringify(data.packaging) + '\n');
  console.log('Finance snapshots:', data.opiu.length, 'months;', data.wowsales.sales.rows.length, 'financial groups; CRM through', data.salesact.meta.end);
}
module.exports = { computeSnapshots };
