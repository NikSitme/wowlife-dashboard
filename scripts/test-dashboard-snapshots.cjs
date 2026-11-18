const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const snapshots=require('./dashboard-snapshots.cjs');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'dashboard-snapshots-'));
try{
 fs.mkdirSync(path.join(root,'data'));
 const original='{ "rows": [{"name":"<Услуга>","revenue":123.45,"count":0}] }';
 fs.writeFileSync(path.join(root,'data','sales.json'),original);
 let html='<script id="ws-dashboard-data" type="application/json" data-src="data/sales.json?v='+snapshots.hash(original)+'">{}</script>';
 html+='<script id="ws-dashboard-data-activations" type="application/json">{"rows":[]}</script>';
 html+='<script id="ws-dashboard-data-partners" type="application/json">{"rows":[]}</script>';
 const options={root};
 assert.equal(snapshots.readSnapshotText(html,'ws-dashboard-data',options),original,'Payload bytes remain unchanged on read');
 assert.equal(snapshots.readSnapshot(html,'ws-dashboard-data',options).rows[0].revenue,123.45);
 assert.deepEqual(snapshots.readSnapshot(html,'ws-dashboard-data-activations',options),{rows:[]});
 const hydrated=snapshots.hydrateSnapshots(html,options);assert(hydrated.includes(original));assert.equal(html.includes(original),false,'Hydration is in-memory only');
 const next={rows:[{name:'<Изменено>',revenue:-20,count:-1}]};
 const updated=snapshots.writeSnapshot(html,'ws-dashboard-data',next,options);
 assert(updated.includes('type="application/json"'));assert(updated.includes('>{}</script>'));
 assert(updated.includes('?v='+snapshots.hash(JSON.stringify(next).replace(/</g,'\\u003c'))));
 assert(!updated.includes('?v='+snapshots.hash(original)));
 assert.deepEqual(snapshots.readSnapshot(updated,'ws-dashboard-data',options),next);
 assert.equal(snapshots.readSnapshot(html,'ws-dashboard-data-activations',options).rows.length,0,'Other datasets remain untouched');
 const legacy=snapshots.writeSnapshot(html,'ws-dashboard-data-activations',next,options);
 assert(legacy.includes('\\u003cИзменено>'));assert.deepEqual(snapshots.readSnapshot(legacy,'ws-dashboard-data-activations',options),next);
 for(const src of ['https://example.com/data.json','../outside.json','data/../../outside.json','/data/sales.json','data/%2e%2e/outside.json']){
  const bad=html.replace(/data\/sales\.json\?v=[a-f0-9]+/,src);
  assert.throws(()=>snapshots.readSnapshot(bad,'ws-dashboard-data',options));
  assert.throws(()=>snapshots.writeSnapshot(bad,'ws-dashboard-data',next,options));
 }
 const outside=path.join(root,'outside.json');fs.writeFileSync(outside,'{}');fs.symlinkSync(outside,path.join(root,'data','escape.json'));
 assert.throws(()=>snapshots.readSnapshot(html.replace(/data\/sales\.json\?v=[a-f0-9]+/,'data/escape.json'),'ws-dashboard-data',options));
 console.log('PASS external/legacy snapshot reads, exact bytes, versioned writes, in-memory hydration and confined asset paths');
}finally{fs.rmSync(root,{recursive:true,force:true});}
