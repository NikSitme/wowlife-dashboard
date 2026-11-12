// Checks the approved project's API without changing its state or creating test projects.
const fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto'),assert=require('node:assert/strict'),path=require('node:path');
const ctx={window:{}};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'pricing-project-config.js'),'utf8'),ctx);
const config=ctx.window.WOWLIFE_PROJECT_CONFIG;
async function main(){
 const c={id:config.defaultProjectId};assert(c.id,'Default public project missing');
 const args={p_id:c.id,p_key:null};
 const call=async(name,body)=>{const r=await fetch(config.url+'/rest/v1/rpc/pricing_project_'+name,{method:'POST',headers:{apikey:config.anonKey,'Content-Type':'application/json'},body:JSON.stringify(body)});return {status:r.status,data:await r.json()};};
 const first=await call('read',args);assert.equal(first.status,200);const p=first.data;
 const denied=await call('read',{p_id:'00000000-0000-4000-8000-000000000000',p_key:null});assert([401,403].includes(denied.status));
 const stale=await call('save',{...args,p_revision:-1,p_state:p.state,p_mutation:crypto.randomUUID(),p_allow_empty:false});assert.equal(stale.data.status,'conflict');assert.equal(stale.data.project.revision,p.revision);
 const missingRevision=await call('save',{...args,p_revision:null,p_state:p.state,p_mutation:crypto.randomUUID(),p_allow_empty:null});assert(missingRevision.status>=400);
 const noop=await call('save',{...args,p_revision:p.revision,p_state:p.state,p_mutation:crypto.randomUUID(),p_allow_empty:false});assert.equal(noop.status,200);assert.equal(noop.data.status,'saved');assert.equal(noop.data.project.revision,p.revision);
 const history=await call('history',args);assert.equal(history.status,200);assert(Array.isArray(history.data.versions));
 const invalidVersion=await call('version',{...args,p_revision:-100});assert(invalidVersion.status>=400);
 const last=await call('read',args);assert.deepEqual(last.data.state,p.state);assert.equal(last.data.revision,p.revision);
 const out={projectId:c.id,title:p.title,read:true,publicReadWithoutKey:true,unknownProjectDenied:denied.status,staleRevisionBlocked:true,nullRevisionDenied:true,noOpPreservedRevision:true,historyAvailable:true,invalidVersionDenied:true,stateUnchanged:true,revision:p.revision};
 if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify(out,null,2)+'\n');console.log(JSON.stringify(out));
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
