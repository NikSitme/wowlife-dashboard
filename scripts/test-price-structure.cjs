const assert=require('node:assert/strict'),fs=require('node:fs'),S=require('./price-structure');
const near=(a,b)=>assert(Math.abs(a-b)<1e-8,`${a} != ${b}`);
const rows=[{id:'1',name:'Партнёр',type:'Партнер',terms:'20%'},{id:'2',name:'Без',type:'Партнер',terms:'Без комиссии'},{id:'3',name:'Условия',type:'Партнер',terms:'15% (в выходные дни 10%)'},{id:'4',name:'Число',type:'Партнер',terms:'25'},{id:'5',name:'Дубль',type:'Партнер',terms:'10%'},{id:'6',name:'Дубль',type:'Партнер',terms:'20%'},{id:'7',name:'Полная',type:'Партнер',terms:'100%'}];
const index=S.index(rows);let r=S.service(6000,4000,' ПАРТНЕР ',index);
near(r.open,5000);near(r.markup,1000);near(r.commission,1000);near(r.rate,.2);near(r.markupShare,.2);
near(r.price,r.markup+r.commission+4000);
assert.equal(S.resolve('ID 1',index).id,'1');assert.equal(S.resolve('Дубль',index).rate,null);
for(const partner of ['Условия','Число','Полная','Неизвестный'])assert.equal(S.service(6000,4000,partner,index).open,null,partner);
r=S.service(6000,4000,'Без',index);near(r.open,4000);near(r.markup,2000);near(r.commission,0);
r=S.service(3000,4000,'Партнёр',index);near(r.markup,-2000);
assert.equal(S.service(6000,null,'Партнёр',index).open,null);
near(S.service(6000,null,'Партнёр',index).rate,.2);
r=S.aggregate(6000,4000,[{partner:'Партнёр',cost:4000,weight:.25},{partner:'Без',cost:4000,weight:.75}],index);
near(r.open,4250);near(r.commission,250);near(r.rate,250/4250);near(r.markup,1750);
assert.equal(S.aggregate(6000,4000,[{partner:'Условия',cost:4000,weight:1}],index).open,null);
assert.equal(S.aggregate(6000,5000,[{partner:'Партнёр',cost:4000,weight:1}],index).open,null,'Manual payout mismatch must not fabricate a decomposition');
assert.equal(S.aggregate(6000,4000,[{partner:'Партнёр',cost:4000,weight:1},{partner:'Без',cost:4000,weight:1}],index,'max').open,null,'Worst payout ties do not imply a unique open price');
const data=JSON.parse(fs.readFileSync('data/partner-commissions.json','utf8'));
assert.equal(data.as_of,'2026-10-29');assert.equal(data.companies.length,458);
assert.equal(new Set(data.companies.map(r=>r.id)).size,458);
assert(data.companies.every(r=>r.type==='Партнер'),'Only partners are needed in the public price list');
assert(data.companies.every(r=>Object.keys(r).sort().join(',')==='id,name,terms,type'));
assert(!/\+7[\d ()-]{9,}/.test(JSON.stringify(data)),'Do not publish the operational phone note');
for(const c of data.companies){const result=S.resolve(c.name,S.index([c]));if(result.rate!==null)assert(result.rate>=0&&result.rate<1);}
const confirmed=require('../data/partner-open-prices.json');
assert.equal(confirmed.prices.length,0,'Withdrawn snowboard prices must not override source payouts and the confirmed 10% commission');
const partner='Тренер ИВАН (Сноуборд и Виндсерф Москва)';
const actualIndex=S.index(data.companies,confirmed.prices);
for(const [sid,payout,price] of [['8460',2900,5605],['8461',5800,9025],['10884',4400,8550],['10885',11600,16055]]){
 const value=S.service(price,payout,partner,actualIndex,S.reference(sid,partner,actualIndex));
 near(value.open,payout/.9);near(value.commission,value.open*.1);near(value.markup,price-value.open);
 near(value.markup+value.commission+payout,price);assert.equal(value.derived,true);assert(!value.mismatch);
 const manual=S.service(price,payout,partner,actualIndex,{partner_name:partner,open:Math.round(payout/.9*100)/100,terms:'10%',derived:true});
 near(manual.open,payout/.9);assert.equal(manual.derived,true,'rounded formula output must remain calculated, not an independent reference price');
}
// Independent confirmed-price support remains available for future partner price lists.
const confirmedIndex=S.index(data.companies,[['8460',3500],['8461',5700],['10884',5400],['10885',10400]].map(([sid,open])=>({sid,open,partner_id:'372',as_of:'2026-10-29'})));
for(const [sid,open,payout]of [['8460',3500,3150],['8461',5700,5130],['10884',5400,4860],['10885',10400,9360]]){
 const ref=S.reference(sid,partner,confirmedIndex);assert.equal(ref.open,open);near(S.defaultPayout(ref,partner,confirmedIndex),payout);
 const value=S.service(9000,payout,partner,confirmedIndex,ref);near(value.open,open);near(value.commission,open*.1);assert.equal(value.derived,false);
 near(value.markup+value.commission+payout,9000);
}
const ref=S.reference('10884',partner,confirmedIndex);r=S.service(9000,4860,partner,confirmedIndex,ref);
near(r.markup,3600);near(r.markupShare,2/3);near(r.markup/9000,.4);assert.equal(r.confirmedAsOf,'2026-10-29');
r=S.service(9000,4400,partner,confirmedIndex,ref);assert.equal(r.open,5400);assert.equal(r.commission,null);assert.equal(r.mismatch,true,'Preserved manual payouts must be flagged rather than silently reconciled');
assert.equal(S.reference('33560',partner,confirmedIndex),null,'Do not apply snowboard prices to windsurfing');
assert.equal(S.reference('10884','ROYAL THAI',confirmedIndex),null,'Reference belongs to an exact service and partner');
const mixed=S.aggregate(9000,4860,[{partner,cost:4860,reference:ref,weight:1}],confirmedIndex);
near(mixed.open,5400);near(mixed.commission,540);assert.equal(mixed.derived,false);
console.log('PASS price structure: components reconcile, percentage bases, weighted sets, zero/unknown/conditional rates, duplicate names, snapshot and no contacts');

