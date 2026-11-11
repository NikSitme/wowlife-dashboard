const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const model=require('./pricing-model.js');
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
const defaults={act:60,acq:2,tax:7,pack:50,logistics:100,disc:10,target:40,fixed:5,ret:90};
const modes={pack:'rub',logistics:'rub'};
let p=model.parameters(defaults,modes,{}),r=model.calculate(2000,1000,p);
near(r.price,1800);near(r.V,312);near(r.mpAct,1200);near(r.npAct,798);
near(r.partnerShare,1000/1800);near(r.partnerForecast,600);
near(r.mpAct,r.price-r.partnerForecast);
near(r.npAct,r.mpAct-r.V-r.price*p.fP-p.fR);
// The reported screenshot: margin excludes only partner; all other costs are deducted once in net profit.
const screenshotParams=model.parameters({act:100,acq:516,tax:0,pack:69,logistics:143,disc:0,target:40,fixed:0},{acq:'rub',pack:'rub',logistics:'rub'},{});
const screenshot=model.calculate(5736,4675,screenshotParams);
near(screenshot.mpAct,1061);near(screenshot.npAct,333);
const costChanged=model.calculate(5736,4675,model.parameters({act:100,acq:999,tax:0,pack:999,logistics:999,disc:0,target:40,fixed:0},{acq:'rub',pack:'rub',logistics:'rub'},{}));
near(costChanged.mpAct,1061);assert(costChanged.target>screenshot.target);near(model.calculate(screenshot.target,4675,screenshotParams).npAct,0);assert.notEqual(costChanged.npAct,screenshot.npAct);
near(model.calculate(r.target,1000,p).npAct,0);
// Worst case always activates every certificate and pays the most expensive service.
const originalP=p;
const worst=model.worstCase(2000,1000,p);
near(worst.partnerForecast,1000);near(worst.mpAct,800);near(worst.npAct,398);
near(worst.p.a,1);near(p.a,.6);assert.equal(originalP,p);
near(model.worstCase(worst.target,1000,p).npAct,0);
const lowerForecast=model.parameters(defaults,modes,{partner:{mode:'rub',value:100}});
near(model.worstCase(2000,1000,lowerForecast).exp,1000);
assert.equal(model.worstCase(2000,null,lowerForecast).mAct,null);
// Row overrides use the correct base, preserve zero, and do not change global inputs.
p=model.parameters(defaults,modes,{disc:{mode:'pct',value:0},logistics:{mode:'rub',value:0},acq:{mode:'rub',value:40}});
r=model.calculate(2000,1000,p);near(r.price,2000);near(r.expenses.logistics,0);near(r.expenses.acq,40);near(r.mpAct,1400);
assert.equal(defaults.logistics,100);assert.equal(defaults.disc,10);
// With a percentage payout and no other cost in margin, changing price cannot change the margin.
p=model.parameters(defaults,modes,{partner:{mode:'pct',value:70}});r=model.calculate(2000,1000,p);
near(r.exp,1260);near(model.calculate(r.target,1000,p).npAct,0);near(r.mAct,.58);
p=model.parameters(defaults,modes,{disc:{mode:'pct',value:100}});r=model.calculate(2000,1000,p);
assert.equal(r.price,0);assert.equal(r.mAct,null);assert.equal(r.target,null);
assert.equal(model.calculate(2000,null,model.parameters(defaults,modes,{})).mpAct,null);
const absentPrice=model.calculate(null,1000,model.parameters(defaults,modes,{}));
assert.equal(absentPrice.price,null);assert.equal(absentPrice.discount,null);assert.equal(absentPrice.mpAct,null);assert.equal(absentPrice.npAct,null);assert.equal(absentPrice.expenses.acq,null);
near(absentPrice.partnerForecast,600);
// Default logistics sums delivery articles, without adding marketplace expense totals.
const fact=model.defaults([{label:'2026-09',revenue_total:2000,revenue_breakdown:[{name:'Wowlife МСК выручка',value:1000}],direct_breakdown:[{name:'Эквайринговая комиссия',value:-20},{name:'Создание продукта',value:30},{name:'Доставка',value:10},{name:'Доставка Далли',value:40},{name:'Доставка СДЭК',value:5},{name:'Расходы ОЗОН',value:999}],personnel_total:100}]);
near(fact.acq,2);near(fact.pack,3);near(fact.logistics,5.5);assert.equal(fact.ret,undefined);
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
let body=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(x=>x[1]).find(s=>s.includes('var STORE_KEY = "wowlife-pricing-v1"'));
body=body.replace('\n  load();\n','\n  window.pricingTest={state,load,save,usagePercent,ensureParams,packagingSummary,syncPackaging,packagingMarkup,targetProposal,targetCell,useTargetPrice,P,calcService,calcSet,calcItem,allSets,serviceOf,financialCells,pricingHead,colCount,exportCsv,rowParameterValue,tableMarkup,collectionRow,financialGetters,sortBy,setCommissions:function(rows,prices){commissionIndex=STRUCTURE.index(rows,prices);},setData:function(c,a){CRM=c;ACT=a;}};return;\n  load();\n');
const stub={addEventListener(){},querySelector(){return stub;}};
let exportedCsv='',savedPricing=null;
const context={localStorage:{getItem(){return savedPricing;},setItem(k,v){savedPricing=v;}},Blob:class{constructor(parts){exportedCsv=parts.join('');}},URL:{createObjectURL(){return 'blob:test';},revokeObjectURL(){}},setTimeout(fn){fn();},window:{addEventListener(){},WowlifePriceStructure:require('./price-structure'),WowlifePricing:model,WowlifePricingCatalog:require('./pricing-catalog'),WowlifeServiceCatalog:require('./service-catalog'),__opiuData:[]},document:{querySelector(){return stub;},addEventListener(){},createElement(){return {click(){}};}},console};
vm.runInNewContext(body,context);
const t=context.window.pricingTest;
t.state.params={...defaults};t.state.pmode={...modes,ret:'rub'};t.ensureParams();
assert.equal(t.state.params.ret,undefined);assert.equal(t.state.pmode.ret,undefined);
assert.equal(t.state.params.logistics,100);t.state.params.logistics=undefined;t.ensureParams();assert.equal(t.state.params.logistics,0);
t.state.params={...defaults};t.state.pmode={...modes};t.ensureParams();
t.setData({catalog:{a:{sid:'a',name:'A',partner:'One',city:'Мск',price:2000,cost:1000},b:{sid:'b',name:'B',partner:'Two',city:'Мск',price:1500,cost:500}},sets:[{id:'x',name:'Set',city:'Мск',price:2000,items:[{sid:'a',price:2000,cost:1000},{sid:'b',price:1500,cost:500}]}]},{counts:{'Мск':{One:3,Two:1}}});
let set=t.allSets()[0];near(t.calcSet(set).exp,750);
assert.equal(t.calcSet(set).m100,undefined);assert.equal(t.calcSet(set).mp100,undefined);
t.state.mode='max';t.state.usageMode='full';near(t.calcSet(set).exp,1000);
near(t.calcSet(set).partnerForecast,1000);near(t.calcSet(set).p.a,1);
near(t.calcSet(set).mpAct,1000);near(t.calcSet(set).npAct,570);
near(t.calcSet(set).mAct,.5);assert.equal(t.state.params.act,60);
t.state.rowParams['set:x']={partner:{mode:'rub',value:100}};
near(t.calcSet(set).exp,1000);delete t.state.rowParams['set:x'];
t.state.mode='act';t.state.usageMode='custom';near(t.calcSet(set).exp,875);
assert.equal(t.calcSet(set).mp100,undefined);
t.state.rowParams['set:x']={logistics:{mode:'rub',value:0},disc:{mode:'pct',value:0}};
let calc=t.calcSet(set);near(calc.price,2000);near(calc.expenses.logistics,100);
near(t.calcItem(set,set.items[0],calc).price,2000);
near(t.calcItem(set,set.items[0],calc).expenses.logistics,100);
t.state.params.logistics=200;near(t.calcSet(set).expenses.logistics,200);near(t.calcService(t.serviceOf('a')).expenses.logistics,200);
delete t.state.rowParams['set:x'];near(t.calcSet(set).expenses.logistics,200);
t.state.sov.a={price:2500,cost:1200};assert.equal(t.serviceOf('a').basePrice,2000);assert.equal(t.serviceOf('a').price,2500);near(t.allSets()[0].items[0].cost,1200);
// Group headers, body cells and composition use exactly the same column count.
set=t.allSets()[0];calc=t.calcSet(set);
const cells=t.financialCells(set,calc,{key:'set:x',kind:'set'});
assert.equal((cells.match(/<td /g)||[]).length+4,t.colCount());
assert.equal((t.pricingHead('set').match(/data-tip=/g)||[]).length,0);
assert(t.pricingHead('set').includes('Активации<small>12 мес.</small>'));
t.state.collapsed.price=true;assert.equal((t.financialCells(set,calc,{key:'set:x',kind:'set'}).match(/<td /g)||[]).length+4,t.colCount());
t.state.sov.a.cost=0;assert.equal(t.calcService(t.serviceOf('a')).exp,0);assert.notEqual(t.calcService(t.serviceOf('a')).mpAct,null);
t.state.mode='avg';near(t.calcSet(t.allSets()[0]).exp,250);
// Forecast applies to standalone services too, without a parallel worst column.
const svc={sid:'forecast',name:'Example',price:2000,cost:1000,costKnown:true};
t.state.params.act=60;t.state.params.disc=0;t.state.params.logistics=0;
t.state.mode='avg';near(t.calcService(svc).partnerForecast,600);near(t.calcService(svc).mpAct,1400);
t.state.mode='max';t.state.usageMode='full';near(t.calcService(svc).partnerForecast,1000);near(t.calcService(svc).mpAct,1000);near(t.calcService(svc).mAct,.5);
assert.equal(t.state.params.act,60,'Worst forecast must not overwrite the planned activation percentage');
t.state.rowParams['service:forecast']={partner:{mode:'rub',value:1200}};near(t.calcService(svc).partnerForecast,1200);near(t.calcService(svc).mpAct,800);
t.state.mode='avg';t.state.usageMode='custom';near(t.calcService(svc).partnerForecast,720);near(t.calcService(svc).mpAct,1280);
t.state.sort.k='m100';t.ensureParams();assert.equal(t.state.sort.k,'m');
assert(!html.includes("['m100'"));assert(!html.includes('Худший, %'));assert(!html.includes('Маржа при 100% (набор'));
const modeMarkup=html.slice(html.indexOf('id="prModeGroup"'),html.indexOf('<div class="pr-scroll"',html.indexOf('id="prModeGroup"')));
assert(modeMarkup.includes('id="prActivation"')&&modeMarkup.includes('id="prMode"')&&modeMarkup.includes('id="prUsageMode"'),'Independent usage and payout controls are visible');
assert(!html.includes('root.querySelector("#prModeGroup").hidden'),'Forecast is visible in every pricing view');
console.log('PASS pricing: discounts, expenses, target price, defaults, migration, row inheritance, CRM proposals, forecasts, composition and headers');

