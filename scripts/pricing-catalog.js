(function(root,factory){var api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.WowlifePricingCatalog=api;})(typeof window==='undefined'?globalThis:window,function(){
  function norm(s){return String(s==null?'':s).toLowerCase().replace(/ё/g,'е').replace(/[_\s]+/g,' ').trim();}
  function inactiveLabel(value){
    var s=norm(value);
    return /не\s+(?:работаем|работают|работает|сотрудничаем|сотрудничают|сотрудничает)(?:$|[^а-я])|неактив(?:ен|на|но|ны|ный|ная|ное|ные)(?:$|[^а-я])|отключ(?:ен|ена|ено|ены)(?:$|[^а-я])|удален(?:а|о|ы)?(?:$|[^а-я])|закрыл(?:ся|ась|ись|ось)(?:$|[^а-я])/.test(s) || /(?:^архив(?:ный|ная|ное|ные)?$|[\s(—–-]архив(?:ный|ная|ное|ные)?\s*(?:$|[)!,.;]))/.test(s);
  }
  function inactiveFlag(value){return value===false||value===0||['n','no','false','0','нет','inactive','disabled','archived','deleted'].indexOf(norm(value))>=0||inactiveLabel(value);}
  function available(row){
    if(!row)return false;
    // A missing/zero price is not an activity flag: active free and draft products remain visible.
    return !inactiveFlag(row.active)&&!inactiveFlag(row.partnerActive)&&!inactiveLabel(row.name)&&!inactiveLabel(row.partner);
  }
  function statusColumns(header){
    var h=(header||[]).map(norm);
    return {active:h.findIndex(function(x){return ['active','активность','активен','активна','статус активности','статус услуги','статус набора'].indexOf(x)>=0;}),partnerActive:h.findIndex(function(x){return ['partner active','активность партнера','статус партнера'].indexOf(x)>=0;})};
  }
  function readStatus(row,columns){var out={};Object.keys(columns).forEach(function(k){if(columns[k]>=0)out[k]=row[columns[k]];});return out;}
  function completeCatalog(sets,catalog){
    var out=Object.assign({},catalog);
    (sets||[]).forEach(function(set){
      if(!available(set))return;
      (set.items||[]).forEach(function(item){
        if(!out[item.sid]&&available(item))out[item.sid]=Object.assign({partner:'',city:set.city,fromComposition:true},item);
      });
    });
    return out;
  }
  return {available:available,inactiveLabel:inactiveLabel,statusColumns:statusColumns,readStatus:readStatus,completeCatalog:completeCatalog};
});
