const assert=require('node:assert/strict');
const Runtime=require('./dashboard-runtime');
const frames=new Map(),errors=[];let next=0;
let time=0;const runtime=Runtime.create({schedule:fn=>{frames.set(++next,fn);return next;},cancel:id=>frames.delete(id),now:()=>++time,onError:(error,key)=>errors.push([key,error.message])});
function tick(){const work=Array.from(frames.values());frames.clear();work.forEach(fn=>fn());}
let visible=false,renders=0;
const render=runtime.register('opiu',()=>renders++,()=>visible);
render();render();assert.equal(frames.size,0);assert.equal(renders,0);assert(render.pending());
visible=true;runtime.activate('opiu');assert.equal(renders,1);assert(!render.pending());assert.equal(frames.size,0);
runtime.activate('opiu');assert.equal(renders,1,'Clean sections need no work on repeat activation');
render();render();render();assert.equal(frames.size,1);tick();assert.equal(renders,2,'Batch updates coalesce into one visible render');
render();visible=false;tick();assert(render.pending());assert.equal(renders,2,'A section hidden before the frame stays dirty');
visible=true;runtime.activate('opiu');assert.equal(renders,3);
const bad=runtime.register('broken',()=>{throw new Error('render failed');},()=>true);
let goodRenders=0;const good=runtime.register('healthy',()=>goodRenders++,()=>true);
bad();good();tick();assert.equal(goodRenders,1);assert.deepEqual(errors,[['broken','render failed']]);assert.equal(runtime.stats().broken.error,'render failed');
let selfRenders=0;const self=runtime.register('invalidated',()=>{if(++selfRenders===1)self();},()=>true);
self();tick();assert.equal(selfRenders,1);assert(self.pending());assert.equal(frames.size,1);tick();assert.equal(selfRenders,2);
render();assert.equal(frames.size,1);render.immediate();assert.equal(renders,4);assert.equal(frames.size,0,'Immediate navigation cancels a redundant frame');
good();good.dispose();assert.equal(frames.size,0);assert(!runtime.stats().healthy);
assert.throws(()=>runtime.register('opiu',()=>{},()=>true),/already registered/);
assert.deepEqual(runtime.stats().opiu,{pending:false,requests:8,renders:4,error:null,lastDuration:1,totalDuration:4});
const oldDocument=globalThis.document,attrs={};
globalThis.document={querySelector(selector){assert.equal(selector,'[data-panel="metrics"]');return {setAttribute:(key,value)=>attrs[key]=value};}};
try{
 let shown=false;const measured=runtime.register('metrics',()=>{},()=>shown);
 assert.deepEqual(attrs,{'data-render-count':'0','data-render-ms':'0'});measured();assert.equal(attrs['data-render-count'],'0');
 shown=true;runtime.activate('metrics');assert.deepEqual(attrs,{'data-render-count':'1','data-render-ms':'1'});
}finally{if(oldDocument===undefined)delete globalThis.document;else globalThis.document=oldDocument;}
console.log('PASS render runtime: hidden updates, first reveal, coalesced frames, hide-before-frame, clean activation, error isolation, reentrant invalidation, immediate flush and disposal');
console.log('PASS local-only render diagnostics: deterministic duration totals, zero hidden renders and DOM attributes on first reveal');