const discount={discP:0,discR:0};
let policy=S.rule(S.service(9000,4860,partner,confirmedIndex,ref),4860,discount);
near(policy.net,6075);near(policy.gross,6075);near(policy.markup,675);assert.equal(policy.status,'extra');
policy=S.rule(S.service(5000,4860,partner,confirmedIndex,ref),4860,discount);assert.equal(policy.status,'below');
policy=S.rule(S.service(6075,4860,partner,confirmedIndex,ref),4860,discount);assert.equal(policy.status,'ok');near(policy.margin,.2);
policy=S.rule(S.service(5000,4000,'Партнёр',index),4000,discount);near(policy.net,5000);near(policy.markup,0);assert.equal(policy.status,'ok');
const high=S.index([{id:'8',name:'Высокая',type:'Партнер',terms:'30%'}]);
policy=S.rule(S.service(7000,3500,'Высокая',high),3500,discount);near(policy.net,5000);near(policy.markup,0);assert.equal(policy.status,'extra');
policy=S.rule(S.service(6000,4000,'Без',index),4000,discount);near(policy.net,5000);near(policy.markup,1000);
policy=S.rule(S.service(9000,4860,partner,confirmedIndex,ref),4860,{discP:.1,discR:100});assert(policy.gross*.9-100>=6075);near(policy.net,6075);
for(const [structure,cost,p] of [[S.unknown(9000,'unknown'),4860,discount],[S.service(9000,4400,partner,confirmedIndex,ref),4400,discount],[S.service(9000,4860,partner,confirmedIndex,ref),4860,{discP:1,discR:0}],[S.service(9000,4860,partner,confirmedIndex,ref),4860,{...discount,partner:{mode:'pct',value:54}}],[S.service(0,0,'Без',index),0,discount]])assert.equal(S.rule(structure,cost,p).gross,null);
console.log('PASS policy boundaries: 0/10/20/30 percent, exact 20% margin, discounts, conflicts and unknown inputs');
