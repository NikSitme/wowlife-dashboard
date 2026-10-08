(function(root, factory){
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.RevenueDynamics = api;
})(typeof window === 'object' ? window : globalThis, function(){
  'use strict';
  var SOURCES = [['site','Сайт'],['ozon','Ozon'],['wb','Wildberries'],['ym','Яндекс Маркет'],['flowwow','Flowwow'],['b2b','B2B']];
  var MONTHS = ['янв','фев','мар','апр','май','июн','июл','авг','сен','окт','ноя','дек'];
  function isoDate(value){
    var s = String(value || '').trim(), m = s.match(/^(\d{4})-(\d{2})-(\d{2})/) || s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})/);
    if (!m) return null;
    var out = m[1].length === 4 ? m[1]+'-'+m[2]+'-'+m[3] : m[3]+'-'+m[2].padStart(2,'0')+'-'+m[1].padStart(2,'0');
    var d = new Date(out+'T00:00:00Z');
    return Number.isFinite(+d) && d.toISOString().slice(0,10) === out ? out : null;
  }
  function number(v){ return Number(String(v || '0').replace(/[\s\u00a0]/g,'').replace(',','.')) || 0; }
  function addDays(s,n){ var d = new Date(s+'T00:00:00Z'); d.setUTCDate(d.getUTCDate()+n); return d.toISOString().slice(0,10); }
  function monthEnd(s){ return new Date(Date.UTC(+s.slice(0,4),+s.slice(5,7),0)).toISOString().slice(0,10); }
  function shiftYear(s){
    var year = +s.slice(0,4)-1, prefix = year+s.slice(4,8);
    return prefix+String(Math.min(+s.slice(8,10),+monthEnd(prefix+'01').slice(8,10))).padStart(2,'0');
  }
  function fromRows(siteRows, mpRows, today){
    var h = siteRows[0] || [], dateCol = h.indexOf('Дата зачисления'), amountCol = h.indexOf('Сумма операции'), articleCol = h.indexOf('Статья');
    if (dateCol < 0 || amountCol < 0 || articleCol < 0) throw new Error('Динамика выручки: нет заголовков операций Адеска');
    var articleKeys = {'Wowlife МСК выручка':'siteMsk','Wowlife СПБ Выручка':'siteSpb','B2B выручка':'b2bAll'};
    var platformKeys = {'ОЗОН':'ozon','ВБ':'wb','ЯМ':'ym','Flowwow_СПБ':'flowwow','Flowwow_МСК':'flowwow'};
    var days = {}, coverage = {}, siteDates = [], mpDates = [];
    function add(date,key,value){
      if (today && date > today) return;
      var day = days[date] || (days[date] = {});
      day[key] = (day[key] || 0) + value;
    }
    siteRows.slice(1).forEach(function(r){
      var date = isoDate(r[dateCol]), value = number(r[amountCol]), key = articleKeys[r[articleCol]];
      if (date && (!today || date <= today)) siteDates.push(date);
      // Same SUMIFS as OПиУ: positive receipts, article and CREDIT date, not operation date.
      if (date && key && value > 0) add(date,key,value);
    });
    mpRows.slice(1).forEach(function(r){
      var date = isoDate(r[0]), platform = platformKeys[String(r[6] || '').trim()];
      if (!date || !platform || r[1] === '' || (today && date > today)) return;
      mpDates.push(date);
      var city = r[5] === 'Москва' ? 'Msk' : r[5] === 'Санкт-Петербург' ? 'Spb' : null;
      // City criteria match OПиУ, including exclusion of the historical #N/A rows.
      if (city) add(date,platform+city,number(r[1]));
    });
    if (!siteDates.length || !mpDates.length) throw new Error('Динамика выручки: пустой источник');
    siteDates.sort(); mpDates.sort();
    var siteFrom = siteDates[0].slice(0,4)+'-01-01', mpFrom = mpDates[0].slice(0,4)+'-01-01';
    SOURCES.forEach(function(s){
      var isSite = s[0] === 'site' || s[0] === 'b2b';
      var range = {from:isSite ? siteFrom : mpFrom, to:isSite ? siteDates[siteDates.length-1] : mpDates[mpDates.length-1]};
      (s[0] === 'b2b' ? ['All'] : ['Msk','Spb']).forEach(function(city){ coverage[s[0]+city] = range; });
    });
    Object.keys(days).forEach(function(d){ Object.keys(days[d]).forEach(function(k){ days[d][k] = Math.round(days[d][k]*100)/100; }); });
    return {version:1, days:days, coverage:coverage, asOf:siteDates[siteDates.length-1] > mpDates[mpDates.length-1] ? siteDates[siteDates.length-1] : mpDates[mpDates.length-1]};
  }
  function keysFor(sources,city){
    var keys = [];
    SOURCES.forEach(function(s){
      if (sources.indexOf(s[0]) < 0) return;
      if (s[0] === 'b2b'){ if (city === 'all') keys.push('b2bAll'); }
      else (city === 'msk' ? ['Msk'] : city === 'spb' ? ['Spb'] : ['Msk','Spb']).forEach(function(c){keys.push(s[0]+c);});
    });
    return keys;
  }
  function sumRange(data,key,from,to){
    var value = 0;
    for (var d = from; d <= to; d = addDays(d,1)) value += (data.days[d] && data.days[d][key]) || 0;
    return value;
  }
  function buckets(from,to,step){
    var result = [];
    for (var a = from; a <= to;){
      var end = a;
      if (step === 'week') end = addDays(a,6-((new Date(a+'T00:00:00Z').getUTCDay()+6)%7));
      if (step === 'month') end = monthEnd(a);
      if (step === 'year') end = a.slice(0,4)+'-12-31';
      if (end > to) end = to;
      result.push({from:a,to:end}); a = addDays(end,1);
    }
    return result;
  }
  function series(data,options){
    var keys = keysFor(options.sources,options.city), step = options.step;
    return buckets(options.from,options.to,step).map(function(b){
      var current = 0, previous = 0, defined = false, prevMissing = false, partial = false, ends = [];
      keys.forEach(function(key){
        var c = data.coverage[key];
        if (!c || b.from < c.from){ prevMissing = true; return; }
        if (b.from > c.to) return;
        var end = b.to < c.to ? b.to : c.to;
        defined = true; partial = partial || end < b.to; ends.push(end);
        current += sumRange(data,key,b.from,end);
        // Feb 29 has no matching date in a non-leap previous year; never double-count Feb 28.
        if (step === 'day' && b.from.slice(5) === '02-29'){ prevMissing = true; return; }
        var pf = shiftYear(b.from), pt = shiftYear(end);
        if (step === 'month' && end === monthEnd(end)) pt = monthEnd(pt);
        if (pf < c.from){ prevMissing = true; return; }
        previous += sumRange(data,key,pf,pt);
      });
      return {from:b.from,to:b.to,current:defined ? Math.round(current*100)/100 : null,previous:defined && !prevMissing ? Math.round(previous*100)/100 : null,partial:partial,through:ends.sort().pop() || null};
    });
  }
  function shortDate(s){ return +s.slice(8,10)+' '+MONTHS[+s.slice(5,7)-1]; }
  function money(n){ return Math.round(n).toLocaleString('ru-RU')+' ₽'; }
  function axis(n){ return Math.abs(n)>=1e6 ? (n/1e6).toLocaleString('ru-RU',{maximumFractionDigits:1})+' млн' : Math.abs(n)>=1000 ? (n/1000).toLocaleString('ru-RU',{maximumFractionDigits:0})+' тыс' : Math.round(n).toLocaleString('ru-RU'); }
  function esc(s){ return String(s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];}); }
  // Cubic segments with horizontal tangents at extrema: smooth without invented overshoots.
  function linePath(points){
    var chunks = [], run = [];
    function flush(){
      if (!run.length) return;
      var path = 'M'+run[0][0]+','+run[0][1];
      for (var i=1;i<run.length;i++){
        var p=run[i-1],q=run[i],dx=(q[0]-p[0])/3;
        path+=' C'+(p[0]+dx)+','+p[1]+' '+(q[0]-dx)+','+q[1]+' '+q[0]+','+q[1];
      }
      chunks.push(path); run=[];
    }
    points.forEach(function(p){ if(p) run.push(p); else flush(); }); flush();
    return chunks.join(' ');
  }
  function mount(card){
    var data = null, updated = false;
    var state = {sources:SOURCES.map(function(s){return s[0];}),city:'all',step:'month',preset:'year',from:'',to:''};
    var wrap=card.querySelector('#revYearWrap'), tip=card.querySelector('.rd-tooltip');
    function setPreset(preset){
      state.preset=preset;
      if(!data)return;
      var year=data.asOf.slice(0,4), first=Object.keys(data.coverage).map(function(k){return data.coverage[k].from;}).sort()[0];
      state.from=preset==='all' ? first : preset==='30' ? addDays(data.asOf,-29) : preset==='90' ? addDays(data.asOf,-89) : year+'-01-01';
      state.to=preset==='year' ? year+'-12-31' : data.asOf;
    }
    var picker=card.querySelector('#rdSourcePicker'), sourceInputs={}, allInput=card.querySelector('#rdSelectAllSources');
    SOURCES.forEach(function(source){
      var label=document.createElement('label'),input=document.createElement('input');
      input.type='checkbox'; input.value=source[0]; input.checked=true; sourceInputs[source[0]]=input;
      label.appendChild(input); label.appendChild(document.createTextNode(source[1]));
      input.addEventListener('change',function(){
        state.sources=input.checked ? state.sources.filter(function(s){return s!==source[0];}).concat(source[0]) : state.sources.filter(function(s){return s!==source[0];});
        render();
      });
      card.querySelector('#yearChannelPresets').appendChild(label);
    });
    allInput.checked=true;
    allInput.addEventListener('change',function(){state.sources=allInput.checked ? SOURCES.map(function(s){return s[0];}) : [];render();});
    card.querySelector('#rdOnlyMarkets').addEventListener('click',function(){state.sources=['ozon','wb','ym','flowwow'];render();});
    card.querySelector('#rdClearSources').addEventListener('click',function(){state.sources=[];render();});
    function closeSourcePicker(e){if(!picker.contains(e.target))picker.open=false;}
    document.addEventListener('pointerdown',closeSourcePicker);
    document.addEventListener('click',closeSourcePicker);
    picker.addEventListener('keydown',function(e){if(e.key==='Escape'){e.preventDefault();picker.open=false;picker.querySelector('summary').focus();}});
    card.querySelector('#yearCityPresets').addEventListener('change',function(e){state.city=e.target.value;render();});
    card.querySelector('#yearStepPresets').addEventListener('change',function(e){
      state.step=e.target.value;
      if(state.preset!=='custom')setPreset(state.step==='day'?'30':state.step==='week'?'90':state.step==='year'?'all':'year');
      render();
    });
    card.querySelector('#yearRangePresets').addEventListener('change',function(e){
      if(e.target.value==='custom')state.preset='custom';else setPreset(e.target.value);
      render();
      if(state.preset==='custom')card.querySelector('#yearFromDate').focus();
    });
    function render(){
      if (!data){wrap.innerHTML='<p class="cap">Загружаю выручку…</p>';return;}
      if (!state.from) setPreset('year');
      var all=state.sources.length===SOURCES.length;
      SOURCES.forEach(function(s){sourceInputs[s[0]].checked=state.sources.includes(s[0]);});
      allInput.checked=all; allInput.indeterminate=!all && state.sources.length>0;
      var selectedNames=SOURCES.filter(function(s){return state.sources.includes(s[0]);}).map(function(s){return s[1];});
      var sourceLabel=all ? 'Все источники' : !selectedNames.length ? 'Выберите источники' : selectedNames.length<=2 ? selectedNames.join(' + ') : 'Выбрано источников: '+selectedNames.length;
      card.querySelector('#rdSourcesValue').textContent=sourceLabel;
      picker.querySelector('summary').title=selectedNames.join(', ');
      card.querySelector('#yearCityPresets').value=state.city;
      card.querySelector('#yearStepPresets').value=state.step;
      card.querySelector('#yearRangePresets').value=state.preset;
      card.querySelector('#yearFromDate').value=state.from; card.querySelector('#yearToDate').value=state.to;
      var selected=keysFor(state.sources,state.city), points=series(data,state), defined=points.filter(function(p){return p.current!==null;});
      var current=defined.reduce(function(a,p){return a+p.current;},0), prev=defined.every(function(p){return p.previous!==null;}) ? defined.reduce(function(a,p){return a+p.previous;},0) : null;
      var names=SOURCES.filter(function(s){return state.sources.includes(s[0]);}).map(function(s){return s[1];}).join(' + ');
      card.querySelector('#rdTotal').textContent=selected.length ? money(current) : 'Выберите источники';
      card.querySelector('#rdDelta').textContent=prev===null || !defined.length ? 'Нет сопоставимых данных прошлого года' : (prev===0 ? 'Прошлый год: '+money(prev) : (current>=prev?'+':'')+((current/prev-1)*100).toLocaleString('ru-RU',{maximumFractionDigits:1})+'% к прошлому году');
      var captions=[];
      if(state.sources.includes('site') || state.sources.includes('b2b')) captions.push('Сайт / B2B — по '+shortDate(data.coverage.siteMsk.to));
      if(state.sources.some(function(s){return ['ozon','wb','ym','flowwow'].includes(s);})) captions.push('Маркеты — по '+shortDate(data.coverage.ozonMsk.to));
      card.querySelector('#rdCaption').textContent=(names || 'Источники не выбраны')+' · '+captions.join(' · ')+' · пунктир — те же даты прошлого года; неполные периоды сравниваются по доступным дням каждого источника';
      card.querySelector('#rdCurrentLegend').textContent='Текущий период: '+shortDate(state.from)+' '+state.from.slice(0,4)+' — '+shortDate(state.to)+' '+state.to.slice(0,4);
      card.querySelector('#rdPreviousLegend').textContent='Прошлый год: '+shortDate(shiftYear(state.from))+' '+shiftYear(state.from).slice(0,4)+' — '+shortDate(shiftYear(state.to))+' '+shiftYear(state.to).slice(0,4);
      tip.hidden=true;
      if(!selected.length || !defined.length){wrap.innerHTML='<p class="cap rd-empty">'+(!selected.length?'Выберите хотя бы один источник':'Нет данных за выбранный период')+'</p>';return;}
      var width=Math.max(560,wrap.clientWidth,points.length*(state.step==='day'?18:state.step==='week'?30:70));
      var height=285,left=18,right=86,top=24,bottom=45,pw=width-left-right,ph=height-top-bottom;
      var vals=[0]; points.forEach(function(p){if(p.current!==null)vals.push(p.current);if(p.previous!==null)vals.push(p.previous);});
      var lo=Math.min.apply(null,vals),hi=Math.max.apply(null,vals); if(lo===hi)hi=lo+1;
      hi+=(hi-lo)*0.13; if(lo<0)lo-=(hi-lo)*0.07;
      function x(i){return left+pw*(points.length===1?0.5:i/(points.length-1));}
      function y(v){return top+ph-(v-lo)/(hi-lo)*ph;}
      var svg=[],labelEvery=Math.max(1,Math.ceil(points.length/(Math.max(4,Math.floor(width/85)))));
      for(var g=0;g<4;g++){
        var v=lo+(hi-lo)*g/3,yy=y(v);
        svg.push('<line x1="'+left+'" x2="'+(width-right)+'" y1="'+yy+'" y2="'+yy+'" class="rd-grid"/><text x="'+(width-8)+'" y="'+(yy-7)+'" text-anchor="end" class="rd-axis">'+esc(axis(v))+'</text>');
      }
      var curPts=points.map(function(p,i){return p.current===null?null:[x(i),y(p.current)];}),prevPts=points.map(function(p,i){return p.previous===null?null:[x(i),y(p.previous)];});
      svg.push('<path class="rd-previous" d="'+linePath(prevPts)+'"/><path class="rd-current" d="'+linePath(curPts)+'"/>');
      points.forEach(function(p,i){
        if(p.previous!==null && prevPts.filter(Boolean).length<3) svg.push('<circle cx="'+x(i)+'" cy="'+y(p.previous)+'" r="4" fill="var(--surface-1)" stroke="var(--rd-previous)" stroke-width="2"/>');
        if(p.current!==null) svg.push('<circle class="rd-point" cx="'+x(i)+'" cy="'+y(p.current)+'" r="'+(points.length>60?2.5:4.5)+'"/>');
        if(i%labelEvery===0 || i===points.length-1){
          var label=state.step==='month'?MONTHS[+p.from.slice(5,7)-1]+' '+p.from.slice(2,4):state.step==='year'?p.from.slice(0,4):shortDate(p.from);
          svg.push('<text x="'+x(i)+'" y="'+(height-15)+'" text-anchor="middle" class="rd-axis">'+esc(label)+'</text>');
        }
        if(p.current!==null){
          var half=points.length===1?pw/2:pw/(points.length-1)/2;
          svg.push('<rect class="rd-hover" data-i="'+i+'" tabindex="0" role="img" aria-label="'+esc(shortDate(p.from)+': '+money(p.current)+(p.previous===null?'':', прошлый год '+money(p.previous)))+'" x="'+Math.max(0,x(i)-half)+'" y="'+top+'" width="'+(half*2)+'" height="'+ph+'"/>');
        }
      });
      wrap.innerHTML='<svg role="img" aria-label="Динамика выручки: сплошная линия — текущий период, пунктир — прошлый год" width="'+width+'" height="'+height+'" viewBox="0 0 '+width+' '+height+'">'+svg.join('')+'</svg>';
      wrap.querySelectorAll('.rd-hover').forEach(function(zone){
        function show(event){
          var p=points[+zone.dataset.i];
          tip.innerHTML='<b>'+esc(shortDate(p.from)+' '+p.from.slice(0,4)+(p.to===p.from?'':' — '+shortDate(p.to)+' '+p.to.slice(0,4)))+'</b><div class="rd-tip-current">Текущий период: '+money(p.current)+'</div><div class="rd-tip-previous">Прошлый год: '+(p.previous===null?'нет данных':money(p.previous))+'</div>'+(p.partial?'<small>Неполный период · по '+esc(shortDate(p.through))+'</small>':'');
          tip.hidden=false;
          var cr=card.getBoundingClientRect(),zr=zone.getBoundingClientRect(),xx=event.clientX===undefined?zr.x+zr.width/2:event.clientX;
          tip.style.left=Math.max(12,Math.min(cr.width-tip.offsetWidth-12,xx-cr.left+14))+'px';
          tip.style.top=(wrap.offsetTop+30)+'px';
        }
        zone.addEventListener('mousemove',show);zone.addEventListener('focus',show);zone.addEventListener('mouseleave',function(){tip.hidden=true;});zone.addEventListener('blur',function(){tip.hidden=true;});
      });
    }
    ['yearFromDate','yearToDate'].forEach(function(id){card.querySelector('#'+id).addEventListener('change',function(){
      var from=card.querySelector('#yearFromDate').value,to=card.querySelector('#yearToDate').value;
      if(!isoDate(from)||!isoDate(to)||from>to){card.querySelector('#rdCaption').textContent='Дата начала должна быть не позже даты окончания';return;}
      if((+new Date(to)-+new Date(from))/86400000>3660){card.querySelector('#rdCaption').textContent='Выберите диапазон не больше 10 лет';return;}
      state.from=from;state.to=to;state.preset='custom';render();
    });});
    function setData(next){
      if(!next || next.version!==1 || !next.days || !next.coverage || !isoDate(next.asOf)) return;
      data=next;updated=true;if(state.preset!=='custom')setPreset(state.preset);render();
    }
    fetch('data/revenue-timeline.json',{cache:'no-store'}).then(function(r){if(!r.ok)throw new Error('HTTP '+r.status);return r.json();}).then(function(next){if(!updated || next.asOf>data.asOf)setData(next);}).catch(function(){if(!data)wrap.innerHTML='<p class="cap">Данные выручки не загрузились. Нажмите «Обновить данные».</p>';});
    return {render:render,setData:setData};
  }
  return {sources:SOURCES,isoDate:isoDate,fromRows:fromRows,keysFor:keysFor,buckets:buckets,series:series,shiftYear:shiftYear,mount:mount};
});
