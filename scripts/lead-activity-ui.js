(function(){
  'use strict';
  var root=document.getElementById('ws-lead-activity'),model=window.LeadActivity;
  if(!root||!model)return;
  var data=null,range=model.annualRange(model.today()),state={from:range.from,to:range.to,preset:'annual'},refreshError='';
  var nfmt=new Intl.NumberFormat('ru-RU'),avgfmt=new Intl.NumberFormat('ru-RU',{maximumFractionDigits:1});
  function el(id){return document.getElementById(id);}
  function date(s){return s.split('-').reverse().join('.');}
  function hour(h){return String(h).padStart(2,'0')+':00–'+String(h+1).padStart(2,'0')+':00';}
  function escape(s){return String(s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function tip(attrs,message){return ' title="'+escape(message)+'" data-la-tip="'+escape(message)+'" '+attrs;}
  function render(){
    if(!data)return;
    var stats=model.analyze(data,state.from,state.to),d=stats.topDays[0],h=stats.topHours[0],c=stats.topCells[0];
    el('la-from').value=state.from;el('la-to').value=state.to;el('la-preset').value=state.preset;
    var warning=refreshError?refreshError+' Предыдущие данные сохранены. ':'';
    if(stats.partial)warning+='В источнике доступны даты '+date(data.coverageStart)+'–'+date(data.coverageEnd)+'. Расчёт ограничен доступным пересечением. ';
    el('la-warning').textContent=warning;el('la-warning').hidden=!warning;
    el('la-scope').textContent='Создано '+nfmt.format(stats.total)+' лидов · '+(stats.days?date(stats.from)+'–'+date(stats.to)+' · '+stats.days+' дней':'в выбранном периоде нет доступных дат');
    el('la-provenance').textContent='Источник: «Никита» → «Лиды», дата создания, все источники. Последний лид: '+date(data.latest.slice(0,10))+' '+data.latest.slice(11,16)+' МСК. Это время последней записи; полнота последующих часов не подтверждена.';
    var has=stats.total>0;
    el('la-kpis').innerHTML='<div class="la-card"><span>Самый активный день</span><strong>'+(has?model.WEEKDAYS[d.day]:'—')+'</strong><span>'+(has?avgfmt.format(d.average)+' лида в среднем за день':'Нет лидов за доступные даты')+'</span><p>'+(has?stats.topDays.map(function(x){return model.WEEKDAYS[x.day]+': '+avgfmt.format(x.average);}).join(' · '):'')+'</p></div>'+
      '<div class="la-card"><span>Самый активный час</span><strong>'+(has?hour(h.hour):'—')+'</strong><span>'+(has?nfmt.format(h.count)+' лидов · '+avgfmt.format(h.count/stats.total*100)+'% за период':'')+'</span><p>'+(has?'Топ-3: '+stats.topHours.map(function(x){return hour(x.hour);}).join(' · '):'')+'</p></div>'+
      '<div class="la-card"><span>Пик дня и часа</span><strong>'+(has?['Пн','Вт','Ср','Чт','Пт','Сб','Вс'][c.day]+' '+hour(c.hour):'—')+'</strong><span>'+(has?avgfmt.format(c.average)+' лида в среднем за этот час':'')+'</span><p>'+(has?nfmt.format(c.count)+' лидов за '+stats.exposure[c.day]+' таких дней':'')+'</p></div>';
    var max=Math.max.apply(null,stats.topCells.map(function(x){return x.average;}).concat([0]));
    var html='<thead><tr><th scope="col">День / час</th>'+stats.hours.map(function(_,h){return '<th scope="col">'+String(h).padStart(2,'0')+'</th>';}).join('')+'</tr></thead><tbody>';
    stats.matrix.forEach(function(a,w){html+='<tr><th scope="row">'+model.WEEKDAYS[w]+'</th>'+a.map(function(count,h){
      var mean=stats.exposure[w]?count/stats.exposure[w]:null,intensity=mean!==null&&max?mean/max:0,bg='rgba(42,120,214,'+(.06+.94*intensity).toFixed(3)+')',msg=model.WEEKDAYS[w]+', '+hour(h)+': '+(mean===null?'нет дней в периоде':avgfmt.format(mean)+' в среднем; '+nfmt.format(count)+' лидов за '+stats.exposure[w]+' дней');
      return '<td tabindex="0"'+tip('style="background:'+bg+';color:'+(intensity>.55?'#fff':'var(--ink)')+'"',msg)+'>'+(mean===null?'—':avgfmt.format(mean))+'</td>';
    }).join('')+'</tr>';});
    el('la-heat').innerHTML=html+'</tbody>';
    var dayMax=Math.max.apply(null,stats.weekdays.map(function(x){return x.average||0;}).concat([1]));
    el('la-weekdays').innerHTML=stats.weekdays.map(function(x){var label=['Пн','Вт','Ср','Чт','Пт','Сб','Вс'][x.day],msg=model.WEEKDAYS[x.day]+': '+nfmt.format(x.count)+' лидов за '+x.days+' дней; в среднем '+avgfmt.format(x.average||0);return '<div class="la-bar-row" tabindex="0"'+tip('',msg)+'><span>'+label+'</span><div class="la-bar-track"><div class="la-bar-fill" style="width:'+((x.average||0)/dayMax*100).toFixed(2)+'%"></div></div><strong>'+(x.days?avgfmt.format(x.average):'—')+'</strong></div>';}).join('');
    var hourMax=Math.max.apply(null,stats.hours.concat([1]));
    el('la-hours').innerHTML=stats.hours.map(function(count,h){var msg=hour(h)+': '+nfmt.format(count)+' лидов · '+avgfmt.format(stats.total?count/stats.total*100:0)+'%';return '<div class="la-hour" tabindex="0"'+tip('',msg)+'><i style="height:'+(count/hourMax*88).toFixed(2)+'%"></i><span>'+String(h).padStart(2,'0')+'</span></div>';}).join('');
    el('la-tip').textContent='Наведите на ячейку или столбец, чтобы увидеть количество и среднее.';
    if(window.WowlifeDatePicker)window.WowlifeDatePicker.refresh();
  }
  if(window.DashboardRuntime)render=window.DashboardRuntime.register('leadActivity',render,function(){var panel=root.closest('[data-panel]'),body=root.closest('.wsale-root');return (!panel||!panel.hidden)&&(!body||!body.hidden);});
  window.__leadActivitySetData=function(next){
    model.validate(next);
    // A bundled snapshot arriving after a fresher cached/live response must not replace it.
    if(data&&next.latest<data.latest)return false;
    data=next;refreshError='';render();return true;
  };
  window.__leadActivityError=function(message){refreshError='Обновление лидов не удалось: '+message;render();};
  el('la-preset').addEventListener('change',function(){
    var now=model.today(),last=model.addDays(now,-1),preset=this.value;if(preset==='custom')return;
    var r=preset==='annual'?model.annualRange(now):preset==='last_month'?{from:model.addDays(now.slice(0,7)+'-01',-1).slice(0,7)+'-01',to:model.addDays(now.slice(0,7)+'-01',-1)}:{from:now.slice(0,4)+'-01-01',to:last};
    state={from:r.from,to:r.to,preset:preset};render();
  });
  ['from','to'].forEach(function(key){el('la-'+key).max=model.addDays(model.today(),-1);el('la-'+key).addEventListener('change',function(){
    var value=this.value;if(!model.iso(value)||value>this.max){render();return;}state[key]=value;if(state.from>state.to)state[key==='from'?'to':'from']=value;state.preset='custom';render();
  });});
  function showTip(e){var target=e.target.closest('[data-la-tip]');if(target)el('la-tip').textContent=target.dataset.laTip;}
  root.addEventListener('mouseover',showTip);root.addEventListener('focusin',showTip);
  fetch('data/lead-activity.json?v=20261118').then(function(r){if(!r.ok)throw new Error('HTTP '+r.status);return r.json();}).then(window.__leadActivitySetData).catch(function(e){if(!data){el('la-scope').textContent='Не удалось загрузить активность лидов. Нажмите «Обновить данные».';}window.__leadActivityError(e.message);});
})();
