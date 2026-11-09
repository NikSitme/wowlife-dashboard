// Build public ID/name lookup from the verified catalog audit; no payouts or contacts.
// node scripts/build-comparison-products.cjs phase4-model.json.gz pages.json.gz
const fs = require('node:fs');
const zlib = require('node:zlib');
const path = require('node:path');
const [modelPath, pagesPath] = process.argv.slice(2);
if (!modelPath || !pagesPath) throw new Error('Expected catalog model and site pages (.json.gz)');
const read = file => JSON.parse(zlib.gunzipSync(fs.readFileSync(file)));
const model = read(modelPath), pages = read(pagesPath), products = new Map();
for (const p of Object.values(model.fullCatalog).concat(model.services, model.sets)) {
  const id = String(p.sid || p.id);
  if (/^\d+$/.test(id) && p.name) products.set(id, {id, name:p.name, city:p.city, aliases:[]});
}
for (const page of pages) for (const offer of page.offers || []) {
  const p = products.get(String(offer.id));
  if (p) p.aliases = [...new Set(p.aliases.concat([offer.name, page.title]).filter(n => n && n !== p.name))];
}
const output = {schemaVersion:1, asOf:'2026-11-06', source:'Проверенный каталог услуг и наборов; названия карточек сайта', products:[...products.values()]};
fs.writeFileSync(path.join(__dirname, '../data/comparison-products.json'), JSON.stringify(output)+'\n');
console.log('Comparison product IDs:', products.size);
