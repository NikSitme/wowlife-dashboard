(function(root,factory){
  var api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else {root.WowlifeDatePicker=api;api.init();}
})(typeof window==='undefined'?globalThis:window,function(){
  'use strict';
  var MONTHS=['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
  function isoDate(value){
    var s=String(value||'');
    if(!/^\d{4}-\d{2}-\d{2}$/.test(s))return null;
    var d=new Date(s+'T00:00:00Z');
    return Number.isFinite(+d)&&d.toISOString().slice(0,10)===s?s:null;
  }
  function parse(value){
    var s=String(value||'').trim(),m=s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
    return isoDate(m?m[3]+'-'+m[2].padStart(2,'0')+'-'+m[1].padStart(2,'0'):s);
  }
  function format(value){return isoDate(value)?value.split('-').reverse().join('.'):'';}
  function addDays(value,n){var d=new Date(value+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);}
  function addMonths(value,n){
    var d=new Date(value+'T00:00:00Z'),day=d.getUTCDate();
    d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()+n);
    var next=new Date(+d);next.setUTCMonth(next.getUTCMonth()+1);next.setUTCDate(0);
    d.setUTCDate(Math.min(day,next.getUTCDate()));return d.toISOString().slice(0,10);
  }
  function allowed(value,min,max){return !!isoDate(value)&&(!min||value>=min)&&(!max||value<=max);}
  function clamp(value,min,max){return min&&value<min?min:max&&value>max?max:value;}
  function monthCells(month,min,max){
    var first=month+'-01',offset=(new Date(first+'T00:00:00Z').getUTCDay()+6)%7;
    return Array.from({length:42},function(_,i){var date=addDays(first,i-offset);return {date:date,day:+date.slice(8),outside:date.slice(0,7)!==month,disabled:!allowed(date,min,max)};});
  }

  function yearMonths(year,min,max){
    return MONTHS.map(function(label,i){var month=String(year).padStart(4,'0')+'-'+String(i+1).padStart(2,'0');return {month:month,label:label,disabled:!!(min&&month<min.slice(0,7)||max&&month>max.slice(0,7))};});
  }
  function dateInMonth(date,month,min,max){
    var first=month+'-01';if(!isoDate(first)||min&&month<min.slice(0,7)||max&&month>max.slice(0,7))return null;
    var end=addDays(addMonths(first,1),-1),day=Math.min(+date.slice(8),+end.slice(8));
    return clamp(month+'-'+String(day).padStart(2,'0'),min,max);
  }

  var records=new Set(),lookup=new WeakMap(),active=null,panel=null,view='',cursor='',mode='days',monthOrigin='',started=false;
  var selector='[data-panel="opiu"] input[type="date"], .wsale-root input[type="date"], #productMetrics input[type="date"]';
  var labels={fromDate:'Начало периода ОПиУ',toDate:'Конец периода ОПиУ',yearFromDate:'Начало периода динамики выручки',yearToDate:'Конец периода динамики выручки'};
  var calendarIcon='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3v4m10-4v4M4 10h16M5 5h14a1 1 0 0 1 1 1v14H4V6a1 1 0 0 1 1-1Z"/><path d="M8 14h1m3 0h1m3 0h1M8 17h1m3 0h1m3 0h1"/></svg>';
  function today(){return new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Moscow',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());}
  function labelDate(date){return new Intl.DateTimeFormat('ru-RU',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(date+'T00:00:00Z'));}
  function clearError(r){r.error.hidden=true;r.text.removeAttribute('aria-invalid');}
  function error(r,message){r.error.textContent=message;r.error.hidden=false;r.text.setAttribute('aria-invalid','true');}
  function sync(r){
    if(document.activeElement!==r.text||!r.dirty){r.text.value=format(r.source.value);r.dirty=false;clearError(r);}
    r.text.disabled=r.toggle.disabled=r.source.disabled;
  }
  function refresh(){
    records.forEach(function(r){if(!r.source.isConnected){records.delete(r);if(active===r)close(false);}else sync(r);});
  }
  function focus(input){
    var source=typeof input==='string'?document.getElementById(input):input,r=source&&lookup.get(source);
    if(r)r.text.focus({preventScroll:true});else if(source)source.focus();
  }
  function commit(r,date,restore){
    var id=r.source.id,changed=r.source.value!==date;
    close(false);r.dirty=false;clearError(r);r.source.value=date;sync(r);
    if(changed)r.source.dispatchEvent(new Event('change',{bubbles:true}));
    refresh();if(restore)focus(id);
  }
  function commitText(r,restore){
    if(!r.dirty)return true;
    var date=parse(r.text.value);
    if(!date){error(r,'Введите дату в формате ДД.ММ.ГГГГ');return false;}
    if(!allowed(date,r.source.min,r.source.max)){
      error(r,(r.source.min?'С '+format(r.source.min):'')+(r.source.min&&r.source.max?' по ':r.source.max?'По ':'')+(r.source.max?format(r.source.max):''));return false;
    }
    commit(r,date,restore);return true;
  }
  function enhance(container){
    (container||document).querySelectorAll(selector).forEach(function(source){
      if(lookup.has(source))return;
      var r={source:source,field:document.createElement('span'),text:document.createElement('input'),toggle:document.createElement('button'),error:document.createElement('span'),dirty:false};
      var label=source.getAttribute('aria-label')||labels[source.id]||'Дата';
      lookup.set(source,r);records.add(r);r.field.className='dp-field';
      r.text.type='text';r.text.className='dp-text';r.text.id=source.id+'-display';r.text.placeholder='ДД.ММ.ГГГГ';r.text.inputMode='numeric';r.text.autocomplete='off';r.text.maxLength=10;
      r.text.setAttribute('aria-label',label);r.text.setAttribute('aria-describedby',source.id+'-error');
      r.toggle.type='button';r.toggle.className='dp-toggle';r.toggle.innerHTML=calendarIcon;r.toggle.setAttribute('aria-label','Открыть календарь: '+label.toLowerCase());r.toggle.setAttribute('aria-haspopup','dialog');r.toggle.setAttribute('aria-expanded','false');r.toggle.setAttribute('aria-controls','dashboard-date-calendar');
      r.error.className='dp-error';r.error.id=source.id+'-error';r.error.setAttribute('role','alert');r.error.hidden=true;
      source.before(r.field);r.field.append(r.text,r.toggle,source,r.error);source.classList.add('dp-source');source.tabIndex=-1;source.setAttribute('aria-hidden','true');
      if(source.parentElement.closest('label'))source.closest('label').htmlFor=r.text.id;
      source.addEventListener('change',refresh);
      r.text.addEventListener('input',function(){r.dirty=true;clearError(r);});
      r.text.addEventListener('change',function(){commitText(r);});
      r.text.addEventListener('blur',function(){commitText(r);});
      r.text.addEventListener('keydown',function(e){
        if(e.key==='Enter'){e.preventDefault();commitText(r,true);}
        else if(e.key==='ArrowDown'&&e.altKey){e.preventDefault();open(r);}
        else if(e.key==='Escape'){e.preventDefault();r.dirty=false;sync(r);close(false);}
      });
      r.toggle.addEventListener('click',function(){if(active===r)close(true);else open(r);});
      sync(r);
    });
    refresh();
  }
  function position(){
    if(!active)return;
    var rect=active.field.getBoundingClientRect(),width=Math.min(304,window.innerWidth-20);
    panel.style.width=width+'px';
    panel.style.left=Math.max(10,Math.min(rect.left,window.innerWidth-width-10))+'px';
    var height=panel.offsetHeight,below=rect.bottom+6;
    panel.style.top=Math.max(10,below+height<=window.innerHeight-10?below:rect.top-height-6)+'px';
  }
  function draw(focusDay){
    if(!active)return;
    if(mode==='months'){drawMonths(focusDay);return;}
    var min=active.source.min,max=active.source.max,selected=active.source.value,current=today();
    var monthTitle=MONTHS[+view.slice(5)-1]+' '+view.slice(0,4),cells=monthCells(view,min,max);
    var prev=addMonths(view+'-01',-1).slice(0,7),next=addMonths(view+'-01',1).slice(0,7);
    panel.innerHTML='<div class="dp-heading"><button type="button" class="dp-nav" data-move="-1" aria-label="Предыдущий месяц"'+(min&&prev<min.slice(0,7)?' disabled':'')+'>←</button><h3><button type="button" class="dp-month-title" data-choose-month aria-label="Выбрать месяц: '+monthTitle+'">'+monthTitle+'</button></h3><button type="button" class="dp-nav" data-move="1" aria-label="Следующий месяц"'+(max&&next>max.slice(0,7)?' disabled':'')+'>→</button></div><div class="dp-grid" role="grid" aria-label="'+monthTitle+'"><div class="dp-week dp-weekdays" role="row">'+['ПН','ВТ','СР','ЧТ','ПТ','СБ','ВС'].map(function(day){return '<span role="columnheader">'+day+'</span>';}).join('')+'</div>'+Array.from({length:6},function(_,week){return '<div class="dp-week" role="row">'+cells.slice(week*7,week*7+7).map(function(c){return '<button type="button" role="gridcell" class="dp-day'+(c.outside?' dp-outside':'')+'" data-date="'+c.date+'" aria-label="'+labelDate(c.date)+'" aria-selected="'+(c.date===selected)+'"'+(c.date===current?' aria-current="date"':'')+' tabindex="'+(c.date===cursor&&!c.disabled?'0':'-1')+'"'+(c.disabled?' disabled':'')+'>'+c.day+'</button>';}).join('')+'</div>';}).join('')+'</div>';
    position();if(focusDay){var day=panel.querySelector('[data-date="'+cursor+'"]');if(day&&!day.disabled)day.focus({preventScroll:true});}
  }
  function drawMonths(focusMonth){
    if(!active)return;
    var min=active.source.min,max=active.source.max,year=+view.slice(0,4),selected=active.source.value.slice(0,7),current=today().slice(0,7),months=yearMonths(year,min,max);
    panel.innerHTML='<div class="dp-heading"><button type="button" class="dp-nav" data-move="-1" aria-label="Предыдущий год"'+(year<=1||min&&year-1<+min.slice(0,4)?' disabled':'')+'>←</button><h3 aria-live="polite">'+year+'</h3><button type="button" class="dp-nav" data-move="1" aria-label="Следующий год"'+(year>=9999||max&&year+1>+max.slice(0,4)?' disabled':'')+'>→</button></div><div class="dp-month-grid" role="grid" aria-label="Месяцы '+year+'">'+Array.from({length:4},function(_,row){return '<div class="dp-month-row" role="row">'+months.slice(row*3,row*3+3).map(function(m){return '<button type="button" role="gridcell" class="dp-month" data-month="'+m.month+'" aria-label="'+m.label+' '+year+'" aria-selected="'+(m.month===selected)+'"'+(m.month===current?' aria-current="date"':'')+' tabindex="'+(m.month===view&&!m.disabled?'0':'-1')+'"'+(m.disabled?' disabled':'')+'>'+m.label+'</button>';}).join('')+'</div>';}).join('')+'</div><p class="dp-month-hint">'+(active.source.dataset.monthOnly==='true'?'Выберите месяц':'Выберите месяц, затем день')+'</p>';
    position();if(focusMonth){var button=panel.querySelector('[data-month="'+view+'"]');if(!button||button.disabled)button=panel.querySelector('[data-month]:not(:disabled)');if(button)button.focus({preventScroll:true});}
  }
  function open(r){
    close(false);refresh();active=r;mode=r.source.dataset.monthOnly==='true'?'months':'days';
    cursor=clamp(isoDate(r.source.value)||today(),r.source.min,r.source.max);view=cursor.slice(0,7);
    panel.hidden=false;panel.setAttribute('aria-label','Календарь: '+r.text.getAttribute('aria-label').toLowerCase());r.toggle.setAttribute('aria-expanded','true');draw(true);
  }
  function close(restore){
    var r=active;if(!r)return;active=null;panel.hidden=true;r.toggle.setAttribute('aria-expanded','false');if(restore)focus(r.source.id);
  }
  function init(){
    if(started)return;started=true;
    panel=document.createElement('div');panel.id='dashboard-date-calendar';panel.className='dp-calendar';panel.setAttribute('role','dialog');panel.hidden=true;document.body.appendChild(panel);
    panel.addEventListener('click',function(e){
      var move=e.target.closest('[data-move]'),day=e.target.closest('[data-date]'),month=e.target.closest('[data-month]'),title=e.target.closest('[data-choose-month]');
      if(!active)return;
      if(title){monthOrigin=view;mode='months';draw(true);}
      else if(month&&!month.disabled){cursor=dateInMonth(cursor,month.dataset.month,active.source.min,active.source.max);view=month.dataset.month;if(active.source.dataset.monthOnly==='true'){commit(active,cursor,true);return;}mode='days';draw(true);}
      else if(move&&!move.disabled){
        var direction=+move.dataset.move;
        if(mode==='months')view=String(+view.slice(0,4)+direction).padStart(4,'0')+view.slice(4);
        else {cursor=clamp(addMonths(cursor,direction),active.source.min,active.source.max);view=cursor.slice(0,7);}
        draw(false);var nextButton=panel.querySelector('[data-move="'+direction+'"]');if(!nextButton.disabled)nextButton.focus({preventScroll:true});else {var target=panel.querySelector(mode==='months'?'[data-month]:not(:disabled)':'[data-date="'+cursor+'"]');if(target)target.focus({preventScroll:true});}
      }
      else if(day&&!day.disabled)commit(active,day.dataset.date,true);
    });
    panel.addEventListener('keydown',function(e){
      if(e.key==='Escape'){e.preventDefault();if(mode==='months'&&active.source.dataset.monthOnly!=='true'){view=monthOrigin;mode='days';draw(false);panel.querySelector('[data-choose-month]').focus({preventScroll:true});}else close(true);return;}
      if(e.target.matches('[data-month]')){
        var offsets={ArrowLeft:-1,ArrowRight:1,ArrowUp:-3,ArrowDown:3,PageUp:-12,PageDown:12},offset=offsets[e.key];
        if(e.key==='Home')offset=1-Number(view.slice(5));else if(e.key==='End')offset=12-Number(view.slice(5));
        if(offset!==undefined){e.preventDefault();var candidate=clamp(addMonths(view+'-01',offset),active.source.min,active.source.max);view=candidate.slice(0,7);draw(true);}return;
      }
      if(!e.target.matches('[data-date]'))return;
      var date=e.target.dataset.date,next=null,dow=(new Date(date+'T00:00:00Z').getUTCDay()+6)%7;
      if(e.key==='ArrowLeft')next=addDays(date,-1);else if(e.key==='ArrowRight')next=addDays(date,1);else if(e.key==='ArrowUp')next=addDays(date,-7);else if(e.key==='ArrowDown')next=addDays(date,7);else if(e.key==='Home')next=addDays(date,-dow);else if(e.key==='End')next=addDays(date,6-dow);else if(e.key==='PageUp')next=addMonths(date,e.shiftKey?-12:-1);else if(e.key==='PageDown')next=addMonths(date,e.shiftKey?12:1);
      if(next){e.preventDefault();cursor=clamp(next,active.source.min,active.source.max);view=cursor.slice(0,7);draw(true);}
    });
    document.addEventListener('pointerdown',function(e){if(active&&!panel.contains(e.target)&&!active.field.contains(e.target))close(false);},true);
    document.addEventListener('focusin',function(e){if(active&&!panel.contains(e.target)&&!active.field.contains(e.target))close(false);});
    window.addEventListener('resize',function(){close(false);});
    window.addEventListener('scroll',function(e){if(active&&!panel.contains(e.target))close(false);},true);
    enhance(document);
  }
  return {isoDate:isoDate,parse:parse,format:format,addDays:addDays,addMonths:addMonths,allowed:allowed,monthCells:monthCells,yearMonths:yearMonths,dateInMonth:dateInMonth,init:init,enhance:enhance,refresh:refresh,focus:focus};
});
