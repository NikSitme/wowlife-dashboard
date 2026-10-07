const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
let source = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)]
  .find(match => match[1].includes('var ADESK_SOURCE_ID'))[1];
source = source.replace('  if (document.readyState === "loading")',
  '  window.historyTest = { withMarketplaceRevenue2025, marketplaceRowsWithHistory, computeOpiu, parseCsv };\n  if (document.readyState === "loading")');
const context = { window: {}, document: { readyState: 'loading', addEventListener() {} }, console };
vm.runInNewContext(source, context);
const api = context.window.historyTest;

const header = ['','','','', '01.01.2025','01.01.2025', '01.12.2025','01.12.2025', '01.01.2026','01.01.2026'];
const rows = [header];
for (const [platform, prefix] of [['ВБ','ВБ '],['ОЗОН','ОЗОН'],['ЯМ','ЯМ'],['Flowwow_СПБ','Flowwow_СПБ'],['Flowwow_МСК','Flowwow_МСК']]) {
  for (const [city, suffix] of [['Санкт-Петербург','СПБ'],['Москва','МСК']]) {
    if (platform.startsWith('Flowwow_') && !platform.endsWith(suffix)) continue;
    const label = platform.startsWith('Flowwow_') ? 'Выручка ' + platform : 'Выручка ' + prefix + ' ' + suffix;
    rows.push(['',label,platform,city,'999','0','999','0','999','700']);
  }
}
const totals = ['Выручка с НДС','маржинальная прибыль','валовая прибыль','Операционная прибыль','чистая прибыль','прибыль после выплаты тела кредита и дивидендов'];
for (const label of totals) rows.push([label,'','','','999','1000','999','2000','999','9000']);
rows.push(['','Расходы ВБ','','','999','-400','999','-500','999','-600']);
rows.push(['','НДС по маркетплейсам','','','999','-50','999','-70','999','-90']);
for (const row of rows.slice(1, 9)) row[3] = ''; // gviz omits mixed-type city metadata.
const history = [
  ['Дата операции','Цена розничная','','','','город','ВБ()'],
  ['01.01.2025','100,50','','','','Москва','ОЗОН'],
  ['02.01.2025','200','','','','Санкт-Петербург','ВБ'],
  ['03.01.2025','-20','','','','Москва','ОЗОН'],
  ['31.12.2025','1 000,25','','','','Москва','ОЗОН'],
  ['01.01.2024','99999','','','','Москва','ОЗОН'],
  ['01.01.2026','99999','','','','Москва','ОЗОН']
];
const before = JSON.stringify(rows);
const patched = api.withMarketplaceRevenue2025(rows, history);
assert.equal(JSON.stringify(rows), before, 'source data must remain unchanged');
for (let i = 0; i < rows.length; i++) {
  assert.equal(patched[i][4], rows[i][4], 'plan cells must remain unchanged');
  assert.equal(patched[i][9], rows[i][9], '2026 must remain unchanged');
}
for (const label of totals) {
  const row = patched.find(row => row[0] === label);
  assert.equal(row[5], '1280.50', 'January income delta must reach every profit total');
  assert.equal(row[7], '3000.25', 'December must include the final day of 2025');
}
assert.equal(patched.find(row => row[1] === 'Выручка ОЗОН МСК')[5], '80.50', 'refunds must retain their sign');
assert.deepEqual(patched.at(-2), rows.at(-2), 'costs must not be added a second time');
assert.deepEqual(patched.at(-1), rows.at(-1), 'existing taxes must not be recalculated');
assert.equal(JSON.stringify(api.withMarketplaceRevenue2025(patched, history)), JSON.stringify(patched), 'refresh must not double count historical revenue');
assert.throws(() => api.withMarketplaceRevenue2025(rows, null), /маркетплейсы-25/, 'missing history must fail rather than publish zero revenue');
const current = [history[0], ['01.01.2025','777','','','','Москва','ОЗОН'], ['01.01.2026','123','','','','Москва','ОЗОН']];
const merged = api.marketplaceRowsWithHistory(current, history);
assert.equal(merged.filter(row => row[0] === '01.01.2026').length, 1, '2026 must come only from the current sheet');
assert.equal(merged.some(row => row[1] === '777'), false, '2025 is replaced by its historical source');
assert.equal(merged.some(row => row[0] === '01.01.2024'), false, 'the exception must not import 2024');
console.log('Marketplace history: year boundaries, refunds, income/profit totals, unchanged costs/taxes/2026, idempotence and missing-history checks passed.');

// Optional integration check against downloaded live source CSVs.
if (process.argv.length === 4) {
  const raw = api.parseCsv(fs.readFileSync(process.argv[2], 'utf8').replace(/^\uFEFF/, ''));
  const historical = api.parseCsv(fs.readFileSync(process.argv[3], 'utf8').replace(/^\uFEFF/, ''));
  const actual = api.computeOpiu(raw, historical);
  const baselineRows = raw.map(row => row.slice());
  baselineRows[0] = baselineRows[0].map(value => /\.2025$/.test(value) ? '' : value);
  const baseline = api.computeOpiu(baselineRows);
  assert.equal(JSON.stringify(actual.filter(month => !month.label.startsWith('2025'))), JSON.stringify(baseline), 'all fields of all 2026 months must remain identical');
  const year = actual.filter(month => month.label.startsWith('2025'));
  assert.equal(year.length, 12);
  const expected = historical.slice(1).filter(row => /^\d{2}\.\d{2}\.2025$/.test(row[0]) && ['Москва','Санкт-Петербург'].includes(row[5]) && ['ВБ','ОЗОН','ЯМ','Flowwow_СПБ','Flowwow_МСК'].includes(row[6]))
    .reduce((sum,row) => sum + Number(row[1].replace(/\s/g, '').replace(',', '.')), 0);
  const revenue = year.reduce((sum, month) => sum + month.revenue_breakdown.filter(item => /^Выручка (ВБ|ОЗОН|ЯМ|Flowwow_)/.test(item.name)).reduce((a,item) => a + item.value, 0), 0);
  assert.ok(Math.abs(revenue - expected) < 0.01, '2025 revenue must match an independent sum of historical operations');
  console.log(JSON.stringify({ months2025: year.length, marketplaceRevenue2025: revenue, totalRevenue2025: year.reduce((sum, month) => sum + month.revenue_total, 0) }));
}
