(function(root,factory){var api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.WowlifePricingCatalog=api;})(typeof window==='undefined'?globalThis:window,function(){
  // Explicit catalog removals apply to cached data, composition and saved drafts alike.
  var excludedServiceIds=new Set(['42968','42969','42971','42972','42974','42975','21415','8976','36330','35972','17691','17697','17698','35061','17693','17699','34328','17694','34325','34329','17695','34326','34330','17696','34327','32185','34322','34323','34324','16681','16679','31726','34313','31815','34314','16680','16676','34990','16678','17686','34315','16682','31727','35346','31725','34310','34317','34316','16677','33958','32184','31723','34311','34312']);
  function norm(s){return String(s==null?'':s).toLowerCase().replace(/ё/g,'е').replace(/[_\s]+/g,' ').trim();}
  function inactiveLabel(value){
    var s=norm(value);
    return /не\s+(?:работаем|работают|работает|сотрудничаем|сотрудничают|сотрудничает)(?:$|[^а-я])|неактив(?:ен|на|но|ны|ный|ная|ное|ные)(?:$|[^а-я])|отключ(?:ен|ена|ено|ены)(?:$|[^а-я])|удален(?:а|о|ы)?(?:$|[^а-я])|закрыл(?:ся|ась|ись|ось)(?:$|[^а-я])/.test(s) || /(?:^архив(?:ный|ная|ное|ные)?$|[\s(—–-]архив(?:ный|ная|ное|ные)?\s*(?:$|[)!,.;]))/.test(s);
  }
  function inactiveFlag(value){return value===false||value===0||['n','no','false','0','нет','inactive','disabled','archived','deleted'].indexOf(norm(value))>=0||inactiveLabel(value);}
  function available(row){
    if(!row||excludedServiceIds.has(String(row.sid))||/^номинальный (?:подарочный )?сертификат(?:$|[\s,:])/i.test(norm(row.name)))return false;
    // Activity and price visibility are separate: a zero price does not mark a product inactive.
    return !inactiveFlag(row.active)&&!inactiveFlag(row.partnerActive)&&!inactiveLabel(row.name)&&!inactiveLabel(row.partner);
  }
  function serviceAvailable(row){return available(row)&&!/^(?:подарочный )?набор(?:$|[\s,:«"])/i.test(norm(row.name));}
  function visiblePrice(row){return !!row&&(!!row.custom||row.price===null||Number(row.price)!==0);}
  function discountedPriceColumn(header){return (header||[]).map(norm).indexOf('стоимость со скидкой');}
  function discountedPrice(row,column){
    var value=column>=0?row[column]:null;
    if(value===null||value===undefined||String(value).trim()==='')return null;
    var number=Number(String(value).replace(/[\s\u00a0\u202f]/g,'').replace(',','.'));
    return Number.isFinite(number)&&number>=0?number:null;
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
        if(!out[item.sid]&&serviceAvailable(item))out[item.sid]=Object.assign({partner:'',city:set.city,fromComposition:true},item,{price:null});
      });
    });
    return out;
  }
  function manualOverlay(catalog,rows,city){
    var out=Object.assign({},catalog),h=(rows[0]||[]).map(norm),count=0,seen=new Set();
    var column=function(name){return h.indexOf(name);};
    ['id услуги','наименование','партнер','себестоимость','стоимость со скидкой'].forEach(function(k){if(column(k)<0)throw new Error('Ручная выгрузка '+city+': нет столбца «'+k+'»');});
    function text(row,key){var i=column(key);return i<0?'':String(row[i]==null?'':row[i]).trim();}
    function numeric(row,key,id){var v=text(row,key);if(!v)return undefined;var n=Number(v.replace(/[\s\u00a0\u202f]/g,'').replace(',','.'));if(!Number.isFinite(n)||n<0)throw new Error('Ручная выгрузка '+city+', ID '+id+': некорректное значение «'+key+'»');return n;}
    rows.slice(1).forEach(function(row){
      if(!row||row.every(function(v){return !String(v==null?'':v).trim();}))return;
      var id=text(row,'id услуги');if(!/^\d+$/.test(id))throw new Error('Ручная выгрузка '+city+': нужен ID услуги из CRM');
      if(seen.has(id))throw new Error('Ручная выгрузка '+city+': повтор ID '+id);seen.add(id);
      var base=out[id];if(base&&base.city!==city)throw new Error('Ручная выгрузка '+city+': ID '+id+' относится к другому городу');
      var next=Object.assign({sid:id,name:'',partner:'',price:null,cost:0,city:city},base),fields={};
      ['name','partner'].forEach(function(k){var v=text(row,k==='name'?'наименование':'партнер');if(v){next[k]=v;fields[k]=true;}});
      if(!next.name)throw new Error('Ручная выгрузка '+city+': нет названия ID '+id);
      [['cost','себестоимость'],['price','стоимость со скидкой']].forEach(function(pair){var v=numeric(row,pair[1],id);if(v!==undefined){next[pair[0]]=v;fields[pair[0]]=true;if(pair[0]==='cost')next.costKnown=true;}});
      var open=numeric(row,'открытая цена партнера',id),terms=text(row,'размер комиссии');
      if(open!==undefined||terms){next.manualReference={partner_name:next.partner,as_of:text(row,'дата подтверждения'),source:'Ручная выгрузка '+city,derived:norm(text(row,'тип открытой цены'))==='расчет из выплаты и комиссии'};if(open!==undefined)next.manualReference.open=open;if(terms)next.manualReference.terms=terms;}
      // A temporary zero is not a confirmed free service.
      if(fields.cost&&next.cost===0&&norm(text(row,'тип открытой цены'))==='данные уточняются'){
        next.costKnown=false;
        next.manualReference={partner_name:next.partner,terms:'Данные уточняются',derived:true};
      }
      if(base&&!available(base))next.active=false;
      next.manualFields=fields;next.manualSource='Ручная выгрузка '+city;out[id]=next;count++;
    });
    return {catalog:out,count:count};
  }
  return {available:available,serviceAvailable:serviceAvailable,visiblePrice:visiblePrice,discountedPriceColumn:discountedPriceColumn,discountedPrice:discountedPrice,inactiveLabel:inactiveLabel,statusColumns:statusColumns,readStatus:readStatus,completeCatalog:completeCatalog,manualOverlay:manualOverlay};
});
