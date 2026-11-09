const assert=require('node:assert/strict');
const C=require('./service-catalog');
const classify=C.classifier({categories:['Водные развлечения'],services:{'42':{city:'Мск',category:'Водные развлечения'}}});
assert.equal(classify({sid:'42',city:'Мск',name:'Переименованная услуга'}),'Водные развлечения','Renaming a proposal must not change its category');
assert.equal(classify({sid:'42',city:'СПб'}),'Без категории','Never assign a category from another city');
assert.equal(classify({sid:'142',city:'Мск',name:'Водные развлечения'}),'Без категории','Exact tariff ID, no substring matching');
assert.equal(classify({sid:'u42',city:'Мск',name:'Аренда катера'}),'Без категории','New custom services remain available without invented categories');
assert.equal(classify(null),'Без категории');
assert.equal(C.classifier({})({sid:'42',city:'Мск'}),'Без категории','Unavailable taxonomy leaves search functional');
const services=[{sid:'1',city:'Мск',name:'Аренда катера',partner:'Вода',price:5000,category:'Водные развлечения'},{sid:'2',city:'СПб',name:'Аренда катера',partner:'Вода',price:5000,category:'Водные развлечения'},{sid:'3',city:'Мск',name:'Массаж',partner:'Спа',price:2500,category:'Красота и здоровье'},{sid:'4',city:'Мск',name:'Новая услуга',partner:'',price:0,category:'Без категории'}];
assert.deepEqual(C.filter(services,'Мск',{}).map(s=>s.sid),['1','3','4']);
assert.deepEqual(C.filter(services,'Мск',{min:2500,max:5000,category:'Водные развлечения',partner:'Вода',q:'КАТЕРА'}).map(s=>s.sid),['1']);
assert.equal(C.filter(services,'СПб',{category:'Красота и здоровье'}).length,0);
assert.deepEqual(C.filter(services,'Мск',{min:'',max:'',sort:'price-asc'}).map(s=>s.sid),['4','3','1']);
assert.deepEqual(C.filter(services,'Мск',{q:'спа'}).map(s=>s.sid),['3']);
assert.equal(C.filter(services,'Мск',{min:6000,max:100}).length,0);
assert.deepEqual(C.filter(services,'Мск',{max:0}).map(s=>s.sid),['4']);
assert.equal(C.filter(Array.from({length:1300},(_,i)=>({city:'Мск',name:'Услуга '+i,price:i,partner:'',category:'Без категории'})),'Мск',{}).length,1300,'No hidden 25/400-row cap');
// Pagination covers the entire filtered/sorted catalog, including positions beyond the old cap.
const many=Array.from({length:1251},(_,i)=>({sid:String(i),city:i%2?'СПб':'Мск',name:'Service '+i,price:i,partner:'',category:'Без категории'}));
const sorted=C.filter(many,'Мск',{min:20,sort:'price-desc'});
const pages=Array.from({length:Math.ceil(sorted.length/100)},(_,i)=>C.paginate(sorted,i+1));
assert.equal(pages[0].items.length,100);assert.equal(pages[0].from,1);assert.equal(pages[0].to,100);
assert.equal(pages[1].from,101);assert.equal(pages[1].to,200);
assert.deepEqual(pages.flatMap(p=>p.items.map(s=>s.sid)),sorted.map(s=>s.sid),'Every matching service appears once, in the selected order');
assert.equal(pages.at(-1).items.length,sorted.length%100);
assert.equal(C.paginate(sorted,999).page,pages.length,'Clamp after deletion or a smaller filter result');
assert.equal(C.paginate(sorted,0).page,1);
assert.equal(C.paginate(many.slice(0,100),2).page,1,'Exactly 100 items need one page');
assert.equal(C.paginate(many.slice(0,101),2).items.length,1);
assert.deepEqual(C.paginate([],9),{items:[],page:1,pages:1,total:0,from:0,to:0});
const missingPrice=[{sid:'unknown',name:'Без цены',city:'Мск',price:null},{sid:'known',name:'С ценой',city:'Мск',price:100}];
assert.deepEqual(C.filter(missingPrice,'Мск',{sort:'price-asc'}).map(s=>s.sid),['known','unknown']);
assert.deepEqual(C.filter(missingPrice,'Мск',{max:200}).map(s=>s.sid),['known']);
// All picker columns sort the complete filtered catalog; zero is data, not missing.
const sortRows=[
  {sid:'10',city:'Мск',name:'Услуга 10',category:'Яхты',partner:'Я 10',activations12m:10,price:100,cost:80,inSet:true},
  {sid:'2',city:'Мск',name:'Услуга 2',category:'Арт 10',partner:'А 10',activations12m:2,price:20,cost:10,inSet:false},
  {sid:'1',city:'Мск',name:'Услуга 1',category:'Арт 2',partner:'А 2',activations12m:0,price:0,cost:0,costKnown:true,inSet:false},
  {sid:'missing',city:'Мск',name:'Пропуск',category:'',partner:'',activations12m:null,price:null,cost:0,costKnown:false,inSet:false},
  {sid:'other-city',city:'СПб',name:'А',category:'А',partner:'А',activations12m:999,price:999,cost:999,inSet:true}
];
sortRows.forEach(Object.freeze);Object.freeze(sortRows);
const sortExpectations={
  name:{asc:['missing','1','2','10'],desc:['10','2','1','missing']},
  category:{asc:['1','2','10','missing'],desc:['10','2','1','missing']},
  partner:{asc:['1','2','10','missing'],desc:['10','2','1','missing']},
  activations:{asc:['1','2','10','missing'],desc:['10','2','1','missing']},
  price:{asc:['1','2','10','missing'],desc:['10','2','1','missing']},
  cost:{asc:['1','2','10','missing'],desc:['10','2','1','missing']},
  inSet:{asc:['missing','1','2','10'],desc:['10','missing','1','2']}
};
for(const [key,directions] of Object.entries(sortExpectations))for(const [dir,expected] of Object.entries(directions)){
  assert.deepEqual(C.filter(sortRows,'Мск',{sort:key+'-'+dir}).map(s=>s.sid),expected,key+' '+dir);
}
assert.deepEqual(C.filter(sortRows,'Мск',{sort:'activations-desc',min:0,max:20,q:'услуга'}).map(s=>s.sid),['2','1'],'Sorting respects the combined city, query and price filters');
assert.deepEqual(C.filter(sortRows,'Мск',{sort:'cost-desc',category:'Арт 2',partner:'А 2'}).map(s=>s.sid),['1']);
const ties=[{sid:'10',city:'Мск',name:'Услуга',price:10},{sid:'2',city:'Мск',name:'Услуга',price:10}];
for(const dir of ['asc','desc'])assert.deepEqual(C.filter(ties,'Мск',{sort:'price-'+dir}).map(s=>s.sid),['2','10'],'Stable numeric ID tie-break in either direction');
assert.deepEqual(C.sortSpec('name'),{key:'name',dir:'asc'});
assert.deepEqual(C.sortSpec('activations-desc'),{key:'activations',dir:'desc'});
assert.deepEqual(C.sortSpec('invalid'),{key:'name',dir:'asc'});
assert.deepEqual(sortRows.map(s=>s.sid),['10','2','1','missing','other-city'],'Sorting never mutates the source array or records');
const fs=require('node:fs'),vm=require('node:vm'),html=fs.readFileSync('index.html','utf8');
for(const m of html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)){if(m[1].includes('application/json'))JSON.parse(m[2]);else if(m[2].trim())new vm.Script(m[2]);}
assert(!html.includes('data-setcity='),'No second city selector inside set');
assert(html.includes('data-catalog-filter="category"')&&html.includes('data-catalog-filter="partner"'));
assert(!html.includes('function showAddResults'),'Old truncated autocomplete removed');
assert(!html.includes('list.slice(0,400)'),'Main services table has no hard cutoff');
assert.equal((html.match(/<nav class="pr-pagination"/g)||[]).length,2,'Pagination is outside the scroller, above and below');
const data=JSON.parse(fs.readFileSync('data/pricing-categories.json','utf8'));
assert.equal(data.schemaVersion,2);assert.equal(data.categories.length,12);assert.equal(Object.keys(data.services).length,2134);
assert.deepEqual(data.categories.slice(0,3),['Полёты и прыжки','Катание и управление техникой','Водные развлечения']);
assert.equal(new Set(data.categories).size,data.categories.length);
const figmaClassify=C.classifier(data);
for(const [sid,record] of Object.entries(data.services)){
  assert(/^\d+$/.test(sid));assert(['Мск','СПб'].includes(record.city));assert(data.categories.includes(record.category));
  assert.equal(figmaClassify({sid,city:record.city,name:'Любое новое название'}),record.category);
  assert.equal(figmaClassify({sid,city:record.city==='Мск'?'СПб':'Мск'}),'Без категории');
}
for(const [sid,city,category] of [['21514','Мск','СПА, массаж, баня'],['8918','Мск','СПА, массаж, баня'],['30067','СПб','СПА, массаж, баня'],['43160','СПб','Спорт и активный отдых'],['31977','СПб','Развлечения и досуг'],['16001','СПб','Полёты и прыжки'],['15988','СПб','Мастер-классы и обучение']]){
  assert.equal(figmaClassify({sid,city}),category,sid);
}
assert(!data.categories.some(c=>['Прочее','Романтические впечатления','Семейный отдых','Без категории','Наборы и сертификат на сумму'].includes(c)),'Only the 12 service categories from the Figma board');
console.log('PASS service catalog: all 7 sort keys in both directions, missing/zero values, stable ties, city isolation, combined filters, Figma categories, uncapped results and inline syntax');

const search=require("./service-catalog").matchesQuery;
assert(search({sid:"30",name:"Example"},"30"));
assert(search({id:"40",items:[{sid:"30",name:"Example"}]},"ID: 30"));
assert(!search({sid:"130",name:"30 minutes"},"30"));
assert(search({sid:"130",name:"30 minutes"},"minutes"));
assert(search({id:"u123",name:"Custom"},"u123"));
