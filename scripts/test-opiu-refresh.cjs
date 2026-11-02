const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const html = fs.readFileSync(require('node:path').join(__dirname, '..', 'index.html'), 'utf8');
const scripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(m => m[1]);
const september = JSON.parse(scripts.find(s => s.includes('window.__opiuData = DATA;')).match(/var DATA = ([^\n]+);/)[1]).find(m => m.label === '2026-09');
const rows = [['','','','','01.09.2026','01.09.2026','01.10.2026','01.10.2026']];
for (const item of september.source_pl) rows.push([item.heading ? item.label : '',item.heading ? '' : item.label,'','','',item.raw,'',item.raw]);
rows.find(r => r[0] === 'Возвраты')[1] = 'Возвраты';
const csv = rows.map(r => r.map(v => '"' + String(v).replace(/"/g, '""') + '"').join(',')).join('\n');
const cachedOpiu = [{label:'2026-09',revenue_total:september.revenue_total*4,source_version:2}];
let cached = {opiu:cachedOpiu,opiuTree:{old:['old']},ops:[['2026-09-01','old',1]]};
let applied = false;
const context = {
  window:{__opiuData:cachedOpiu,__opiuSetData(){applied=true;},__marketingSetData(){}},
  document:{readyState:'loading',addEventListener(){}},console,
  localStorage:{getItem(){return JSON.stringify(cached);},setItem(key,value){cached=JSON.parse(value);}},
  async fetch(url){return {ok:true,async text(){return url.includes('gid=1095006698') ? csv : 'header\nvalue';},async json(){return null;}};}
};
let updater=scripts.find(s=>s.includes('var ADESK_SOURCE_ID'));
updater=updater.replace('  if (document.readyState === "loading")',
  '  window.refreshTest=runUpdate; computeMarketing=function(){return {deals:1,contacts:1,lastDate:"2026-10-01"};};\n  if (document.readyState === "loading")');
vm.runInNewContext(updater,context);
(async()=>{
  const button={disabled:false,textContent:'Обновить данные'},status={};
  await context.window.refreshTest(button,status);
  assert.equal(applied,false,'a failed completeness check cannot update the visible OПиУ');
  assert.deepEqual(cached.opiu,cachedOpiu,'a successful other section cannot cache the rejected OПиУ');
  assert.deepEqual(cached.opiuTree,{old:['old']});
  assert.deepEqual(cached.ops,[['2026-09-01','old',1]]);
  assert.match(status.textContent,/частично/);
  assert.match(status.textContent,/Не обновлено: ОПиУ/,'the failed section must be visible without hovering');
  assert.match(status.title,/выручка меньше половины/);
  assert.equal(button.disabled,false);
  console.log('Refresh: rejected OПиУ stays out of UI/cache, other sections can update, failed section and reason remain visible.');
})().catch(e=>{console.error(e);process.exitCode=1;});
