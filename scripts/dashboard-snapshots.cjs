// Build/test access to analytics snapshots. Runtime reads each tag's data-src.
// readSnapshot(html,id,{root}) returns parsed data; readSnapshotText preserves bytes.
// writeSnapshot(html,id,value,{root}) updates the external JSON + content version,
// or preserves legacy inline storage when no data-src exists. It returns new HTML.
// hydrateSnapshots(html,{root}) is for source-based tests, not published HTML.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const ROOT=path.resolve(__dirname,'..');
const IDS=['ws-dashboard-data','ws-dashboard-data-activations','ws-dashboard-data-partners'];
const hash=text=>crypto.createHash('sha256').update(text).digest('hex').slice(0,16);

function tag(html,id){
 if(!IDS.includes(id))throw Error('Unknown dashboard snapshot: '+id);
 const pattern=new RegExp('(<script\\b[^>]*\\bid=["\\\']'+id+'["\\\'][^>]*>)([\\s\\S]*?)(<\\/script>)','i');
 const match=pattern.exec(html);if(!match)throw Error('Missing dashboard snapshot: '+id);
 const attr=match[1].match(/\bdata-src\s*=\s*(["'])(.*?)\1/i);
 return {match,src:attr&&attr[2]};
}
function sourcePath(src,root){
 if(!/^data\/[A-Za-z0-9._/-]+\.json(?:\?v=[a-f0-9]{8,64})?$/i.test(src))throw Error('Invalid dashboard snapshot source: '+src);
 root=fs.realpathSync(root);
 const dataRoot=fs.realpathSync(path.join(root,'data'));
 const file=path.resolve(root,src.split('?')[0]);
 if(!file.startsWith(dataRoot+path.sep))throw Error('Dashboard snapshot source is outside data/');
 // Existing symlinks may not escape the repository, including parent directories.
 const actual=fs.existsSync(file)?fs.realpathSync(file):path.join(fs.realpathSync(path.dirname(file)),path.basename(file));
 if(!actual.startsWith(dataRoot+path.sep))throw Error('Dashboard snapshot source is outside data/');
 return file;
}
function readSnapshotText(html,id,{root=ROOT}={}){
 const found=tag(html,id);
 return found.src?fs.readFileSync(sourcePath(found.src,root),'utf8'):found.match[2];
}
function readSnapshot(html,id,options){return JSON.parse(readSnapshotText(html,id,options));}
function writeSnapshot(html,id,value,{root=ROOT}={}){
 const found=tag(html,id),text=JSON.stringify(value).replace(/</g,'\\u003c');
 let start=found.match[1],body=text;
 if(found.src){
  fs.writeFileSync(sourcePath(found.src,root),text);
  const next=found.src.split('?')[0]+'?v='+hash(text);
  start=start.replace(/(\bdata-src\s*=\s*)(["'])(.*?)\2/i,(_,prefix,quote)=>prefix+quote+next+quote);
  body='{}';
 }
 return html.slice(0,found.match.index)+start+body+found.match[3]+html.slice(found.match.index+found.match[0].length);
}
function hydrateSnapshots(html,options){
 for(const id of IDS){const found=tag(html,id);if(found.src){const text=readSnapshotText(html,id,options);html=html.slice(0,found.match.index)+found.match[1]+text+found.match[3]+html.slice(found.match.index+found.match[0].length);}}
 return html;
}
module.exports={IDS,hash,readSnapshot,readSnapshotText,writeSnapshot,hydrateSnapshots};