t.setCommissions([{id:'1',name:'One',type:'\u041f\u0430\u0440\u0442\u043d\u0435\u0440',terms:'20%'}]);
t.state.mode='avg';t.state.params.act=60;t.state.sov.a.cost=1200;const structureSvc=t.calcService(t.serviceOf('a'));
near(structureSvc.structure.open,1500);near(structureSvc.structure.markup,1000);near(structureSvc.structure.commission,300);near(structureSvc.partnerForecast,720);
near(structureSvc.structure.price,structureSvc.structure.markup+structureSvc.structure.commission+structureSvc.exp);
console.log('PASS structure integration: inherited commissions do not change activation forecasts or profit');

t.state.view='services';t.exportCsv();const exportLines=exportedCsv.trim().split('\n');assert.equal(exportLines.length,3);assert.equal(exportLines[0].split(';').length,26);assert.equal(exportLines[1].split(';').length,26);console.log('PASS pricing CSV: full filtered selection and 26 aligned columns');

const commissionsData=require('../data/partner-commissions.json'),confirmedPrices=require('../data/partner-open-prices.json');
t.setCommissions(commissionsData.companies,confirmedPrices.prices);const trainer=commissionsData.companies.find(c=>c.id==='372').name;
t.setData({catalog:{'10884':{sid:'10884',name:'Snowboard',partner:trainer,city:'Msk',price:9000,cost:4400}},sets:[{id:'refset',name:'Set',city:'Msk',price:9000,items:[{sid:'10884',name:'Snowboard',price:9000,cost:4300}]}]});
let refSvc=t.serviceOf('10884');near(refSvc.cost,4400);near(t.calcService(refSvc).structure.open,4400/.9);near(t.calcSet(t.allSets()[0]).exp,4300);near(t.calcItem(t.allSets()[0],t.allSets()[0].items[0],t.calcSet(t.allSets()[0])).structure.open,4300/.9);assert(!t.calcService(refSvc).structure.mismatch);near(model.calculate(t.calcService(refSvc).target,4400,t.calcService(refSvc).p).npAct,0);near(t.calcService(refSvc).mpAct,9000-4400*t.state.params.act/100);
t.state.sov['10884']={cost:4444};refSvc=t.serviceOf('10884');near(refSvc.cost,4444);near(t.calcService(refSvc).structure.open,4444/.9);assert.equal(t.calcService(refSvc).structure.derived,true);
console.log('PASS source costs: standalone and composition use their own table costs, confirmed open price does not override costs, conflicts and manual edits preserved');

