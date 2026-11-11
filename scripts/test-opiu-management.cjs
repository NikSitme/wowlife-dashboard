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

const grouping={DATA:embedded};
vm.runInNewContext(definitions,grouping);
const blocks=grouping.OS_BLOCKS;
const fot=blocks.find(b=>b.key==='fixed').groups.find(g=>g.label==='ФОТ');
const moved={'Менеджер маркетплейсов':'Маркетплейсы','РОП (перем)':'Отдел заботы','МОП (перем)':'Отдел заботы','СММ менеджер (перем)':'Маркетинг','Блогеры':'Маркетинг'};
const allLeaves=blocks.flatMap(b=>b.groups.flatMap(g=>g.children?g.children.flatMap(c=>Array.from(c.items)):Array.from(g.items)));
for(const [article,department] of Object.entries(moved)){
  assert.equal(allLeaves.filter(s=>s===article).length,1,article+' is counted exactly once');
  assert(fot.children.find(c=>c.label===department).items.includes(article));
  assert(!blocks.find(b=>b.key==='var').groups.some(g=>g.items.includes(article)));
}
assert(!blocks.find(b=>b.key==='fixed').groups.find(g=>g.label==='Расходы каналов маркетплейсов').items.includes('Менеджер маркетплейсов'));
for(let i=0;i<embedded.length;i++){
  const month=embedded[i],fotArticles=fot.children.flatMap(c=>Array.from(c.items));
  const expected=fotArticles.reduce((v,article)=>v+(month.rows[article]||0),0);
  assert(Math.abs(grouping.osGroupVals(fot)[i]-expected)<0.000001,month.label+' payroll subtotal');
}
// A synthetic month checks each moved salary, non-payroll channel costs and
// parent rows: regrouping must leave operating/net profit unchanged.
const fixture={label:'2026-11',rows:{'Wowlife МСК выручка':100000,'Активация':-10000,
 'Менеджер маркетплейсов':-12000,'РОП (перем)':-2000,'МОП (перем)':-3000,'СММ менеджер (перем)':-4000,
 'Самовыкупы м-плейсы':-5000,'Блогеры':-6000,'Отдел м-плейсов':-999999,'ФОТ ОП':-999999,'ФОТ Маркетинга':-999999}};
assert.equal(management(fixture).value,58000);
grouping.DATA=[fixture];
vm.runInNewContext('osExpanded={"block/fixed":true,"fixed/ФОТ":true,"fixed/ФОТ/Отдел заботы":true,"fixed/ФОТ/Маркетинг":true};',grouping);
vm.runInNewContext(render+'\nvar head={},body={};osFillTable(head,body);',Object.assign(grouping,{monthLabel:m=>m.label,escapeHtml:s=>String(s)}));
assert(grouping.body.innerHTML.includes('фиксированная и переменная части'));
assert(grouping.body.innerHTML.includes('Маржинальная прибыль до ФОТ'));
for(const article of Object.keys(moved))assert(grouping.body.innerHTML.includes(article==='Менеджер маркетплейсов'?'Маркетплейсы':article));
console.log('Management payroll: marketplace and variable salaries grouped once by department; all monthly payroll totals and net profit reconciled.');
