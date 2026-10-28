(function(root,factory){var api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.WowlifeProfitCalculator=api;})(typeof window==='undefined'?globalThis:window,function(){
  function parse(value){
    if(typeof value==='number')return value;
    var s=String(value==null?'':value).trim().replace(/[\s₽%]/g,'').replace(',','.');
    return /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(s)?Number(s):NaN;
  }
  function calculate(input){
    var revenue=parse(input.revenue),margin=parse(input.margin),fixed=parse(input.fixed),issues={};
    if(!Number.isFinite(revenue)||revenue<0)issues.revenue='Выручка должна быть числом не меньше нуля.';
    if(!Number.isFinite(margin)||margin>100)issues.margin='Маржинальность должна быть числом не больше 100%.';
    if(!Number.isFinite(fixed)||fixed<0)issues.fixed='Расходы должны быть числом не меньше нуля.';
    if(Object.keys(issues).length)return {valid:false,issues:issues};
    var contribution=revenue*(margin/100),profit=contribution-fixed;
    if(!Number.isFinite(contribution)||!Number.isFinite(profit))return {valid:false,issues:{revenue:'Суммы слишком велики для расчёта.'}};
    return {valid:true,revenue:revenue,margin:margin,fixed:fixed,contribution:contribution,profit:profit,revenuePercent:revenue>0?100:null,fixedPercent:revenue>0?fixed/revenue*100:null,profitPercent:revenue>0?profit/revenue*100:null};
  }
  return {parse:parse,calculate:calculate};
});