// The displayed target covers all costs at the selected forecast, without a commission rule.
t.state.sov['10884']={cost:4860};t.state.params.disc=0;t.state.params.act=60;
refSvc=t.serviceOf('10884');let policy=t.calcService(refSvc);
near(model.calculate(policy.target,4860,policy.p).npAct,0);
const target60=policy.target;t.state.params.act=10;assert(t.calcService(refSvc).target<target60);
t.state.usageMode='full';assert(t.calcService(refSvc).target>target60);
near(model.calculate(t.calcService(refSvc).target,4860,t.calcService(refSvc).p).npAct,0);
t.state.mode='avg';t.state.usageMode='custom';
for(const c of [t.calcSet(t.allSets()[0]),t.calcItem(t.allSets()[0],t.allSets()[0].items[0],t.calcSet(t.allSets()[0]))])near(model.calculate(c.target,c.exp,c.p).npAct,0);
t.state.params.target=40;t.ensureParams();assert.equal(t.state.params.target,undefined);
const policyHeaders=t.pricingHead('service');assert(policyHeaders.indexOf('data-prgroup="commission"')<policyHeaders.indexOf('data-prgroup="markup"'));
assert(policyHeaders.includes('Целевая цена'));assert(!policyHeaders.includes('Наша комиссия'));
assert(!html.includes('data-rule-service'));assert(!html.includes('data-apply='));
assert(!html.includes('Цена по правилу'));assert(!html.includes('Правило цены'));
t.state.collapsed.commission=true;const policyCells=t.financialCells(refSvc,policy,{key:'service:10884',kind:'service'});
assert(policyCells.includes('data-price-component="commissionPct"'));assert(policyCells.includes('data-price-component="commissionRub"'));
console.log('PASS target integration: all costs, forecast, service/set/composition, no automatic price application or obsolete rule');
// Sort actual numbers, not formatted strings; percentages and rubles are separate fields.
t.setCommissions([{id:'10',name:'Ten',type:'Партнер',terms:'10%'},{id:'20',name:'Twenty',type:'Партнер',terms:'20%'}]);
t.state.params.act=60;t.state.params.disc=0;t.state.rowParams={};
const sortRows=[{sid:'a',name:'A',basePrice:6000,price:6000,cost:4500,partner:'Ten'},{sid:'b',name:'B',basePrice:1400,price:1400,cost:800,partner:'Twenty'},{sid:'c',name:'C',basePrice:1800,price:1800,cost:900,partner:'Unknown'}];
const sortCalc=Object.fromEntries(sortRows.map(s=>[s.sid,t.calcService(s)])),getters=t.financialGetters(sortCalc,'sid');
const order=(key,d=1)=>Array.from(t.sortBy(sortRows,getters,{k:key,d}),s=>s.sid);
assert.deepEqual(order('commissionPct'),['a','b','c']);assert.deepEqual(order('commissionPct',-1),['b','a','c']);
assert.deepEqual(order('commissionRub'),['b','a','c']);assert.deepEqual(order('commissionRub',-1),['a','b','c']);
assert.deepEqual(order('markupRub'),['b','a','c']);assert.deepEqual(order('markupPct'),['a','b','c']);
assert.deepEqual(order('openRub'),['b','a','c']);assert.deepEqual(order('openRub',-1),['a','b','c']);
assert.deepEqual(order('partnerFull'),['b','c','a']);assert.deepEqual(order('acqRub'),['b','c','a']);
const sortableKeys=['commissionPct','commissionRub','markupRub','markupPct','openRub','current','discount','partnerPct','partnerForecast','acqPct','acqRub','taxPct','taxRub','packPct','packRub','logisticsPct','logisticsRub','npRub'];
t.state.collapsed={};const expandedHeaders=t.pricingHead('service');
for(const key of sortableKeys)assert(expandedHeaders.includes('data-s="'+key+'"'),key+' must have a sortable header');
const nestedHeaders=t.pricingHead('item',true);assert(nestedHeaders.includes('data-item-s="commissionPct"'));assert(nestedHeaders.includes('data-item-s="weight"'));assert(!/\sdata-s=/.test(nestedHeaders));
t.state.collapsed={commission:true,markup:true,open:true,fees:true,pack:true,logistics:true};const foldedHeaders=t.pricingHead('service');
for(const key of ['commissionPct','commissionRub','markupRub','openRub','feesSum','packRub','logisticsRub'])assert(foldedHeaders.includes('data-s="'+key+'"'),key+' remains sortable while folded');
console.log('PASS numeric sorting: commission percent/rubles, markup, cost, expenses, both directions, unknowns last and separate composition headers');

