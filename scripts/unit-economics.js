(function(){
  'use strict';
  var root=document.getElementById('unitEconomics');if(!root)return;
  var M=window.WowlifeUnitEconomics,key='wowlife-unit-economics-v1',initial=null,current=null,presets=[];
  var f=new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2});
  var fields=[
    {key:'users',label:'Пользователи',unit:'чел.',group:'Воронка',hint:'Посетители за период',step:1000},
    {key:'conversion',label:'Конверсия в платящего',unit:'%',hint:'Все платящие ÷ пользователи',step:.1},
    {key:'buyers',label:'Платящие пользователи',unit:'чел.',hint:'Изменение пересчитает конверсию',step:10},
    {key:'frequency',label:'Заказов на платящего',unit:'шт.',hint:'Payments ÷ платящие',step:.1},
    {key:'payments',label:'Payments · оплаченные заказы',unit:'шт.',hint:'Изменение пересчитает частоту покупок',step:10},
    {key:'avgPrice',label:'Средний чек заказа',unit:'₽',group:'Экономика заказа',hint:'Весь заказ, включая несколько сертификатов',step:100},
    {key:'revenue',label:'Выручка',unit:'₽',hint:'Изменение пересчитает средний чек',step:10000},
    {key:'cogs',label:'COGS · переменные расходы',unit:'%',hint:'Все доли расходов; раскрыть состав ниже',step:1},
    {key:'margin',label:'Маржинальность',unit:'%',hint:'100% − COGS; изменение масштабирует доли COGS',step:1},
    {key:'acquisition',label:'Привлечение · Acquisition',unit:'₽',group:'Расходы за период',hint:'Бюджет привлечения отдельно от COGS и фиксов',step:10000},
    {key:'fixed',label:'Постоянные расходы',unit:'₽',hint:'Не включайте повторно Acquisition и COGS',step:10000},
    {key:'profit',label:'Чистая прибыль · цель',unit:'₽',group:'Результат',hint:'Введите цель — пересчитается необходимый средний чек',step:10000}
  ];
  var costs=[['packaging','Упаковка'],['vat','НДС'],['usn','УСН'],['bank','Банковские комиссии'],['acquiring','Эквайринг'],['partners','Выплаты партнёрам'],['delivery','Доставка'],['other','Прочие переменные']];
  var extras=[['ampPu','Маржа на платящего · AMPPU','₽'],['ampu','Маржа на пользователя · AMPU','₽'],['cac','Привлечение платящего · CAC','₽'],['cpu','Привлечение пользователя · CPU','₽'],['cpo','Привлечение заказа · CPO','₽'],['roi','ROI привлечения','%'],['breakEvenRevenue','Выручка для безубыточности','₽']];
  function $(id){return root.querySelector('#'+id);}
  function number(n,unit){return n===null?'—':f.format(Object.is(n,-0)?0:n)+(unit?' '+unit:'');}
  function inputValue(n,k){return new Intl.NumberFormat('ru-RU',{maximumFractionDigits:['conversion','frequency','margin','cogs'].includes(k)||M.costKeys.includes(k)?4:2,useGrouping:false}).format(Object.is(n,-0)?0:n);}
  function save(){try{localStorage.setItem(key,JSON.stringify({version:3,initial:initial,current:current}));}catch(ignored){}}
  function create(){
    $('ueRows').innerHTML=fields.map(function(x){return (x.group?'<tr class="ue-group"><th colspan="2">'+x.group+'</th></tr>':'')+'<tr data-row="'+x.key+'"><th scope="row"><label for="ue-'+x.key+'">'+x.label+'</label><small>'+x.hint+'</small></th><td><div class="ue-control"><button type="button" data-step="'+x.key+'" data-direction="-1" aria-label="Уменьшить: '+x.label+'">−</button><input id="ue-'+x.key+'" data-unit-input="'+x.key+'" type="text" inputmode="decimal" autocomplete="off" aria-label="'+x.label+'" aria-describedby="ueError"><button type="button" data-step="'+x.key+'" data-direction="1" aria-label="Увеличить: '+x.label+'">+</button><span>'+x.unit+'</span></div></td></tr>';}).join('');
    $('ueCosts').innerHTML=costs.map(function(x){return '<label>'+x[1]+'<span><input type="text" inputmode="decimal" autocomplete="off" data-unit-input="'+x[0]+'" aria-label="'+x[1]+'" aria-describedby="ueError"> %</span></label>';}).join('');
  }
  function render(){
    var r=M.calculate(current);if(!r.valid)return;
    fields.forEach(function(x){var el=$('ue-'+x.key);if(document.activeElement!==el)el.value=inputValue(r[x.key],x.key);});
    costs.forEach(function(x){var el=root.querySelector('[data-unit-input="'+x[0]+'"]');if(document.activeElement!==el)el.value=inputValue(current.costs[x[0]],x[0]);});
    $('ueProfit').textContent=number(r.profit,'₽');$('ueProfit').classList.toggle('ue-negative',r.profit<0);
    $('ueRevenue').textContent=number(r.revenue,'₽');
    $('ueMargin').textContent=number(r.margin,'%');
    $('ueProfitRate').textContent=number(r.profitPercent,'%');
    $('ueBreakdown').innerHTML=[['Выручка',r.revenue],['COGS',-r.cogsTotal],['Маржинальная прибыль',r.grossProfit],['Привлечение',-r.acquisition],['Прибыль до фиксов',r.profitBeforeFixed],['Постоянные расходы',-r.fixed],['Чистая прибыль',r.profit]].map(function(x,i){return '<div'+(i===6?' class="ue-final"':'')+'><span>'+x[0]+'</span><strong>'+number(x[1],'₽')+'</strong></div>';}).join('');
    $('ueExtraRows').innerHTML=extras.map(function(x){return '<tr><th scope="row">'+x[1]+'</th><td>'+number(r[x[0]],x[2])+'</td></tr>';}).join('');
    var changes=M.sensitivity(current),max=Math.max(1,...changes.map(function(x){return Math.abs(x.delta||0);}));
    $('ueSensitivity').innerHTML=changes.map(function(x){return '<div class="ue-impact'+(x.delta<0?' ue-impact-negative':'')+'"><span>'+x.label+'</span><div><i style="width:'+Math.abs(x.delta||0)/max*100+'%"></i></div><strong>'+ (x.delta===null?'—':(x.delta>0?'+':'')+number(x.delta,'₽'))+'</strong></div>';}).join('');
    $('ueEquation').textContent=number(r.revenue,'₽')+' − '+number(r.cogsTotal,'₽')+' − '+number(r.acquisition,'₽')+' − '+number(r.fixed,'₽')+' = '+number(r.profit,'₽');
    $('ueCostTotal').textContent=number(r.cogs,'%');
    $('ueWarning').textContent=r.cogs>100?'Переменные расходы превышают выручку. При таких долях рост продаж увеличивает убыток.':'';
  }
  function apply(key,value){var result=M.edit(current,key,value),el=root.querySelector('[data-unit-input="'+key+'"]');if(!result.valid){if(el)el.setAttribute('aria-invalid','true');$('ueError').textContent=Object.values(result.issues).join(' ');return false;}current=result.input;root.querySelectorAll('[aria-invalid=true]').forEach(function(x){x.removeAttribute('aria-invalid');});$('ueError').textContent='';render();save();return true;}
  root.addEventListener('input',function(e){var k=e.target.dataset.unitInput;if(k)apply(k,e.target.value);});
  root.addEventListener('focusout',function(e){if(e.target.dataset.unitInput){e.target.removeAttribute('aria-invalid');$('ueError').textContent='';render();}});
  root.addEventListener('click',function(e){var btn=e.target.closest('[data-step]');if(!btn)return;var x=fields.find(function(x){return x.key===btn.dataset.step;}),r=M.calculate(current),v=r[x.key]+Number(btn.dataset.direction)*x.step;if(x.key==='frequency')v=Math.max(1,v);else if(x.key==='conversion')v=Math.max(0,Math.min(100,v));else if(x.key==='margin')v=Math.min(100,v);else if(x.key!=='profit')v=Math.max(0,v);apply(x.key,v);});
  $('ueReset').addEventListener('click',function(){current=M.copy(initial);$('ueError').textContent='';render();save();});
  function mountCases(){
    var store=new window.WowlifeUnitCases.Store(window.WOWLIFE_PROJECT_CONFIG,window.fetch.bind(window),window.localStorage),cases=[],busy=false;
    function status(message){$('ueCaseStatus').textContent=message;}
    function list(){var chosen=$('ueCases').value;$('ueCases').replaceChildren(new Option('Выберите кейс',''));cases.forEach(function(c){$('ueCases').add(new Option(c.name+' · '+new Date(c.createdAt).toLocaleString('ru-RU'),c.id));});$('ueCases').value=chosen;}
    async function refresh(){try{cases=await store.list();list();status('Кейсов в общем хранилище: '+cases.length);}catch(e){status(e.message+' Черновик остаётся в этом браузере.');}}
    $('ueRefreshCases').addEventListener('click',refresh);
    $('ueCases').addEventListener('change',function(){var c=cases.find(function(c){return c.id===$('ueCases').value;});if(!c)return;initial=M.copy(c.current);current=M.copy(c.current);$('ueCaseName').value=c.name;render();save();status('Открыт «'+c.name+'». Новое сохранение создаст отдельную копию.');});
    $('ueSaveCase').addEventListener('click',async function(){if(busy)return;var name=$('ueCaseName').value.trim();if(!name){status('Введите название кейса.');$('ueCaseName').focus();return;}if(root.querySelector('[aria-invalid=true]')){status('Исправьте введённое значение перед сохранением.');return;}
      busy=true;this.disabled=true;status('Сохраняю в общем хранилище…');
      try{var c=await store.save(name,initial,current);cases=cases.filter(function(x){return x.id!==c.id;});cases.unshift(c);try{cases=await store.list();}catch(ignored){}list();$('ueCases').value=c.id;status('Кейс «'+c.name+'» сохранён в системе и доступен всем посетителям.');}
      catch(e){status(e.message+' Черновик сохранён в этом браузере; можно повторить.');}
      finally{busy=false;$('ueSaveCase').disabled=false;}
    });refresh();
  }
  fetch('data/unit-economics-presets.json',{cache:'no-cache'}).then(function(r){if(!r.ok)throw Error('Не удалось загрузить базы расчёта.');return r.json();}).then(function(data){presets=data.presets;initial=M.copy(presets[0].input);current=M.copy(initial);try{var stored=JSON.parse(localStorage.getItem(key)||'null');if(stored&&[2,3].includes(stored.version)&&M.calculate(stored.current).valid){current=stored.current;initial=M.calculate(stored.initial||stored.base).valid?(stored.initial||stored.base):M.copy(current);}}catch(ignored){}create();render();mountCases();$('ueLoading').hidden=true;$('ueContent').hidden=false;}).catch(function(e){$('ueLoading').textContent=e.message;});
})();
