const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const bodies = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(m => m[1]);
const embedded = JSON.parse(bodies.find(s => s.includes('window.__opiuData = DATA;')).match(/var DATA = ([^\n]+);/)[1]);
const definitions = html.slice(html.indexOf('  var OS_PARENTS ='), html.indexOf('  function renderOpiuFullTable('));
const render = html.match(/  function osFillTable\(head, body\)\{[\s\S]*?\n  \}/)[0];
function management(month) {
  const context = { DATA: [month], monthLabel: m => m.label, escapeHtml: s => String(s) };
  vm.runInNewContext(definitions + '\n' + render + '\nvar head={},body={};osFillTable(head,body);result={html:body.innerHTML,unallocated:osUnallocated()};', context);
  const tr = context.result.html.match(/<tr[^>]*><td[^>]*>[^<]*<span[^>]*>[^<]*<\/span>Чистая прибыль[\s\S]*?<\/tr>/)[0];
  const values = [...tr.matchAll(/<td class="num[^>]*>(.*?)<\/td>/g)].map(m => Number(m[1].replace(/[^\d,.-]/g, '').replace(',', '.')) || 0);
  return { value: values[0], unallocated: Array.from(context.result.unallocated) };
}
const base = embedded.find(m => m.label === '2026-09');
const baseline = management(base);
const withPackages = JSON.parse(JSON.stringify(base));
withPackages.rows['Пакеты (списание)'] = -4700;
const changed = management(withPackages);
assert.equal(changed.value, baseline.value - 4700, 'package write-offs must reduce management profit as well as native P&L');
assert.equal(changed.unallocated.includes('Пакеты (списание)'), false);
for (const month of embedded) assert.ok(Math.abs(management(month).value - (month.net_profit - month.dev_services)) <= 0.51, 'management net reconciles with the source and agreed service adjustment: ' + month.label);
console.log('Management P&L: all source months reconcile; package write-offs enter profit once.');
