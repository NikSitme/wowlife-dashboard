(function(){
  'use strict';
  var root=document.getElementById('productMetrics');if(!root)return;
  var model=window.ProductMetrics,data=null,report=null,started=false,loading=false,requestId=0,reportKey='',error='',storageKey='wowlife-product-metrics-v1';
  var metrics=[{id:'users',label:'Пользователи',unit:'count',color:'#2871d9'},{id:'leads',label:'Лиды',unit:'count',color:'#6256bd'},{id:'buyers',label:'Платящие пользователи',unit:'count',color:'#d43b3b'},{id:'payments',label:'Payments',unit:'count',color:'#16a085'},{id:'avgPrice',label:'Av. price',unit:'money',color:'#ad6bc7'},{id:'revenue',label:'Revenue',unit:'money',color:'#d49a24'},{id:'c1',label:'C1',unit:'percent',color:'#e05f83'}];
  var leadData=null,leadError='',leadLoading=false;
  var detailMonth=null,dayReport=null,dayReportKey='',dayRequestId=0,dayLoading=false,dayError='';
  var state={selected:['users','revenue'],from:null,to:null,mode:'values'},points=[],getReport=window.MetrikaUsers.client(function(url,options){var controller=new AbortController(),timer=setTimeout(function(){controller.abort();},30000);return fetch(url,Object.assign({},options,{signal:controller.signal})).finally(function(){clearTimeout(timer);});});
  try{var saved=JSON.parse(localStorage.getItem(storageKey)||'null');if(saved){state.selected=Array.isArray(saved.selected)?saved.selected.filter(function(id){return metrics.some(function(m){return m.id===id;});}):state.selected;state.from=/^\d{4}-\d{2}$/.test(saved.from)?saved.from:null;state.to=/^\d{4}-\d{2}$/.test(saved.to)?saved.to:null;state.mode=saved.mode==='index'?'index':'values';}}catch(ignored){}
  function $(id){return document.getElementById(id);}
  function persist(){try{localStorage.setItem(storageKey,JSON.stringify(state));}catch(ignored){}}
  function label(ym){return new Date(ym+'-01T00:00:00Z').toLocaleDateString('ru-RU',{month:'short',year:'numeric',timeZone:'UTC'});}
  function dateLabel(d){return d.split('-').reverse().join('.');}
  function format(value,metric){if(value===null||!Number.isFinite(value))return '—';return metric==='c1'?(value*100).toLocaleString('ru-RU',{maximumFractionDigits:2})+'%':value.toLocaleString('ru-RU',{maximumFractionDigits:metric==='avgPrice'||metric==='revenue'?2:0})+(metric==='avgPrice'||metric==='revenue'?' ₽':'');}
  function escape(s){return String(s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function validMonth(m){return /^\d{4}-(0[1-9]|1[0-2])$/.test(m||'');}
  function bounds(){var keys=Object.keys(data.months).sort(),lo=keys[0],hi=keys[keys.length-1];if(!validMonth(state.to))state.to=hi;state.to=state.to<lo?lo:state.to>hi?hi:state.to;if(!validMonth(state.from))state.from=model.addMonths(state.to,-11);state.from=state.from<lo?lo:state.from>state.to?state.to:state.from;
    ['pmFrom','pmTo'].forEach(function(id){$(id).disabled=false;$(id).min=data.sourceStart;$(id).max=data.sourceEnd;});$('pmPreset').disabled=false;$('pmPreset').value=state.from===model.addMonths(hi,-1)&&state.to===state.from?'last_month':state.from===model.addMonths(hi,-11)&&state.to===hi?'12m':state.from===hi.slice(0,4)+'-01'&&state.to===hi?'year':state.from===lo&&state.to===hi?'all':'custom';$('pmFrom').value=state.from+'-01';$('pmTo').value=data.months[state.to].to;if(window.WowlifeDatePicker){window.WowlifeDatePicker.enhance(root);window.WowlifeDatePicker.refresh();}$('pmMode').value=state.mode;
  }
  function pointLabel(p){return p.date?new Date(p.date+'T00:00:00Z').toLocaleDateString('ru-RU',{day:'numeric',month:'short',timeZone:'UTC'}):label(p.month);}
  function cells(p){return ['users','leads','buyers','payments','avgPrice','revenue','c1'].map(function(id){return '<td'+(id==='c1'?' title="Новые покупатели: '+format(p.newBuyers,'buyers')+'"':id==='leads'&&p.leads!==null?' title="Лиды CRM: '+format(p.crmLeads,'leads')+' + корзины: '+format(p.baskets,'leads')+'"':'')+'>'+format(p[id],id)+'</td>';}).join('');}
  function openMonth(ym,fromChart){if(!data||!data.months[ym])return;detailMonth=detailMonth===ym?null:ym;dayRequestId++;dayReport=null;dayReportKey='';dayError='';dayLoading=false;draw();if(detailMonth)loadDays(false);if(fromChart)$('pmBack').scrollIntoView({block:'start',behavior:'smooth'});}
  function closeMonth(){detailMonth=null;dayRequestId++;dayLoading=false;dayError='';draw();}
  function loadDays(force){
    if(!data||!detailMonth||!data.days)return;
    var m=data.months[detailMonth],key=m.from+'|'+m.to;
    if(!force&&key===dayReportKey)return;dayReportKey=key;dayReport=null;dayError='';dayLoading=true;var id=++dayRequestId;draw();
    getReport({from:m.from,to:m.to,step:'day'}).then(function(r){if(id!==dayRequestId)return;if(r.sampled)throw Error('ответ получен с семплированием');dayReport=r;}).catch(function(e){if(id===dayRequestId)dayError=e.name==='AbortError'?'истекло время ожидания':e.message;}).finally(function(){if(id===dayRequestId){dayLoading=false;draw();}});
  }
  function withLeads(list){return list.map(function(p){var value=leadData?window.LeadMetrics.rangeStats(leadData,p.from,p.to):null;return Object.assign({},p,{leads:value?value.leads:null,crmLeads:value?value.crmLeads:null,baskets:value?value.baskets:null});});}
  function draw(){
    if(!data)return;bounds();if(detailMonth&&(detailMonth<state.from||detailMonth>state.to)){detailMonth=null;dayRequestId++;dayLoading=false;}var monthly=withLeads(model.series(data,state.from,state.to,report));points=detailMonth?withLeads(model.dailySeries(data,detailMonth,dayReport)):monthly;
    $('pmMeta').textContent='Сайт и прямые продажи · CRM по '+dateLabel(data.sourceEnd)+' · даты по Москве';
    $('pmTableBody').innerHTML=monthly.map(function(p){var partial=p.from!==p.month+'-01'||p.to!==model.monthEnd(p.month),opened=detailMonth===p.month;var row='<tr class="pm-month-row'+(opened?' pm-month-open':'')+'"><td><button type="button" class="pm-month-toggle" data-month="'+p.month+'" aria-expanded="'+opened+'"'+(opened?' aria-controls="pmDays"':'')+'><span aria-hidden="true">'+(opened?'▾':'▸')+'</span>'+label(p.month)+'</button>'+(partial?'<small>по '+dateLabel(p.to)+'</small>':'')+'</td>'+cells(p)+'</tr>';
      if(opened){var header=$('pmTableHead').innerHTML.replace('Месяц','День');row+='<tr class="pm-days-row"><td colspan="8"><div id="pmDays" class="pm-days" role="region" aria-label="Дни за '+label(p.month)+'">'+(points.length?'<table class="pm-table pm-day-table"><thead>'+header+'</thead><tbody>'+points.map(function(d){return '<tr><td>'+pointLabel(d)+'</td>'+cells(d)+'</tr>';}).join('')+'</tbody></table>':'<p>Дневные данные появятся после обновления показателей.</p>')+'</div></td></tr>';}
      return row;
    }).join('');
    $('pmBack').hidden=!detailMonth;$('pmDetailLabel').textContent=detailMonth?label(detailMonth)+' · по дням':'По месяцам · нажмите на месяц, чтобы раскрыть дни';
    $('pmDailyRefresh').hidden=!detailMonth||!!data.days;
    $('pmCoverage').hidden=false;
    $('pmCoverage').textContent=leadLoading?'Загружаю лиды и корзины…':leadError?'Лиды недоступны: '+leadError:leadData?'Лиды = CRM без стадии «Активации(Завершенные)» + все корзины из воронки заказов, по дате создания. Все остальные стадии и источники включены. Снимок '+dateLabel(leadData.latestCreated)+' · доступны по '+dateLabel(leadData.coverageEnd)+'. За даты вне выгрузки — прочерк.':'Лиды CRM ещё не загружены.';
    var activeReport=detailMonth?dayReport:report,activeLoading=detailMonth?dayLoading:loading,activeError=detailMonth?dayError:error;
    $('pmMetrikaStatus').textContent=activeLoading?'Загружаю пользователей из Яндекс.Метрики…':activeError?'Пользователи и C1 недоступны: '+activeError:activeReport?'Метрика: уникальные посетители '+(detailMonth?'каждого дня':'каждого месяца')+' · обновлено '+new Date(activeReport.generated_at).toLocaleString('ru-RU',{timeZone:'Europe/Moscow'}):'Пользователи и C1 загружаются отдельно от заказов.';
    $('pmRetry').hidden=!activeError;chart();
  }
  function showTooltip(i,x){var p=points[i];if(!p)return;var tip=$('pmTooltip');tip.innerHTML='<div class="pm-tip-heading">'+escape(pointLabel(p))+'<span>Показатели</span></div>'+metrics.filter(function(m){return state.selected.includes(m.id);}).map(function(m){return '<div class="pm-tip-row"><i style="border-color:'+m.color+'"></i><span>'+m.label+'</span><strong>'+format(p[m.id],m.id)+'</strong></div>';}).join('');tip.hidden=false;var w=$('pmChart').clientWidth;tip.style.left=Math.max(8,Math.min(w-tip.offsetWidth-8,x-tip.offsetWidth/2))+'px';tip.style.top='8px';var guide=$('pmGuide');if(guide){guide.setAttribute('x1',String(x));guide.setAttribute('x2',String(x));guide.removeAttribute('hidden');}}
  function chart(){
    var host=$('pmChart'),selected=metrics.filter(function(m){return state.selected.includes(m.id);});
    if(!points.length){host.innerHTML='<div class="pm-chart-empty">Дневные данные появятся после обновления показателей.</div><div id="pmTooltip" class="pm-tooltip" hidden></div>';return;}
    if(!selected.length){host.innerHTML='<div class="pm-chart-empty">Выберите метрики для сравнения.</div><div id="pmTooltip" class="pm-tooltip" hidden></div>';return;}
    var W=Math.max(280,Math.round(host.clientWidth)),H=390,L=W<500?42:64,R=W<500?48:74,T=30,B=45,pw=W-L-R,ph=H-T-B;
    var plotted=selected.map(function(m){var base=points.find(function(p){return p[m.id]!==null&&p[m.id]>0;}),values=points.map(function(p){return state.mode==='index'?(base&&p[m.id]!==null?p[m.id]/base[m.id]*100:null):p[m.id];});return {m:m,values:values,axis:state.mode==='index'?'index':m.unit};});
    // Different units always keep their own scale; C1 gets a separate labelled axis.
    var axes=Array.from(new Set(plotted.map(function(s){return s.axis;}))),hasPct=axes.includes('percent')&&axes.length>1;
    if(hasPct&&state.mode==='values'){R+=W<500?22:36;pw=W-L-R;}
    var maxima={};axes.forEach(function(a){var vals=plotted.filter(function(s){return s.axis===a;}).flatMap(function(s){return s.values.filter(function(v){return v!==null;});});var max=Math.max(0,...vals);maxima[a]=(max|| (a==='percent'?.01:1))*1.12;});
    function x(i){return L+(points.length===1?pw/2:i*pw/(points.length-1));}function y(v,a){return T+ph-v/maxima[a]*ph;}
    function short(v){return v>=1000000?(v/1000000).toLocaleString('ru-RU',{maximumFractionDigits:1})+'м':v>=1000?(v/1000).toLocaleString('ru-RU',{maximumFractionDigits:1})+'к':Math.round(v).toLocaleString('ru-RU');}
    var svg='<svg viewBox="0 0 '+W+' '+H+'" role="img" aria-label="Динамика продуктовых метрик">';
    for(var t=0;t<=4;t++){var yy=T+ph-t*ph/4;svg+='<line class="pm-grid" x1="'+L+'" x2="'+(L+pw)+'" y1="'+yy+'" y2="'+yy+'"/>';}
    axes.forEach(function(a,ai){var ax=ai===0?L-8:ai===1?L+pw+8:W-2,anchor=ai===0?'end':ai===1?'start':'end',unit=a==='money'?'₽':a==='percent'?'C1, %':a==='index'?'Индекс':'Количество';svg+='<text x="'+ax+'" y="14" text-anchor="'+anchor+'" style="font-size:10px">'+unit+'</text>';for(var t=0;t<=4;t++){var val=maxima[a]*t/4;svg+='<text x="'+ax+'" y="'+(T+ph-t*ph/4+4)+'" text-anchor="'+anchor+'">'+(a==='percent'?(val*100).toFixed(1):short(val))+'</text>';}});
    var stride=Math.max(1,Math.ceil(points.length/(W<500?4:9)));
    points.forEach(function(p,i){if(i%stride===0||i===points.length-1)svg+='<text '+(!detailMonth?'class="pm-month-label" data-month="'+p.month+'" tabindex="0" role="button" aria-label="Раскрыть '+label(p.month)+'" ':'')+'x="'+x(i)+'" y="'+(H-13)+'" text-anchor="middle">'+escape(pointLabel(p))+'</text>';});
    plotted.forEach(function(s){var coords=s.values.map(function(v,i){return v===null?null:[x(i),y(v,s.axis)];});var d=window.RevenueDynamics.linePath(coords);svg+='<path class="pm-line" stroke="'+s.m.color+'" d="'+d+'"/>';s.values.forEach(function(v,i){if(v!==null)svg+='<circle cx="'+x(i)+'" cy="'+y(v,s.axis)+'" r="4" fill="var(--surface-1)" stroke="'+s.m.color+'" stroke-width="2.5"/>';});});
    svg+='<line id="pmGuide" class="pm-guide" y1="'+T+'" y2="'+(T+ph)+'" hidden/>';
    points.forEach(function(p,i){var half=points.length>1?pw/(points.length-1)/2:pw/2;svg+='<rect class="pm-hit" data-point="'+i+'" x="'+Math.max(L,x(i)-half)+'" y="'+T+'" width="'+(Math.min(L+pw,x(i)+half)-Math.max(L,x(i)-half))+'" height="'+ph+'" fill="transparent" tabindex="0" role="button" aria-label="'+escape(pointLabel(p)+'; '+selected.map(function(m){return m.label+': '+format(p[m.id],m.id);}).join('; '))+'"/>';});
    host.innerHTML=svg+'</svg><div id="pmTooltip" class="pm-tooltip" hidden></div>';
    host.querySelectorAll('.pm-hit').forEach(function(hit){var i=+hit.dataset.point;hit.addEventListener('pointermove',function(e){showTooltip(i,x(i));});hit.addEventListener('focus',function(){showTooltip(i,x(i));});hit.addEventListener('blur',function(){$('pmTooltip').hidden=true;});});
    if(!detailMonth){host.querySelectorAll('.pm-hit').forEach(function(hit){var ym=points[+hit.dataset.point].month;hit.addEventListener('click',function(){openMonth(ym,true);});hit.addEventListener('keydown',function(e){if(e.key==='Enter'||e.key===' '){e.preventDefault();openMonth(ym,true);}});});}
    host.onpointerleave=function(){$('pmTooltip').hidden=true;var guide=$('pmGuide');if(guide)guide.setAttribute('hidden','');};
    $('pmScaleNote').textContent=state.mode==='index'?'Первое ненулевое значение каждой линии = 100. Подсказка показывает исходные значения.':'Пользователи, заказы и лиды — количественная шкала; рубли и C1 — отдельные шкалы.';
  }
  function loadUsers(force){
    if(!data)return;var monthly=model.series(data,state.from,state.to,null);if(!monthly.length)return;var from=monthly[0].from,to=monthly[monthly.length-1].to,key=from+'|'+to;
    if(!force&&key===reportKey)return;reportKey=key;report=null;error='';loading=true;var id=++requestId;draw();
    getReport({from:from,to:to,step:'month'}).then(function(r){if(id!==requestId)return;if(r.sampled)throw Error('ответ получен с семплированием');report=r;}).catch(function(e){if(id===requestId)error=e.name==='AbortError'?'истекло время ожидания':e.message;}).finally(function(){if(id===requestId){loading=false;draw();}});
  }
  function accept(d){if(!model.valid(d))return;if(data&&(d.sourceEnd<data.sourceEnd||d.sourceEnd===data.sourceEnd&&String(d.generated_at)<String(data.generated_at)&&!(d.days&&!data.days)))return;data=d;if(!root.closest('[data-panel]').hidden){draw();if(started){loadUsers(false);if(detailMonth)loadDays(false);}}}
  window.__productMetricsSetData=accept;
  window.__productMetricsRerender=function(){if(!root.closest('[data-panel]').hidden){start();draw();loadUsers(false);if(detailMonth)loadDays(false);}};
  function loadLeads(){
    leadLoading=true;leadError='';
    fetch('data/lead-metrics.json',{cache:'no-cache'}).then(function(r){if(!r.ok)throw Error('не удалось прочитать выгрузку');return r.json();}).then(function(d){if(!window.LeadMetrics.valid(d)||!d.includesBaskets)throw Error('выгрузка лидов и корзин не прошла проверку итогов');leadData=d;}).catch(function(e){leadError=e.message;}).finally(function(){leadLoading=false;if(data&&!root.closest('[data-panel]').hidden)draw();});
  }
  function start(){if(started)return;started=true;loadLeads();fetch('data/product-metrics.json',{cache:'no-cache'}).then(function(r){if(!r.ok)throw Error('CRM недоступна');return r.json();}).then(accept).catch(function(e){if(!data)$('pmMeta').textContent='Не удалось загрузить показатели CRM. Нажмите «Обновить данные» сверху. '+e.message;});if(data){draw();loadUsers(false);}}
  $('pmChecks').innerHTML=metrics.map(function(m){return '<label class="pm-check" style="--pm-color:'+m.color+'"><input type="checkbox" data-metric="'+m.id+'" '+(state.selected.includes(m.id)?'checked':'')+'><span class="pm-dot"></span>'+m.label+'</label>';}).join('');
  $('pmChecks').addEventListener('change',function(e){var id=e.target.dataset.metric;if(!id)return;state.selected=metrics.filter(function(m){return $('pmChecks').querySelector('[data-metric="'+m.id+'"]').checked;}).map(function(m){return m.id;});persist();draw();});
  ['pmFrom','pmTo'].forEach(function(id){$(id).addEventListener('change',function(){var ym=this.value.slice(0,7);if(!validMonth(ym))return;state[id==='pmFrom'?'from':'to']=ym;if(state.from>state.to)state[id==='pmFrom'?'to':'from']=ym;$('pmPreset').value='custom';persist();draw();loadUsers(false);});});
  $('pmPreset').addEventListener('change',function(){if(!data||this.value==='custom')return;var hi=data.sourceEnd.slice(0,7);state.to=hi;if(this.value==='last_month'){state.to=model.addMonths(hi,-1);state.from=state.to;}else state.from=this.value==='12m'?model.addMonths(hi,-11):this.value==='year'?hi.slice(0,4)+'-01':data.sourceStart.slice(0,7);persist();draw();loadUsers(false);});
  $('pmMode').addEventListener('change',function(){state.mode=this.value;persist();draw();});$('pmRetry').addEventListener('click',function(){if(detailMonth)loadDays(true);else loadUsers(true);});
  $('pmTableBody').addEventListener('click',function(e){var button=e.target.closest('[data-month]');if(button)openMonth(button.dataset.month);});
  $('pmChart').addEventListener('click',function(e){var label=e.target.closest('[data-month]');if(label)openMonth(label.dataset.month,true);});
  $('pmChart').addEventListener('keydown',function(e){var label=e.target.closest('[data-month]');if(label&&(e.key==='Enter'||e.key===' ')){e.preventDefault();openMonth(label.dataset.month,true);}});
  $('pmBack').addEventListener('click',closeMonth);
  $('pmDailyRefresh').addEventListener('click',function(){var refresh=document.querySelector('.dashboard-update-button');if(refresh&&!refresh.disabled)refresh.click();});
  document.addEventListener('dashboard:tabchange',function(e){if(e.detail.tab==='marketing')window.__productMetricsRerender();});
  if(window.ResizeObserver)new ResizeObserver(function(){if(data&&!root.closest('[data-panel]').hidden)chart();}).observe($('pmChart'));
  if(!root.closest('[data-panel]').hidden)start();
})();
