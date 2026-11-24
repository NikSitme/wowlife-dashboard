(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('./sales-analytics-model.js'));else root.LeadMetrics=factory(root.SalesAnalytics);})(typeof globalThis!=='undefined'?globalThis:this,function(sales){
  'use strict';
  var METRIC='crm-leads-filtered-v3',COMBINED='crm-filtered-leads-and-order-baskets-v4',EXCLUDED='Активации(Завершенные)';
  var EXCLUSIONS=[{stage:EXCLUDED,key:'activationExcluded'},{stage:'Спам',key:'spamExcluded'},{stage:'Дубль',key:'duplicateStageExcluded'},{stage:'Партнеры',key:'partnerExcluded'}];
  var EXCLUDED_STAGES=EXCLUSIONS.map(function(x){return x.stage;}),EXCLUDED_KEYS=EXCLUSIONS.map(function(x){return x.key;});
  function emptyCounts(){var counts={leads:0};EXCLUDED_KEYS.forEach(function(key){counts[key]=0;});return counts;}
  function excludedTotal(counts){return EXCLUDED_KEYS.reduce(function(sum,key){return sum+counts[key];},0);}
  function validPolicy(d){return Array.isArray(d.excludedStages)&&d.excludedStages.length===EXCLUDED_STAGES.length&&EXCLUDED_STAGES.every(function(stage,i){return d.excludedStages[i]===stage;});}
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
    var seen=new Map(),days={},first='',latest='',inputUnique=0,duplicates=0,afterCutoff=0,counts=emptyCounts();
    rows.slice(1).forEach(function(r){
      var key=String(r[id]||'').trim(),status=String(r[stage]||'').trim(),day=creation(r[date]);
      if(!/^\d+$/.test(key)||!status||!day)throw Error('Лиды: строка без корректного ID, стадии или даты');
      var signature=day+'|'+status;
      if(seen.has(key)){if(seen.get(key)!==signature)throw Error('Лиды: противоречащие строки одного ID');duplicates++;return;}
      seen.set(key,signature);inputUnique++;
      if(day>latest)latest=day;
      if(day>through){afterCutoff++;return;}
      if(!first||day<first)first=day;
      var d=days[day]||(days[day]=emptyCounts()),rule=EXCLUSIONS.find(function(x){return x.stage===status;}),key=rule?rule.key:'leads';
      d[key]++;counts[key]++;
    });
    if(!first)throw Error('Лиды: нет записей до даты среза');
    // Do not claim that an old export covers days after its latest record.
    var coverageEnd=latest<through?latest:through;
    for(var day=first;day<=coverageEnd;day=sales.shift(day,1))if(!days[day])days[day]=emptyCounts();
    return {version:3,metric:METRIC,timezone:'Europe/Moscow',scope:'all-crm-sources',includesBaskets:false,excludedStages:EXCLUDED_STAGES.slice(),coverageStart:first,coverageEnd:coverageEnd,through:through,latestCreated:latest,generated_at:generatedAt||new Date().toISOString(),totals:Object.assign({inputUnique:inputUnique,duplicates:duplicates,afterCutoff:afterCutoff},counts),days:days};
  }
  function withBaskets(crm,rows){
    if(!valid(crm)||crm.includesBaskets)throw Error('Корзины: нужен проверенный снимок лидов');
    var h=rows[0]||[],id=h.indexOf('ID'),date=h.indexOf('Дата создания');
    if(id<0||date<0)throw Error('Корзины: нужны ID и Дата создания');
    var seen=new Map(),byDay={},first='',latest='',duplicates=0,afterCutoff=0,beforeCoverage=0,baskets=0;
    rows.slice(1).forEach(function(r){
      var key=String(r[id]||'').trim(),day=creation(r[date]);
      if(!/^\d+$/.test(key)||!day)throw Error('Корзины: строка без корректного ID или даты создания');
      if(seen.has(key)){if(seen.get(key)!==day)throw Error('Корзины: противоречащие даты одного ID');duplicates++;return;}
      seen.set(key,day);if(!first||day<first)first=day;if(day>latest)latest=day;
      if(day>crm.coverageEnd){afterCutoff++;return;}
      if(day<crm.coverageStart){beforeCoverage++;return;}
      byDay[day]=(byDay[day]||0)+1;baskets++;
    });
    if(!first||first>crm.coverageStart||latest<crm.coverageEnd)throw Error('Корзины: история не покрывает период лидов');
    var days={};Object.keys(crm.days).forEach(function(day){var p=crm.days[day],b=byDay[day]||0;days[day]=Object.assign({},p,{leads:p.leads+b,crmLeads:p.leads,baskets:b});});
    return {version:4,metric:COMBINED,timezone:crm.timezone,scope:crm.scope,includesBaskets:true,excludedStages:EXCLUDED_STAGES.slice(),coverageStart:crm.coverageStart,coverageEnd:crm.coverageEnd,through:crm.through,latestCreated:latest>crm.latestCreated?latest:crm.latestCreated,generated_at:new Date().toISOString(),totals:Object.assign({},crm.totals,{inputUnique:crm.totals.inputUnique+seen.size,duplicates:crm.totals.duplicates+duplicates,afterCutoff:crm.totals.afterCutoff+afterCutoff,beforeCoverage:beforeCoverage,leads:crm.totals.leads+baskets,crmLeads:crm.totals.leads,baskets:baskets}),sources:{crm:Object.assign({},crm.totals,{sourceFile:crm.sourceFile,sourceSha256:crm.sourceSha256}),baskets:{inputUnique:seen.size,duplicates:duplicates,afterCutoff:afterCutoff,beforeCoverage:beforeCoverage,baskets:baskets,coverageStart:first,latestCreated:latest}},days:days};
  }
  function valid(d){
    if(d&&d.version===4)return validCombined(d);
    if(!d||d.version!==3||d.metric!==METRIC||d.timezone!=='Europe/Moscow'||d.scope!=='all-crm-sources'||d.includesBaskets!==false||!validPolicy(d)||!sales.isoDate(d.coverageStart)||!sales.isoDate(d.coverageEnd)||d.coverageStart>d.coverageEnd||!d.days||!d.totals)return false;
    var sum=emptyCounts();
    for(var day=d.coverageStart;day<=d.coverageEnd;day=sales.shift(day,1)){
      var p=d.days[day];if(!p||Object.keys(sum).some(function(k){return !Number.isSafeInteger(p[k])||p[k]<0;}))return false;
      Object.keys(sum).forEach(function(k){sum[k]+=p[k];});
    }
    return Object.keys(sum).every(function(k){return sum[k]===d.totals[k];})&&Number.isSafeInteger(d.totals.afterCutoff)&&d.totals.afterCutoff>=0&&Number.isSafeInteger(d.totals.inputUnique)&&sum.leads+excludedTotal(sum)+d.totals.afterCutoff===d.totals.inputUnique;
  }
  function validCombined(d){
    if(d.metric!==COMBINED||d.timezone!=='Europe/Moscow'||d.scope!=='all-crm-sources'||d.includesBaskets!==true||!validPolicy(d)||!sales.isoDate(d.coverageStart)||!sales.isoDate(d.coverageEnd)||d.coverageStart>d.coverageEnd||!sales.isoDate(d.through)||d.coverageEnd>d.through||!d.days||!d.totals||!d.sources||!d.sources.crm||!d.sources.baskets)return false;
    var sum=Object.assign(emptyCounts(),{crmLeads:0,baskets:0});
    for(var day=d.coverageStart;day<=d.coverageEnd;day=sales.shift(day,1)){
      var p=d.days[day];if(!p||Object.keys(sum).some(function(k){return !Number.isSafeInteger(p[k])||p[k]<0;})||p.leads!==p.crmLeads+p.baskets)return false;
      Object.keys(sum).forEach(function(k){sum[k]+=p[k];});
    }
    if(Object.keys(sum).some(function(k){return sum[k]!==d.totals[k];}))return false;
    var c=d.sources.crm,b=d.sources.baskets,t=d.totals;
    if(!sales.isoDate(b.coverageStart)||b.coverageStart>d.coverageStart||!sales.isoDate(b.latestCreated)||b.latestCreated<d.coverageEnd)return false;
    if([c.inputUnique,c.duplicates,c.afterCutoff,b.inputUnique,b.duplicates,b.afterCutoff,b.beforeCoverage,t.inputUnique,t.duplicates,t.afterCutoff,t.beforeCoverage].some(function(n){return !Number.isSafeInteger(n)||n<0;}))return false;
    return c.leads===sum.crmLeads&&EXCLUDED_KEYS.every(function(k){return c[k]===sum[k];})&&c.leads+excludedTotal(c)+c.afterCutoff===c.inputUnique&&b.baskets===sum.baskets&&b.baskets+b.beforeCoverage+b.afterCutoff===b.inputUnique&&t.inputUnique===c.inputUnique+b.inputUnique&&t.duplicates===c.duplicates+b.duplicates&&t.afterCutoff===c.afterCutoff+b.afterCutoff&&t.beforeCoverage===b.beforeCoverage&&t.leads+excludedTotal(t)+t.afterCutoff+t.beforeCoverage===t.inputUnique;
  }
  function rangeStats(d,from,to){
    if(!d||!sales.isoDate(from)||!sales.isoDate(to)||from>to||from<d.coverageStart||to>d.coverageEnd)return null;
    var result=emptyCounts();if(d.includesBaskets){result.crmLeads=0;result.baskets=0;}
    for(var day=from;day<=to;day=sales.shift(day,1)){var p=d.days[day];if(!p)return null;Object.keys(result).forEach(function(k){result[k]+=p[k];});}return result;
  }
  return {METRIC:METRIC,COMBINED:COMBINED,EXCLUDED:EXCLUDED,EXCLUDED_STAGES:EXCLUDED_STAGES.slice(),creation:creation,fromRows:fromRows,withBaskets:withBaskets,valid:valid,rangeStats:rangeStats};
});
