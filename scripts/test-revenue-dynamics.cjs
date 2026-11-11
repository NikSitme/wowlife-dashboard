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
assert.equal(month.current,212);assert.equal(month.previous,255,'Previous line covers the whole selected month');
assert.equal(month.comparablePrevious,55,'Percentage still compares each source through its own available date');
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

assert.deepEqual(model.keysFor(['site'],'all'),['siteMsk','siteSpb']);
assert.deepEqual(model.keysFor(['b2b'],'all'),['b2bAll']);
assert(model.sources.find(s=>s[0]==='site')[1].includes('без B2B'));
assert.equal(points('month',['b2b'])[0].current,40);
assert.equal(points('month',['site','b2b'])[0].current,points('month',['site'])[0].current+points('month',['b2b'])[0].current,'B2B is separate and never double-counted in website revenue');
console.log('Revenue source separation: site excludes B2B, standalone B2B and combined totals reconcile.');

const fullPriorYear={version:1,asOf:'2026-11-08',coverage:{siteMsk:{from:'2025-01-01',to:'2026-11-08'},siteSpb:{from:'2025-01-01',to:'2026-11-08'}},days:{'2025-11-01':{siteMsk:20},'2025-11-20':{siteMsk:280},'2025-12-20':{siteMsk:500},'2026-11-01':{siteMsk:10}}};
const fullOptions={sources:['site'],city:'all',step:'month',from:'2026-11-01',to:'2026-12-31'};
const fullPrior=model.series(fullPriorYear,fullOptions);
assert.deepEqual(fullPrior.map(p=>p.current),[10,null],'No invented December current-year zero');
assert.deepEqual(fullPrior.map(p=>p.previous),[300,500],'November and December prior-year totals follow the selected dates');
assert.equal(fullPrior[0].comparablePrevious,20,'The percentage denominator remains the matching current coverage');
assert.equal(fullPrior[1].previousThrough,'2025-12-31');
assert.equal(model.series(fullPriorYear,{...fullOptions,to:'2026-12-15'})[1].previous,0,'Custom end date clips the prior year rather than expanding to a whole month');
assert.equal(model.series(fullPriorYear,{...fullOptions,from:'2026-12-16',to:'2026-12-31'})[0].previous,500,'Prior year is still available without any current-year data');
for(const step of ['day','week','month','year']){
 const result=model.series(fullPriorYear,{...fullOptions,step});
 assert.equal(result.reduce((n,p)=>n+(p.previous||0),0),800,'Full previous range in every step: '+step);
 assert.equal(result.reduce((n,p)=>n+(p.current||0),0),10,'Current receipts unchanged: '+step);
}
console.log('Revenue previous-year range: full months/year, future-current gaps, custom endpoints, prior-only buckets and matching-date percentage passed.');

assert.deepEqual(model.monthRange('2026-11-17'),{from:'2026-11-01',to:'2026-11-30'});
assert.deepEqual(model.monthRange('2026-12-31'),{from:'2026-12-01',to:'2026-12-31'});
assert.deepEqual(model.monthRange('2024-02-10'),{from:'2024-02-01',to:'2024-02-29'});
assert.equal(model.monthRange('2026-02-31'),null);
// Clicking a clipped monthly bucket still opens the complete calendar month.
const detail=model.monthSeries(fullPriorYear,{...fullOptions,from:'2026-11-05',to:'2026-11-06'});
assert.equal(detail.length,30);assert.equal(detail[0].from,'2026-11-01');assert.equal(detail.at(-1).to,'2026-11-30');
assert.equal(detail[0].current,10);assert.equal(detail[0].previous,20);
assert.equal(detail[19].current,null);assert.equal(detail[19].previous,280,'The previous month stays complete beyond current coverage');
assert.equal(detail[1].current,0,'Covered days without receipts remain real zeros');
assert.equal(detail[8].current,null,'Uncovered days are gaps');
assert.equal(detail.reduce((n,p)=>n+(p.current||0),0),fullPrior[0].current);
assert.equal(detail.reduce((n,p)=>n+(p.previous||0),0),fullPrior[0].previous);
const before=JSON.stringify(data);
for(const sources of [['site'],['b2b'],['ozon','wb'],['site','ozon','wb','b2b'],[]])for(const city of ['all','msk','spb']){
  const options={sources,city,from:'2026-01-02',to:'2026-01-03'};
  const days=model.monthSeries(data,options),aggregate=model.series(data,{...options,step:'month',from:'2026-01-01',to:'2026-01-31'})[0];
  assert.equal(days.length,31);
  assert.equal(days.reduce((n,p)=>n+(p.current||0),0),aggregate.current||0,'Selected sources/city remain identical in the daily view');
  assert.equal(days.reduce((n,p)=>n+(p.previous||0),0),aggregate.previous||0,'Prior-year daily receipts reconcile to the month');
}
assert.equal(JSON.stringify(data),before,'Drill-down never changes source receipts or coverage');
const currentLeap=model.monthSeries(leap,{sources:['site'],city:'all',from:'2024-02-01'});
assert.equal(currentLeap.length,29);assert.equal(currentLeap[28].current,6);assert.equal(currentLeap[28].previous,null);
assert.equal(currentLeap[28].noPreviousDay,true);
assert.equal(currentLeap.reduce((n,p)=>n+(p.previous||0),0),12,'No repeated prior February 28 for a leap-year current month');
const previousLeap={version:1,asOf:'2025-02-28',coverage:{siteMsk:{from:'2024-01-01',to:'2025-02-28'},siteSpb:{from:'2024-01-01',to:'2025-02-28'}},days:{'2024-02-28':{siteMsk:12},'2024-02-29':{siteMsk:7},'2025-02-28':{siteMsk:5}}};
const leapDetail=model.monthSeries(previousLeap,{sources:['site'],city:'all',from:'2025-02-01'});
assert.equal(leapDetail.length,29);assert.equal(leapDetail[28].current,null);assert.equal(leapDetail[28].previous,7);
assert.equal(leapDetail[28].from,null);assert.equal(leapDetail[28].previousFrom,'2024-02-29');assert.equal(leapDetail[28].noCurrentDay,true);
assert.equal(leapDetail.reduce((n,p)=>n+(p.previous||0),0),19,'Prior leap day is shown once, without fabricating a current-year date');
console.log('Month drill-down: full calendar months, day-of-month alignment, source/city totals, current gaps, prior-only days, both leap-year directions and immutable inputs passed.');