// Coverage target handles mixed percentage/ruble costs, both discount modes, payout overrides and impossible economics.
for(const discMode of ['pct','rub']){
  const x=model.parameters({act:60,acq:2,tax:7,pack:50,logistics:100,disc:discMode==='pct'?10:200,fixed:300,target:99},{pack:'rub',logistics:'rub',fixed:'rub',disc:discMode},{});
  const target=model.targetPrice(1000,x);
  const expectedNet=(600+50+100+300)/.91;
  near(target,(expectedNet+x.discR)/(1-x.discP));
  near(model.calculate(target,1000,x).npAct,0);
}
const plain={act:100,acq:0,tax:0,pack:0,logistics:0,disc:0,fixed:0};
near(model.targetPrice(1000,model.parameters(plain,{},{})),1000);
assert.equal(model.targetPrice(null,model.parameters(plain,{},{})),null);
near(model.targetPrice(0,model.parameters(plain,{},{})),0);
const tooMuch=model.parameters({...plain,tax:60,fixed:40},{},{});
assert.equal(model.targetPrice(1000,tooMuch),null);
assert.equal(model.targetPrice(1000,model.parameters({...plain,disc:100},{},{})),null);
assert.equal(model.targetPrice(1000,model.parameters({...plain,tax:20},{},{partner:{mode:'pct',value:80}})),null);
const pctP=model.parameters({...plain,act:60,pack:200,fixed:10},{pack:'rub'},{partner:{mode:'pct',value:50}});
near(model.targetPrice(null,pctP),200/(1-.3-.1));
near(model.calculate(model.targetPrice(null,pctP),null,pctP).npAct,0);
t.state.sov={};t.state.ov={};t.state.rowParams={};t.state.customServices={};t.state.customSets=[];
t.setData({catalog:{known:{sid:'known',name:'Known',city:'Мск',price:5000,cost:1000},unknown:{sid:'unknown',name:'Unknown',city:'Мск',price:5000,cost:0,costKnown:false}},sets:[{id:'mixed',city:'Мск',name:'Mixed',price:5000,items:[{sid:'known',cost:1000},{sid:'unknown',cost:0}]}]});
assert.equal(t.calcSet(t.allSets()[0]).target,null,'partial set costs cannot produce a misleading coverage target');
assert.equal(t.calcService(t.serviceOf('unknown')).target,null);
assert.notEqual(t.calcService(t.serviceOf('known')).target,null,'known payout does not require a known commission to calculate coverage');
console.log('PASS coverage edge cases: mixed costs, discounts, percent payout, unknown and partial costs, impossible economics');

