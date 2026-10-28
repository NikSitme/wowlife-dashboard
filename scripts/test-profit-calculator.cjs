const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const model=require('./profit-calculator-model');
const near=(a,b)=>assert(Math.abs(a-b)<1e-8,`${a} != ${b}`);
let r=model.calculate({revenue:10000000,margin:40,fixed:3000000});
assert.equal(r.valid,true);assert.equal(r.contribution,4000000);assert.equal(r.profit,1000000);
near(r.fixedPercent,30);near(r.profitPercent,10);assert.equal(r.revenuePercent,100);
r=model.calculate({revenue:'10 000 000,50 ₽',margin:'40,5 %',fixed:'3\u00a0000\u00a0000'});
near(r.contribution,4050000.2025);near(r.profit,1050000.2025);
assert.equal(model.parse(''),NaN);assert.equal(model.parse('abc'),NaN);
assert.equal(model.parse('1.2.3'),NaN);assert.equal(model.parse('12,50'),12.5);
r=model.calculate({revenue:0,margin:40,fixed:120000});
assert.equal(r.profit,-120000);assert.equal(r.contribution,0);
assert.equal(r.profitPercent,null);assert.equal(r.fixedPercent,null);assert.equal(r.revenuePercent,null);
r=model.calculate({revenue:1000,margin:20,fixed:500});
assert.equal(r.profit,-300);near(r.profitPercent,-30);
r=model.calculate({revenue:1000,margin:-10,fixed:100});assert.equal(r.profit,-200,'Negative contribution margin is valid');
r=model.calculate({revenue:1000,margin:100,fixed:0});assert.equal(r.profit,1000);
for(const input of [{revenue:-1,margin:40,fixed:0},{revenue:100,margin:101,fixed:0},{revenue:100,margin:40,fixed:-1},{revenue:'',margin:0,fixed:0},{revenue:Infinity,margin:0,fixed:0},{revenue:100,margin:'NaN',fixed:0}])assert.equal(model.calculate(input).valid,false,JSON.stringify(input));
// Check browser persistence and rendering without any network or CRM dependency.
function element(value=''){return {value,textContent:'',hidden:false,attrs:{},classList:{toggle(){}},events:{},getAttribute(k){return this.attrs[k];},setAttribute(k,v){this.attrs[k]=v;},addEventListener(k,fn){this.events[k]=fn;}};}
const inputs=['revenue','margin','fixed'].map(k=>{const e=element('0');e.attrs['data-profit-input']=k;return e;});
const results=['revenue','margin','fixed','contribution','profit','revenuePercent','fixedPercent','profitPercent'].map(k=>{const e=element();e.attrs['data-profit-result']=k;return e;});
const nodes=Object.fromEntries(['#profitError','.pc-total','#profitPercentNote','#profitEquation','.pc-storage','#profitForm','#profitReset'].map(k=>[k,element()]));
const root={querySelector:k=>nodes[k],querySelectorAll:k=>k==='[data-profit-input]'?inputs:results};
const key='wowlife-profit-calculator-v1',store={[key]:JSON.stringify({revenue:10000000,margin:40,fixed:3000000})};
vm.runInNewContext(fs.readFileSync('scripts/profit-calculator.js','utf8'),{window:{WowlifeProfitCalculator:model},document:{querySelector:()=>root},localStorage:{getItem:k=>store[k],setItem:(k,v)=>store[k]=v},Intl});
assert.equal(inputs[0].value,'10000000');assert(results.find(e=>e.attrs['data-profit-result']==='profit').textContent.includes('1'));
inputs[0].value='20000000';nodes['#profitForm'].events.input();assert.equal(JSON.parse(store[key]).revenue,20000000);
inputs[0].value='';nodes['#profitForm'].events.input();assert.equal(JSON.parse(store[key]).revenue,20000000,'Invalid edit does not overwrite the last valid saved calculation');assert.equal(results[0].textContent,'—');
nodes['#profitReset'].events.click();assert.equal(JSON.parse(store[key]).revenue,0);assert.equal(inputs[1].value,'0');
const html=fs.readFileSync('index.html','utf8');assert(html.includes('data-tab="calculators"'));assert(html.includes('data-panel="calculators"'));
for(const m of html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)){if(m[1].includes('application/json'))JSON.parse(m[2]);else if(m[2].trim())new vm.Script(m[2]);}
console.log('PASS profit calculator: formula, percentages, loss, zero revenue, locale input, validation, storage, reset and dashboard syntax');
