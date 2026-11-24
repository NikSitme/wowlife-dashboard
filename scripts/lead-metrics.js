(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('./sales-analytics-model.js'));else root.LeadMetrics=factory(root.SalesAnalytics);})(typeof globalThis!=='undefined'?globalThis:this,function(sales){
  'use strict';
  var METRIC='crm-leads-without-activations-v1',EXCLUDED='Активации(Завершенные)';
  // Bitrix CSV creation timestamps are already Moscow time, unlike the UTC text in the old Sheets feed.
  function creation(value){
    var m=String(value||'').trim().match(/^(\d{2})\.(\d{2})\.(\d{4}) (\d{2}):(\d{2}):(\d{2})$/);
    if(!m||+m[4]>23||+m[5]>59||+m[6]>59)return null;
    var day=m[3]+'-'+m[2]+'-'+m[1];return sales.isoDate(day)?day:null;
  }
  function fromRows(rows,through,generatedAt){
    if(!sales.isoDate(through))throw Error('Лиды: некорректная дата среза');
    var h=rows[0]||[],id=h.indexOf('ID'),stage=h.indexOf('Стадия'),date=h.indexOf('Дата создания');
    if(id<0||stage<0||date<0)throw Error('Лиды: нужны ID, Стадия и Дата создания');
    var seen=new Map(),days={},first='',latest='',inputUnique=0,duplicates=0,afterCutoff=0,included=0,excluded=0;
    rows.slice(1).forEach(function(r){
      var key=String(r[id]||'').trim(),status=String(r[stage]||'').trim(),day=creation(r[date]);
      if(!/^\d+$/.test(key)||!status||!day)throw Error('Лиды: строка без корректного ID, стадии или даты');
      var signature=day+'|'+status;
      if(seen.has(key)){if(seen.get(key)!==signature)throw Error('Лиды: противоречащие строки одного ID');duplicates++;return;}
      seen.set(key,signature);inputUnique++;
      if(day>latest)latest=day;
      if(day>through){afterCutoff++;return;}
      if(!first||day<first)first=day;
      var d=days[day]||(days[day]={leads:0,activationExcluded:0});
      if(status===EXCLUDED){d.activationExcluded++;excluded++;}else{d.leads++;included++;}
    });
    if(!first)throw Error('Лиды: нет записей до даты среза');
    // Do not claim that an old export covers days after its latest record.
    var coverageEnd=latest<through?latest:through;
    for(var day=first;day<=coverageEnd;day=sales.shift(day,1))if(!days[day])days[day]={leads:0,activationExcluded:0};
    return {version:1,metric:METRIC,timezone:'Europe/Moscow',scope:'all-crm-sources',includesBaskets:false,excludedStage:EXCLUDED,coverageStart:first,coverageEnd:coverageEnd,through:through,latestCreated:latest,generated_at:generatedAt||new Date().toISOString(),totals:{inputUnique:inputUnique,duplicates:duplicates,afterCutoff:afterCutoff,leads:included,activationExcluded:excluded},days:days};
  }
  function valid(d){
    if(!d||d.version!==1||d.metric!==METRIC||d.timezone!=='Europe/Moscow'||d.scope!=='all-crm-sources'||d.includesBaskets!==false||d.excludedStage!==EXCLUDED||!sales.isoDate(d.coverageStart)||!sales.isoDate(d.coverageEnd)||d.coverageStart>d.coverageEnd||!d.days||!d.totals)return false;
    var leads=0,excluded=0;
    for(var day=d.coverageStart;day<=d.coverageEnd;day=sales.shift(day,1)){
      var p=d.days[day];if(!p||!Number.isSafeInteger(p.leads)||p.leads<0||!Number.isSafeInteger(p.activationExcluded)||p.activationExcluded<0)return false;
      leads+=p.leads;excluded+=p.activationExcluded;
    }
    return leads===d.totals.leads&&excluded===d.totals.activationExcluded&&leads+excluded+d.totals.afterCutoff===d.totals.inputUnique;
  }
  function rangeStats(d,from,to){
    if(!d||!sales.isoDate(from)||!sales.isoDate(to)||from>to||from<d.coverageStart||to>d.coverageEnd)return null;
    var leads=0,excluded=0;
    for(var day=from;day<=to;day=sales.shift(day,1)){var p=d.days[day];if(!p)return null;leads+=p.leads;excluded+=p.activationExcluded;}
    return {leads:leads,activationExcluded:excluded};
  }
  return {METRIC:METRIC,EXCLUDED:EXCLUDED,creation:creation,fromRows:fromRows,valid:valid,rangeStats:rangeStats};
});
