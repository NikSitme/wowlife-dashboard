(function(root,factory){
  var api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.LeadActivity=api;
})(typeof window==='object'?window:globalThis,function(){
  'use strict';
  var WEEKDAYS=['Понедельник','Вторник','Среда','Четверг','Пятница','Суббота','Воскресенье'];
  function iso(s){return /^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(+new Date(s+'T00:00:00Z'))&&new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s;}
  function addDays(s,n){var d=new Date(s+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);}
  function today(){return new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Moscow',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());}
  function annualRange(asOf){var y=+asOf.slice(0,4)-1,m=+asOf.slice(5,7),day=+asOf.slice(8,10),last=new Date(Date.UTC(y,m,0)).getUTCDate();return {from:y+'-'+String(m).padStart(2,'0')+'-'+String(Math.min(day,last)).padStart(2,'0'),to:addDays(asOf,-1)};}
  // Plain text in the Leads export is UTC; verified against original CRM creation timestamps.
  function creation(value){
    var s=String(value||'').trim(),m=s.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}):(\d{2}):(\d{2})(Z|[+-]\d{2}:\d{2})?$/);
    if(!m||!iso(m[1])||+m[2]>23||+m[3]>59||+m[4]>59)return null;
    var d=new Date(m[1]+'T'+m[2]+':'+m[3]+':'+m[4]+(m[5]||'Z'));
    return Number.isFinite(+d)?new Date(+d+10800000).toISOString().slice(0,19):null;
  }
  function fromRows(rows){
    var h=(rows[0]||[]).map(function(v){return String(v).trim().toLowerCase();}),id=h.indexOf('id лида'),dt=h.indexOf('дата создания');
    if(id<0||dt<0)throw new Error('Лиды: не найдены ID лида и дата создания');
    var days={},seen=new Set(),invalid=0,duplicates=0,latest='',first='';
    rows.slice(1).forEach(function(r){
      if(!r.some(function(v){return String(v||'').trim();}))return;
      var key=String(r[id]||'').trim(),date=creation(r[dt]);
      if(!key||!date){invalid++;return;}if(seen.has(key)){duplicates++;return;}seen.add(key);
      var day=date.slice(0,10),hour=+date.slice(11,13);(days[day]||(days[day]=Array(24).fill(0)))[hour]++;
      if(!first||date<first)first=date;if(date>latest)latest=date;
    });
    if(!seen.size||invalid)throw new Error('Лиды: '+(invalid?'есть строки без ID или корректной даты ('+invalid+')':'источник пуст')+'; сохранён предыдущий снимок');
    return {version:1,timezone:'Europe/Moscow',coverageStart:first.slice(0,10),coverageEnd:latest.slice(0,10),latest:latest,total:seen.size,duplicates:duplicates,invalid:invalid,days:days};
  }
  function validate(data){
    if(!data||data.version!==1||data.timezone!=='Europe/Moscow'||!iso(data.coverageStart)||!iso(data.coverageEnd)||data.coverageStart>data.coverageEnd||!data.days)throw new Error('Лиды: некорректный снимок');
    var total=0;Object.keys(data.days).forEach(function(d){var a=data.days[d];if(!iso(d)||d<data.coverageStart||d>data.coverageEnd||!Array.isArray(a)||a.length!==24||a.some(function(n){return !Number.isInteger(n)||n<0;}))throw new Error('Лиды: некорректные дневные значения');total+=a.reduce(function(s,n){return s+n;},0);});
    if(total!==data.total)throw new Error('Лиды: сумма снимка не сходится');return data;
  }
  function analyze(data,from,to){
    validate(data);if(!iso(from)||!iso(to)||from>to)throw new Error('Лиды: проверьте границы периода');
    var start=from<data.coverageStart?data.coverageStart:from,end=to>data.coverageEnd?data.coverageEnd:to;
    var matrix=Array.from({length:7},function(){return Array(24).fill(0);}),exposure=Array(7).fill(0),hours=Array(24).fill(0),total=0,dayCount=0;
    for(var d=start;d<=end;d=addDays(d,1)){
      var w=(new Date(d+'T00:00:00Z').getUTCDay()+6)%7;exposure[w]++;dayCount++;
      (data.days[d]||Array(24).fill(0)).forEach(function(n,h){matrix[w][h]+=n;hours[h]+=n;total+=n;});
    }
    var weekdays=matrix.map(function(a,w){var n=a.reduce(function(s,x){return s+x;},0);return {day:w,count:n,days:exposure[w],average:exposure[w]?n/exposure[w]:null};});
    var cells=[];matrix.forEach(function(a,w){a.forEach(function(n,h){if(exposure[w])cells.push({day:w,hour:h,count:n,average:n/exposure[w]});});});
    return {from:start,to:end,requestedFrom:from,requestedTo:to,partial:start!==from||end!==to,total:total,days:dayCount,matrix:matrix,exposure:exposure,hours:hours,weekdays:weekdays,topDays:weekdays.filter(function(x){return x.days;}).sort(function(a,b){return b.average-a.average||a.day-b.day;}).slice(0,3),topHours:hours.map(function(n,h){return {hour:h,count:n};}).sort(function(a,b){return b.count-a.count||a.hour-b.hour;}).slice(0,3),topCells:cells.sort(function(a,b){return b.average-a.average||a.day-b.day||a.hour-b.hour;}).slice(0,3)};
  }
  return {WEEKDAYS:WEEKDAYS,iso:iso,addDays:addDays,today:today,annualRange:annualRange,creation:creation,fromRows:fromRows,validate:validate,analyze:analyze};
});
