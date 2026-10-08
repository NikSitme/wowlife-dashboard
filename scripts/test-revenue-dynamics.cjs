const assert=require('node:assert/strict');
const model=require('./revenue-dynamics.js');
const {mergeHistory}=require('./build-revenue-timeline.cjs');
const header=['Дата операции','Дата зачисления','Сумма операции','Статья'];
const site=[header,
  ['01.01.2025','01.01.2025','10','Wowlife МСК выручка'],
  ['01.01.2026','02.01.2026','100','Wowlife МСК выручка'],
  ['01.01.2026','02.01.2026','-999','Wowlife МСК выручка'],
  ['03.01.2026','03.01.2026','20','Wowlife СПБ Выручка'],
  ['04.01.2026','04.01.2026','40','B2B выручка'],
  ['04.01.2025','04.01.2025','30','Wowlife МСК выручка'],
];
const mp=(date,amount,platform='ОЗОН',city='Москва')=>[date,amount,'','','',city,platform];
const current=[['Дата операции'],mp('02.01.2026','50'),mp('02.01.2026','-5'),mp('02.01.2026','900','ОЗОН','#N/A'),mp('02.01.2026','7','ВБ'),mp('02.01.2025','999')];
const archive=[['Дата операции'],mp('02.01.2025','15'),mp('04.01.2025','200'),mp('02.01.2024','888')];
const merged=mergeHistory(current,archive);
assert.equal(merged.filter(r=>r[0]==='02.01.2025').length,1);
assert.equal(merged.filter(r=>r[0]==='02.01.2024').length,0);
const data=model.fromRows(site,merged,'2026-01-04');
assert.equal(data.days['2026-01-02'].siteMsk,100,'Credit date and positive-only receipts');
assert.equal(data.days['2026-01-02'].ozonMsk,45,'Signed marketplace returns; unknown city excluded');
assert.equal(data.days['2025-01-02'].ozonMsk,15,'Historical replacement, no duplicate 2025');
function points(step,sources=['site','ozon','wb','b2b'],city='all',from='2026-01-01',to='2026-01-31'){
  return model.series(data,{step,sources,city,from,to});
}
const month=points('month')[0];
assert.equal(month.current,212);assert.equal(month.previous,55,'Each source compared only through its own available date');
assert.equal(month.partial,true);
for(const step of ['day','week','year'])assert.equal(points(step).reduce((s,p)=>s+(p.current||0),0),212,'Aggregation must preserve receipts: '+step);
assert.equal(points('month',['site'])[0].current,120);
assert.equal(points('month',['site'],'msk')[0].current,100);
assert.equal(points('month',['ozon','wb'])[0].current,52);
assert.equal(points('month',['b2b'],'msk')[0].current,null);
assert.equal(points('day',[])[0].current,null,'Empty selection is not all sources');
assert.equal(points('day',['site'],'all','2026-01-05','2026-01-05')[0].current,null,'Future dates are gaps, not zeros');
assert.equal(points('month',['site'],'all','2025-01-01','2025-01-31')[0].previous,null,'Absent 2024 is not a zero');
assert.deepEqual(model.buckets('2026-01-01','2026-01-12','week'),[{from:'2026-01-01',to:'2026-01-04'},{from:'2026-01-05',to:'2026-01-11'},{from:'2026-01-12',to:'2026-01-12'}]);
assert.equal(model.shiftYear('2024-02-29'),'2023-02-28');
const leap={version:1,asOf:'2024-03-01',coverage:{siteMsk:{from:'2023-01-01',to:'2024-03-01'},siteSpb:{from:'2023-01-01',to:'2024-03-01'}},days:{'2023-02-28':{siteMsk:12},'2024-02-28':{siteMsk:5},'2024-02-29':{siteMsk:6}}};
const leapPoints=model.series(leap,{sources:['site'],city:'all',step:'day',from:'2024-02-28',to:'2024-02-29'});
assert.equal(leapPoints[0].previous,12);assert.equal(leapPoints[1].previous,null,'Do not count Feb 28 twice');
assert.equal(model.isoDate('31.02.2026'),null);
console.log('Revenue dynamics: date basis, multi-source/city selection, all 4 steps, partial comparison, future/missing gaps and leap day passed.');
if(process.argv[2]){
  const snapshot=require(process.argv[2]);
  const sept=model.series(snapshot,{sources:model.sources.map(s=>s[0]),city:'all',step:'month',from:'2026-09-01',to:'2026-09-30'})[0];
  assert.equal(sept.current,8884778,'September total agrees with OПиУ');
  const siteSept=model.series(snapshot,{sources:['site'],city:'all',step:'month',from:'2026-09-01',to:'2026-09-30'})[0];
  assert.equal(siteSept.current,5036062);
  const archive2025=model.series(snapshot,{sources:['ozon','wb','ym','flowwow'],city:'all',step:'year',from:'2025-01-01',to:'2025-12-31'})[0];
  assert.equal(archive2025.current,50018452.84,'Historical MP total agrees with OПиУ city criteria');
  const options={sources:['site','ozon'],city:'all',from:'2026-01-01',to:'2026-09-30'};
  const totals=['day','week','month','year'].map(step=>model.series(snapshot,{...options,step}).reduce((s,p)=>s+(p.current||0),0));
  totals.forEach(n=>assert.ok(Math.abs(n-totals[0])<0.02));
  console.log('Live-source snapshot: September total/site, 2025 MP history and aggregation invariance passed.');
}
