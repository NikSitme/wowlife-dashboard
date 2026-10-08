const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const html = fs.readFileSync(require('node:path').join(__dirname, '../index.html'), 'utf8');
const start = html.indexOf('  function calendarMonth(offset)');
const end = html.indexOf('  var CUSTOM_IDX', start);
const now = new Date('2026-10-08T19:00:00Z');
class ClockDate extends Date { constructor(...args) { super(...(args.length ? args : [now])); } }
const context = { Date: ClockDate, Intl, DATA: ['2026-07', '2026-08', '2026-09'].map(label => ({ label })) };
vm.createContext(context);
vm.runInContext(html.slice(start, end), context);
// October is absent from an old cache: "previous month" must still mean September.
assert.equal(context.PRESETS[0].get(), null);
assert.deepEqual(Array.from(context.PRESETS[1].get()), [2, 2]);
// Missing September must never be silently replaced with August's B2B receipts.
context.DATA.pop();
assert.equal(context.PRESETS[1].get(), null);
// Moscow has already reached January while UTC is still in December.
now.setTime(new Date('2025-12-31T22:00:00Z').getTime());
context.DATA = [{ label: '2025-12' }, { label: '2026-01' }];
assert.equal(context.calendarMonth(0), '2026-01');
assert.deepEqual(Array.from(context.PRESETS[1].get()), [0, 0]);
console.log('OPiU calendar: stale cache, missing month and Moscow year rollover passed.');
