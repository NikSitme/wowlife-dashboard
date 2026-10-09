const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const html = fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const bodies = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(m=>m[1]);
const embedded = JSON.parse(bodies.find(s=>s.includes('window.__opiuData = DATA;')).match(/var DATA = ([^\n]+);/)[1]);
const september = embedded.find(m=>m.label==='2026-09');
assert.equal(september.source_version,2);
assert.equal(september.source_sheet,'сборка ОПиУ_2');
assert.equal(september.rows['Коробки'],-38380);
assert.equal(september.rows['Шоколадки'],-4545);
assert.equal(september.gross_profit,2483468.54);
assert.equal(september.net_profit,-474283.25);
assert.equal(september.source_warnings.length,0);
assert.equal(embedded.filter(m=>m.source_warnings.some(w=>w.code==='packaging_positive')).length,12);
const num = raw => Number(String(raw||'0').replace(/\s/g,'').replace(',','.'));
for(const month of embedded){
  const row = label => month.source_pl.find(r=>r.label===label);
  assert.equal(num(row('упаковка - коробки').raw),month.rows['Коробки']||0);
  assert.equal(num(row('упаковка - шоколадка').raw),month.rows['Шоколадки']||0);
  assert.equal(num(row('Выручка с НДС').raw),month.revenue_total);
  assert.equal(num(row('маржинальная прибыль').raw),month.gross_profit);
  assert.equal(num(row('чистая прибыль').raw),month.net_profit);
  const breakdown=month.direct_breakdown.reduce((sum,r)=>sum+r.value,0);
  assert.ok(Math.abs(breakdown-month.direct_costs_total)<0.02,'signed expense breakdown must reconcile in '+month.label);
}

// Exercise the actual parser and alias handling using a bounded synthetic sheet.
let updater=bodies.find(s=>s.includes('var ADESK_SOURCE_ID'));
updater=updater.replace('  if (document.readyState === "loading")',
  '  window.sourceTest = {computeOpiu,parseCsv};\n  if (document.readyState === "loading")');
const context={window:{},document:{readyState:'loading',addEventListener(){}},console};
vm.runInNewContext(updater,context);
const api=context.window.sourceTest;
const rows=[['','','','','01.09.2026','01.09.2026']];
for(const item of september.source_pl) rows.push([item.heading?item.label:'',item.heading?'':item.label,'','','',item.raw]);
// Parent totals also reside in column B in the source, even when column A is set.
rows.find(r=>r[0]==='Возвраты')[1]='Возвраты';
const parsed=api.computeOpiu(rows)[0];
assert.equal(parsed.rows['Коробки'],-38380);
assert.equal(parsed.gross_profit,2483468.54);
assert.equal(parsed.net_profit,-474283.25);
const changed=rows.map(r=>r.slice());changed.find(r=>r[1]==='упаковка - коробки')[5]='-48 380,00';
assert.throws(()=>api.computeOpiu(changed),/расхождение сверки/,'unreconciled edits must not silently become a fresh snapshot');
const alteredSigns=rows.map(r=>r.slice());
alteredSigns.find(r=>r[1]==='упаковка - коробки')[5]='38 380,00';
alteredSigns.find(r=>r[0]==='переменные расходы')[5]=String(-september.source_variable_total+76760);
const signData=api.computeOpiu(alteredSigns)[0];
assert.equal(signData.rows['Коробки'],38380,'preserve positive source entries');
assert.equal(signData.source_warnings[0].code,'packaging_positive');

if(process.argv[2]){
  const live=api.parseCsv(fs.readFileSync(process.argv[2],'utf8'));
  for(const month of embedded){
    const col=live[0].findIndex((v,i)=>i>0&&v===month.date.split('-').reverse().join('.')&&live[0][i-1]===v);
    assert.ok(col>=0);
    for(const item of month.source_pl){
      const raw=live[item.key][col]||'';
      if(!item.rate)assert.ok(Math.abs(num(raw)-num(item.raw))<0.02,'native source cell must match '+month.label+' '+item.label);
    }
  }
}
console.log('OПиУ source: current tab, native rows/values/signs, 22 months, packaging aliases, source profit totals, reconciliation failures and positive-cost warnings passed.');
