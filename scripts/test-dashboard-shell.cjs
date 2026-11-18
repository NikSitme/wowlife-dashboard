const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const bootstrap=html.match(/<script id="dashboard-theme-bootstrap">([\s\S]*?)<\/script>/)[1];
const late=html.match(/\/\/ ---------- Theme switch[^\n]*\n([\s\S]*?)\n\n  window\.__opiuSetData/)[1];
assert(html.indexOf('id="dashboard-theme-bootstrap"')<html.indexOf('<link rel="stylesheet"'),'Theme must be restored before loading page styles/content');
assert(!/^\s*\.axis-label\s*\{\s*fill:\s*var\(--muted\)/m.test(html),'Sales/activation SVG tokens must not leak into other sections');
assert(!/^\s*\.gridline\s*\{\s*stroke:\s*var\(--gridline\)/m.test(html));
assert(html.includes('.salesact-root .axis-label { fill: var(--muted)'));
assert(html.includes('.salesact-root .gridline { stroke: var(--gridline)'));
assert(html.includes(':root[data-theme="dark"] .salesact-root'));
assert(html.includes(':root[data-theme="dark"] .wsale-root'));
assert(html.includes(':root:not([data-theme="light"]) .salesact-root:not([data-theme="light"])'));
assert(html.includes(':root:not([data-theme="light"]) .wsale-root:not([data-theme="light"])'));

function element(){return {attrs:{},handlers:{},active:false,setAttribute(k,v){this.attrs[k]=v;},removeAttribute(k){delete this.attrs[k];},getAttribute(k){return this.attrs[k]??null;},addEventListener(k,fn){this.handlers[k]=fn;},classList:{toggle(k,on){this.active=on;}}};}
for(const saved of ['light','dark','invalid',null,'denied'])for(const systemDark of [false,true]){
  const root=element(),sales=element(),analytics=element(),buttons=['light','dark'].map(choice=>{const b=element();b.attrs['data-theme-choice']=choice;return b;});
  let stored=saved;
  const context={document:{documentElement:root,querySelectorAll:()=>buttons,querySelector:s=>s==='.salesact-root'?sales:analytics},localStorage:{getItem(){if(saved==='denied')throw Error('Storage denied');return saved;},setItem(k,v){if(saved==='denied')throw Error('Storage denied');stored=v;}},window:{matchMedia:()=>({matches:systemDark})}};
  vm.runInNewContext(bootstrap,context);
  const expected=saved==='light'||saved==='dark'?saved:null;
  assert.equal(root.getAttribute('data-theme'),expected,'Bootstrap validates stored theme, otherwise follows the system');
  vm.runInNewContext(late,context);
  for(const el of [root,sales,analytics])assert.equal(el.getAttribute('data-theme'),expected,'Late initialization retains the first-paint theme');
  assert.equal(buttons[1].classList.active,expected==='dark'||expected===null&&systemDark,'The selected theme button matches the actual theme');
  buttons[0].handlers.click();
  for(const el of [root,sales,analytics])assert.equal(el.getAttribute('data-theme'),'light');
  assert.equal(stored,saved==='denied'?'denied':'light','Manual selection persists when storage is available');
}
const css=fs.readFileSync(path.join(__dirname,'../styles/dashboard-shell.css'),'utf8');
assert(/body\s*\{\s*font-family:\s*system-ui/.test(css));
assert(/\.dashboard-actions \.theme-switch\s*\{\s*position:\s*static/.test(css));
assert(css.includes('@media (max-width: 760px)'));
assert(css.includes('overflow-wrap: anywhere'));
console.log('PASS shell: first-paint validated light/dark/system/storage-denied themes, consistent nested sections, scoped SVG tokens and adaptive non-overlapping header controls');