// Clearing a row discount commits zero even if the inherited discount is nonzero.
assert.equal(t.rowParameterValue("20","disc","pct"),20);
assert.equal(t.rowParameterValue("","disc","pct"),0);
assert.equal(t.rowParameterValue("","pack","rub"),null);
assert.equal(t.rowParameterValue("-1","disc","pct"),null);
const discountParams={act:100,acq:0,tax:0,pack:0,logistics:0,disc:50,fixed:0};
near(model.calculate(5979,1000,model.parameters(discountParams,{}, {disc:{mode:"pct",value:t.rowParameterValue("20","disc","pct")}})).price,4783.2);
near(model.calculate(5979,1000,model.parameters(discountParams,{}, {disc:{mode:"pct",value:t.rowParameterValue("","disc","pct")}})).price,5979);
assert(!/title=|data-tip=/.test(t.tableMarkup(t.financialCells(set,calc,{key:"set:x",kind:"set"}))));
assert.equal((t.collectionRow("set").match(/<td/g)||[]).length,t.colCount());

// Shared costs are read-only in every row, including saved models from before this policy.
t.state.params={act:100,acq:2.65,tax:7,pack:200,logistics:2.4,fixed:10,disc:50};
t.state.pmode={pack:'rub',disc:'rub'};t.state.mode='avg';t.state.sov={};t.state.ov={};t.state.customSets=[];t.state.customServices={};t.state.collapsed={};
const legacyCosts={acq:{mode:'rub',value:999},tax:{mode:'pct',value:99},pack:{mode:'rub',value:0},logistics:{mode:'rub',value:0},fixed:{mode:'pct',value:0}};
t.state.rowParams={'set:shared-set':{...legacyCosts,disc:{mode:'pct',value:20},partner:{mode:'rub',value:3000}},'service:shared':{...legacyCosts,disc:{mode:'pct',value:10}}};
t.setData({catalog:{shared:{sid:'shared',name:'Shared',partner:'One',city:'Msk',price:10000,cost:2000,costKnown:true}},sets:[{id:'shared-set',name:'Shared set',city:'Msk',price:10000,items:[{sid:'shared',name:'Shared',cost:2000,price:10000}]}]});
let sharedSet=t.allSets()[0],sharedSvc=t.serviceOf('shared'),setResult=t.calcSet(sharedSet),svcResult=t.calcService(sharedSvc),itemResult=t.calcItem(sharedSet,sharedSet.items[0],setResult);
near(t.calcService({...sharedSvc,sid:'fresh-without-discount'}).price,10000);
near(setResult.price,8000);near(setResult.exp,3000);near(setResult.expenses.acq,212);near(setResult.expenses.tax,560);near(setResult.expenses.pack,200);near(setResult.expenses.logistics,192);near(setResult.npAct,3036);
near(svcResult.price,9000);near(svcResult.expenses.acq,238.5);near(svcResult.expenses.tax,630);near(svcResult.expenses.pack,200);near(svcResult.expenses.logistics,216);near(svcResult.npAct,4815.5);
near(itemResult.expenses.acq,212);near(itemResult.expenses.pack,200);near(itemResult.expenses.logistics,192);
for(const [row,result,kind] of [[sharedSet,setResult,'set'],[sharedSvc,svcResult,'service'],[sharedSet,itemResult,'item']]){
 const markup=t.financialCells(row,result,{key:kind==='service'?'service:shared':'set:shared-set',kind,sid:'shared',itemName:'Shared'});
 assert(!/data-rp-field="(?:acq|tax|pack|logistics|fixed)"/.test(markup));
 for(const field of ['acqPct','acqRub','taxPct','taxRub','packPct','packRub','logisticsPct','logisticsRub'])assert(markup.includes('data-price-component="'+field+'"'));
}
t.state.rowParams['service:costs-only']={...legacyCosts};
t.ensureParams();assert.equal(t.state.params.disc,undefined);assert.equal(t.state.pmode.disc,undefined);assert.equal(t.state.rowParams['service:costs-only'],undefined);
for(const key of ['set:shared-set','service:shared'])for(const field of ['acq','tax','pack','logistics','fixed'])assert.equal(t.state.rowParams[key][field],undefined);
assert.equal(t.state.rowParams['set:shared-set'].disc.value,20);assert.equal(t.state.rowParams['set:shared-set'].partner.value,3000);assert.equal(t.state.rowParams['service:shared'].disc.value,10);
near(t.calcService(sharedSvc).npAct,4815.5);near(t.calcSet(sharedSet).npAct,3036);
t.state.params.acq=3.65;t.state.params.pack=300;
near(t.calcService(sharedSvc).expenses.acq,328.5);near(t.calcService(sharedSvc).expenses.pack,300);near(t.calcService(sharedSvc).npAct,4625.5);
near(t.calcSet(sharedSet).expenses.acq,292);near(t.calcSet(sharedSet).expenses.pack,300);near(t.calcSet(sharedSet).npAct,2856);
assert(!/\{ k: "disc",/.test(html),'No global discount control remains');
console.log('PASS shared costs: old row overrides ignored and migrated, global changes affect service/set/composition, row discounts and partner edits preserved, no global discount');

// Packaging articles have editable defaults and become shared costs only after applying a complete structure.
t.state.packaging=null;t.state.packagingLinked=false;t.ensureParams();
assert.equal(t.state.packaging.label,2);assert.equal(t.state.packaging.tray,12);
assert.equal(t.state.packaging.box,190);assert.equal(t.state.packaging.chocolate,30);assert.equal(t.state.packaging.coloredInsert,3);assert.equal(t.state.packaging.yellowInsert,7);
let parts=t.packagingSummary(t.state.packaging);near(parts.total,244);assert.equal(parts.filled,6);assert.equal(parts.complete,true);near(t.state.params.pack,300);
assert(t.packagingMarkup().includes('data-pack-part="label"'));assert(t.packagingMarkup().includes('data-pack-part="tray"'));
t.state.packaging={box:70,chocolate:20,coloredInsert:3,yellowInsert:5,label:2,tray:12};t.state.packagingLinked=true;
parts=t.syncPackaging();assert.equal(parts.complete,true);near(t.state.params.pack,112);assert.equal(t.state.pmode.pack,'rub');
near(t.calcService(sharedSvc).expenses.pack,112);near(t.calcService(sharedSvc).npAct,4813.5);
near(t.calcSet(sharedSet).expenses.pack,112);near(t.calcSet(sharedSet).npAct,3044);
t.state.packaging.label=3;t.syncPackaging();near(t.state.params.pack,113);
t.state.packaging.label=null;t.syncPackaging();assert.equal(t.state.packagingLinked,false);near(t.state.params.pack,113);
t.state.params.pack=200;t.state.packaging.label=4;t.syncPackaging();near(t.state.params.pack,200);
assert.equal(t.packagingSummary({box:0,chocolate:0,coloredInsert:0,yellowInsert:0,label:2,tray:12}).complete,true);
near(t.packagingSummary({box:.1,chocolate:.2,coloredInsert:0,yellowInsert:0,label:2,tray:12}).total,14.3);
assert.equal(t.packagingSummary({box:-1,chocolate:NaN,coloredInsert:0,yellowInsert:0,label:2,tray:12}).filled,4);
console.log('PASS packaging structure: six editable defaults total 244, incomplete and zero costs, cent rounding, explicit application, linked recalculation, manual cost preserved');

// Upgrade formerly unknown defaults once; preserve entered prices and deliberate blanks afterwards.
t.state.packagingVersion=0;t.state.packaging={box:null,chocolate:null,label:2,tray:12};t.state.packagingLinked=false;t.ensureParams();
assert.equal(t.state.packagingVersion,2);near(t.packagingSummary(t.state.packaging).total,244);
t.state.packaging.box=null;t.ensureParams();assert.equal(t.state.packaging.box,null);
t.state.packagingVersion=0;t.state.packaging={box:0,chocolate:25,label:4,tray:15};t.ensureParams();
assert.equal(t.state.packaging.box,0);assert.equal(t.state.packaging.chocolate,25);assert.equal(t.state.packaging.label,4);assert.equal(t.state.packaging.tray,15);
assert.equal(t.state.packaging.coloredInsert,3);assert.equal(t.state.packaging.yellowInsert,7);
console.log('PASS packaging defaults migration: old empty prices filled, custom values/zero retained, subsequent empty inputs retained');

// One click applies the displayed target as a local proposal, with upward ruble rounding.
assert.equal(t.targetProposal(1234.01),1235);assert.equal(t.targetProposal(1234.00000000001),1234);assert.equal(t.targetProposal(0),0);
for(const value of [null,undefined,NaN,Infinity,-1])assert.equal(t.targetProposal(value),null);
t.state.params={act:60,acq:2.65,tax:7,pack:244,logistics:2.4,fixed:10};t.state.pmode={pack:'rub'};t.state.packagingLinked=false;
t.state.sov={};t.state.ov={};t.state.customServices={};t.state.customSets=[];t.state.mode='avg';
t.state.rowParams={'service:one':{disc:{mode:'pct',value:20}},'set:target-set':{disc:{mode:'pct',value:10}}};
t.setData({catalog:{one:{sid:'one',name:'One',partner:'One',city:'Msk',price:5000,cost:2000,costKnown:true},two:{sid:'two',name:'Two',partner:'Two',city:'Msk',price:10000,cost:8000,costKnown:true},missing:{sid:'missing',name:'Missing',city:'Msk',price:5000,cost:0,costKnown:false}},sets:[{id:'target-set',name:'Target set',city:'Msk',price:5000,items:[{sid:'one',cost:2000},{sid:'two',cost:8000}]}]});
const serviceTarget=t.targetProposal(t.calcService(t.serviceOf('one')).target);
const targetMarkup=t.targetCell({target:1234.01},{kind:'service',id:'one',name:'One'});
assert(targetMarkup.includes('1\u00a0235'));assert(targetMarkup.includes('data-use-target="service"'));
assert(!t.targetCell({target:null},{kind:'service',id:'missing',name:'Missing'}).includes('<button'));
assert.equal(t.useTargetPrice('service','one'),serviceTarget);assert.equal(t.serviceOf('one').price,serviceTarget);assert.equal(t.serviceOf('one').basePrice,5000);assert.equal(t.serviceOf('one').cost,2000);
assert.equal(t.state.rowParams['service:one'].disc.value,20);assert(t.calcService(t.serviceOf('one')).npAct>=-1e-8);assert(t.calcService(t.serviceOf('one')).npAct<1);
let targetSet=t.allSets()[0],expectedSetTarget=t.targetProposal(t.calcSet(targetSet).target);
assert.equal(t.useTargetPrice('set','target-set'),expectedSetTarget);assert.equal(t.allSets()[0].price,expectedSetTarget);assert.equal(t.allSets()[0].basePrice,5000);
targetSet=t.allSets()[0];const targetItem=targetSet.items.find(it=>it.sid==='two'),itemTarget=t.targetProposal(t.calcItem(targetSet,targetItem,t.calcSet(targetSet)).target);
assert.equal(t.useTargetPrice('item','target-set','two'),itemTarget);assert.equal(t.allSets()[0].price,itemTarget);assert.equal(t.serviceOf('two').price,10000);
targetSet=t.allSets()[0];assert(t.calcItem(targetSet,targetSet.items.find(it=>it.sid==='two'),t.calcSet(targetSet)).npAct>=-1e-8);
t.state.customSets=[{id:'custom-target',name:'Custom',city:'Msk',price:100,items:['one']}];
const customTarget=t.useTargetPrice('set','custom-target');assert.equal(t.state.customSets[0].price,customTarget);assert.equal(t.state.ov['custom-target'],undefined);
assert.equal(t.useTargetPrice('service','missing'),null);assert.equal(t.state.sov.missing,undefined);assert.equal(t.useTargetPrice('service','unknown-id'),null);assert.equal(t.useTargetPrice('item','target-set','unknown-item'),null);
console.log('PASS target button: service/set/custom/composition proposals, positive coverage after rounding, row discount and source cost preserved, missing targets do nothing');

// Every payout forecast works with an independent usage forecast, including 0%.
t.state.params={act:60,acq:2,tax:7,pack:50,logistics:100,fixed:5};t.state.pmode={pack:'rub',logistics:'rub'};
t.state.rowParams={};t.state.sov={};t.state.ov={};t.state.customSets=[];t.state.customServices={};
t.setData({catalog:{a:{sid:'a',name:'A',partner:'One',city:'Мск',price:2000,cost:1000},b:{sid:'b',name:'B',partner:'Two',city:'Мск',price:1500,cost:500}},sets:[{id:'independent',name:'Independent',city:'Мск',price:2000,items:[{sid:'a',cost:1000},{sid:'b',cost:500}]}]},{counts:{'Мск':{One:3,Two:1}}});
const independentSet=t.allSets()[0];
for(const [mode,payout] of [['avg',750],['act',875],['max',1000]]){
 t.state.mode=mode;
 for(const usage of [0,60,100]){
  t.state.usageMode='custom';t.state.params.act=usage;
  const result=t.calcSet(independentSet),item=t.calcItem(independentSet,independentSet.items[0],result);
  near(result.exp,payout);near(result.partnerForecast,payout*usage/100);
  near(result.mpAct,2000-payout*usage/100);near(result.npAct,1570-payout*usage/100);
  near(model.calculate(result.target,payout,result.p).npAct,0);
  near(item.partnerForecast,1000*usage/100);near(t.calcService(t.serviceOf('a')).partnerForecast,1000*usage/100);
 }
 t.state.params.act=60;t.state.usageMode='full';near(t.calcSet(independentSet).partnerForecast,payout);
 assert.equal(t.state.params.act,60);t.state.usageMode='custom';near(t.calcSet(independentSet).partnerForecast,payout*.6);
}
t.state.sov.a={cost:1200};near(t.calcSet(t.allSets()[0]).partnerForecast,720);t.state.sov={};
t.state.view='sets';t.state.city='all';t.state.q='';t.exportCsv();
const independentCsv=exportedCsv.trim().split('\n').map(line=>line.split(';'));
const forecastColumn=independentCsv[0].findIndex(x=>x.includes('Прогноз с учётом активации'));
assert(forecastColumn>=0,'CSV has a forecast payout column');
assert.equal(independentCsv[1][forecastColumn],'600');
console.log('PASS independent forecasts: average/weighted/maximum × 0/60/100%, full usage, child rows, standalone services, edited payouts, net profit, target and CSV');

// Legacy worst-case models retain their old result; new maximum + custom models remain independent.
const preserved={params:{...t.state.params,act:60},mode:'max',sov:{a:{price:2400,cost:1100}},ov:{independent:{price:2300}},rowParams:{'set:independent':{disc:{mode:'pct',value:10}}},customSets:[{id:'saved-draft',name:'Draft',city:'Мск',price:2500,items:[{sid:'a'}]}]};
savedPricing=JSON.stringify(preserved);t.load();t.ensureParams();
assert.equal(t.state.usageMode,'full');near(t.usagePercent(),100);assert.equal(t.state.params.act,60);
near(t.calcSet(t.allSets().find(s=>s.id==='independent')).partnerForecast,1100);
assert.equal(t.state.sov.a.price,2400);assert.equal(t.state.ov.independent.price,2300);assert.equal(t.state.rowParams['set:independent'].disc.value,10);assert.equal(t.state.customSets[0].name,'Draft');
t.state.usageMode='custom';t.save();t.state.usageMode='full';t.load();
assert.equal(t.state.mode,'max');assert.equal(t.state.usageMode,'custom');near(t.usagePercent(),60);
near(t.calcSet(t.allSets().find(s=>s.id==='independent')).partnerForecast,660);
for(const mode of ['avg','act']){savedPricing=JSON.stringify({...preserved,mode});t.load();assert.equal(t.state.usageMode,'custom');near(t.usagePercent(),60);}
console.log('PASS forecast persistence: legacy worst migrates to full + maximum, new selections reload independently, prices/discounts/drafts preserved');
