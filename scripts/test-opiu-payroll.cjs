const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const payroll = require('./opiu-payroll.js');
const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
const data = JSON.parse(html.match(/var DATA = (\[{"date"[^\n]+);/)[1]);
const pick = (a,n) => (a||[]).find(x=>x.name===n)?.value || 0;
const sumItems = a => a.reduce((s,x)=>s+x.value,0);
const close = (a,b,msg) => assert(Math.abs(a-b)<0.001,msg);
const context = {window:{OpiuPayroll:payroll}, DATA:data, pick, sumItems,
  sumPick:(a,ns)=>ns.reduce((s,n)=>s+pick(a,n),0), opiuMonth:ym=>data.find(m=>m.label===ym)};
vm.createContext(context);
const take = (a,b)=>html.slice(html.indexOf(a),html.indexOf(b,html.indexOf(a)));
vm.runInContext(take('  var DELIV = [','  function avgDecomp('),context);
vm.runInContext(take('  var ADV = [','  function siteMargin('),context);
vm.runInContext(take('  function mergeBreakdown(','  // ---------- KPI tiles'),context);
vm.runInContext(take('  var EXPENSE_GROUPS = [','  function expenseMoMPct('),context);
const snapshot=JSON.stringify(data);
for(const m of data){
  const view=payroll.withCreators(m), amount=-(m.rows['Блогеры']||0);
  close(view.personnel_total,m.personnel_total+amount,m.label+' payroll');
  close(view.indirect_total,m.indirect_total-amount,m.label+' indirect');
  close(view.personnel_total+view.indirect_total,m.personnel_total+m.indirect_total,m.label+' total');
  assert.equal(view.net_profit,m.net_profit);
  assert.equal(payroll.withCreators(view),view,'idempotent');
  const model=context.decompose(m),marketing=context.expenses(m.label);
  close(model.fot,view.personnel_total,'model payroll');
  close(sumItems(model.children.fot),model.fot,'model payroll detail');
  close(sumItems(model.children.marketing),model.marketing,'model marketing detail');
  close(model.marketing,context.MKT.reduce((s,n)=>s+pick(m.indirect_breakdown,n),0)-amount,'model advertising');
  assert(!model.children.marketing.some(x=>x.name==='Блогеры'));
  close(marketing.advT,pick(view.indirect_breakdown,'Закупка рекламы'),'marketing advertising total');
  close(marketing.fotT,pick(view.personnel_breakdown,'ФОТ Маркетинга'),'marketing payroll total');
}
for(let a=0;a<data.length;a++)for(let b=a;b<data.length;b++){
  const months=data.slice(a,b+1), agg=context.aggregateMonths(months);
  close(agg.personnel_total+agg.indirect_total,months.reduce((s,m)=>s+m.personnel_total+m.indirect_total,0),'range total');
}
const october=data.find(m=>m.label==='2026-10'),view=payroll.withCreators(october);
assert.equal(pick(view.personnel_breakdown,'ФОТ Маркетинга'),320640);
assert.equal(pick(view.indirect_breakdown,'Закупка рекламы'),280000);
const groups=context.expenseGroupsRaw(context.aggregateMonths([october]));
assert.equal(groups.find(g=>g.label==='Маркетинг').total,305822);
assert.equal(context.expenses('2026-10').fot.find(x=>x.name==='Блогеры').value,136240);
assert.equal(JSON.stringify(data),snapshot,'raw source and embedded P&L unchanged');
const missing={personnel_total:100,indirect_total:20,personnel_breakdown:[],indirect_breakdown:[{name:'Закупка рекламы',value:20}]};
assert.equal(payroll.withCreators(missing),missing,'no invented split without source detail');
const relocated={...october,source_pl:[{label:'ФОТ Маркетинга'},{label:'Блогеры'}]};
assert.equal(payroll.withCreators(relocated),relocated,'source already in payroll');
const refund={...missing,rows:{'Блогеры':10}};
assert.equal(payroll.withCreators(refund).personnel_total,90,'refund keeps source sign');
// Daily allocation must transfer the same amount already contained in the range.
vm.runInContext(take('  function dailyAvailable()','  function currentAgg()'),context);
context.OPS_INDEX={};context.OPS_TREE={};context.decorateMonths=()=>{};
const range=context.buildRangeAgg('2026-10-01','2026-10-31');
close(range.personnel_total,view.personnel_total,'full month/day parity');
const half=context.buildRangeAgg('2026-10-01','2026-10-10');
close(half.personnel_total,view.personnel_total*10/31,'partial period');
console.log(`Creator payroll: ${data.length} months, all ranges, source preservation, payroll/marketing/model/detail reconciliation and daily allocation passed.`);
