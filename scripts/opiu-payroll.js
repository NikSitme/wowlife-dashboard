(function(root){
  'use strict';
  // Management classification only. The Adesk source rows/P&L stay unchanged.
  function withCreators(month){
    if (month.creatorPayrollApplied) return month;
    var amount = -(Number((month.rows || {})['Блогеры']) || 0);
    var advertising = (month.indirect_breakdown || []).find(function(x){ return x.name === 'Закупка рекламы'; });
    // If the source itself has moved the article to payroll, do not move it twice.
    var parent = '';
    (month.source_pl || []).some(function(row){
      if (row.label === 'Блогеры') return true;
      if (row.label === 'ФОТ Маркетинга' || row.label === 'Закупка рекламы') parent = row.label;
      return false;
    });
    if (!amount || !advertising || parent === 'ФОТ Маркетинга') return month;
    var personnel = (month.personnel_breakdown || []).map(function(x){ return {name:x.name, value:x.value}; });
    var marketing = personnel.find(function(x){ return x.name === 'ФОТ Маркетинга'; });
    if (!marketing) { marketing = {name:'ФОТ Маркетинга', value:0}; personnel.push(marketing); }
    marketing.value += amount;
    return Object.assign({}, month, {
      creatorPayrollApplied: true,
      personnel_total: (month.personnel_total || 0) + amount,
      indirect_total: (month.indirect_total || 0) - amount,
      personnel_breakdown: personnel,
      indirect_breakdown: month.indirect_breakdown.map(function(x){
        return {name:x.name, value:x.value - (x.name === 'Закупка рекламы' ? amount : 0)};
      })
    });
  }
  var api = {withCreators:withCreators};
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.OpiuPayroll = api;
})(typeof window === 'object' ? window : globalThis);
