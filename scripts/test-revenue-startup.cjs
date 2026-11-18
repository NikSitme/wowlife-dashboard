const assert=require('node:assert/strict');
const model=require('./revenue-dynamics');

// Reproduce a report rendered while its tab is hidden, then revealed/resized.
class Element{
 constructor(){this.nodes=new Map();this.handlers={};this.clientWidth=0;this.innerHTML='';this.hidden=false;this.value='';}
 querySelector(s){if(!this.nodes.has(s))this.nodes.set(s,new Element());return this.nodes.get(s);}
 querySelectorAll(){return [];}
 addEventListener(k,fn){this.handlers[k]=fn;}
 appendChild(){}setAttribute(){}contains(){return false;}
}
const keys=['window','document','localStorage','ResizeObserver','requestAnimationFrame','fetch'];
const previous=Object.fromEntries(keys.map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));
try{
 const root=new Element(),storage=new Map(),frames=[];let observe;
 globalThis.window={};
 globalThis.document={createElement:()=>new Element(),createTextNode:()=>new Element(),addEventListener(){}};
 globalThis.localStorage={getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)};
 globalThis.ResizeObserver=class{constructor(fn){observe=fn;}observe(){}};
 globalThis.requestAnimationFrame=fn=>{frames.push(fn);return frames.length;};
 globalThis.fetch=()=>new Promise(()=>{});
 const chart=model.mount(root),wrap=root.querySelector('#revYearWrap');
 const coverage=Object.fromEntries(['siteMsk','siteSpb','ozonMsk','b2bAll'].map(k=>[k,{from:'2025-01-01',to:'2026-11-18'}]));
 const data={version:1,asOf:'2026-11-18',coverage,days:{'2026-11-01':{siteMsk:100},'2025-11-01':{siteMsk:50}}};
 chart.setData(data);
 assert(!wrap.innerHTML.includes('<svg'),'Hidden tab must not create an undersized fallback chart');
 wrap.clientWidth=1098;observe();assert.equal(frames.length,1);frames.shift()();
 assert(wrap.innerHTML.includes('width="1098"'),'Revealing a tab draws at its actual width without a network update');
 assert.equal(root.querySelector('#rdTotal').textContent,'100 ₽');
 wrap.clientWidth=1250;observe();frames.shift()();assert(wrap.innerHTML.includes('width="1250"'));
 observe();assert.equal(frames.length,0,'Height/layout notifications at unchanged width do not trigger render loops');
 wrap.clientWidth=0;observe();wrap.clientWidth=1250;observe();frames.shift()();
 assert(wrap.innerHTML.includes('width="1250"'),'Hide/show at the same width still redraws');
 root.querySelector('#rdOnlySite').handlers.click();root.querySelector('#yearCityPresets').handlers.change({target:{value:'msk'}});
 root.querySelector('#yearStepPresets').handlers.change({target:{value:'day'}});
 const nextRoot=new Element();nextRoot.querySelector('#revYearWrap').clientWidth=1098;
 model.mount(nextRoot).setData({...data,asOf:'2026-11-19'});
 assert.equal(nextRoot.querySelector('#rdSourcesValue').textContent,'Сайт (без B2B)');
 assert.equal(nextRoot.querySelector('#yearCityPresets').value,'msk');
 assert.equal(nextRoot.querySelector('#yearStepPresets').value,'day');
 assert.equal(nextRoot.querySelector('#yearToDate').value,'2026-11-19','Rolling preset resolves using the fresh date on the first render');
 console.log('PASS initial hidden layout, visible resize without network, repeat tab reveal, no resize loop and first-render saved filters');
}finally{
 for(const k of keys){if(previous[k])Object.defineProperty(globalThis,k,previous[k]);else delete globalThis[k];}
}
