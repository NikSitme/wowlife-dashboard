(function(){
  var root=document.querySelector('[data-panel="calculators"]');if(!root)return;
  var model=window.WowlifeProfitCalculator,key='wowlife-profit-calculator-v1',inputs=root.querySelectorAll('[data-profit-input]');
  var rub=new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2}),pct=new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2});
  function money(n){return n===null?'—':rub.format(Object.is(n,-0)?0:n)+' ₽';}
  function percent(n){return n===null?'—':pct.format(Object.is(n,-0)?0:n)+' %';}
  function values(){var v={};inputs.forEach(function(el){v[el.getAttribute('data-profit-input')]=el.value;});return v;}
  function render(persist){
    var r=model.calculate(values());
    inputs.forEach(function(el){el.setAttribute('aria-invalid',String(!r.valid&&!!r.issues[el.getAttribute('data-profit-input')]));});
    root.querySelector('#profitError').textContent=r.valid?'':Object.values(r.issues).join(' ');
    root.querySelectorAll('[data-profit-result]').forEach(function(el){var field=el.getAttribute('data-profit-result');el.textContent=!r.valid?'—':field==='margin'||field.indexOf('Percent')>=0?percent(r[field]):money(r[field]);});
    root.querySelector('.pc-total').classList.toggle('pc-loss',r.valid&&r.profit<0);
    root.querySelector('#profitPercentNote').hidden=!r.valid||r.revenue>0;
    root.querySelector('#profitEquation').textContent=r.valid?money(r.revenue)+' × '+percent(r.margin)+' − '+money(r.fixed)+' = '+money(r.profit):'Заполните три показателя для расчёта.';
    if(persist&&r.valid){try{localStorage.setItem(key,JSON.stringify({revenue:r.revenue,margin:r.margin,fixed:r.fixed}));}catch(e){root.querySelector('.pc-storage').textContent='Сохранение недоступно в этом браузере';}}
  }
  try{var saved=JSON.parse(localStorage.getItem(key)||'null');if(saved&&model.calculate(saved).valid)inputs.forEach(function(el){el.value=String(saved[el.getAttribute('data-profit-input')]).replace('.',',');});}catch(e){}
  root.querySelector('#profitForm').addEventListener('submit',function(e){e.preventDefault();});
  root.querySelector('#profitForm').addEventListener('input',function(){render(true);});
  root.querySelector('#profitReset').addEventListener('click',function(){inputs.forEach(function(el){el.value='0';});render(true);});
  render(false);
})();
