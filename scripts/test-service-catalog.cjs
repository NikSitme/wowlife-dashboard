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
console.log('PASS service catalog: city isolation, combined filters, price boundaries, categories, uncapped results, syntax and city selector removal');

const search=require("./service-catalog").matchesQuery;
assert(search({sid:"30",name:"Example"},"30"));
assert(search({id:"40",items:[{sid:"30",name:"Example"}]},"ID: 30"));
assert(!search({sid:"130",name:"30 minutes"},"30"));
assert(search({sid:"130",name:"30 minutes"},"minutes"));
assert(search({id:"u123",name:"Custom"},"u123"));
