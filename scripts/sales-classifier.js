(function(root,factory){var api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.WowlifeSalesClassifier=api;})(typeof globalThis==='undefined'?this:globalThis,function(){
  'use strict';
  var METRIC='exact-adesk-only-product-v3';
  function key(value){return String(value||'').normalize('NFKC').toLowerCase().replace(/ё/g,'е').replace(/[\u200e\u200f\u200b]/g,'').replace(/[«»„“”"']/g,'').replace(/[—–-]/g,' ').replace(/\s+/g,' ').replace(/\s*,\s*/g,', ').trim();}
  function valid(value){return !!String(value||'').trim()&&!/^(?:#(?:N\/A|VALUE!|REF!)|не найдено|не указано|без названия(?: товара| сертификата)?|—)$/i.test(String(value).trim());}
  function technical(name){return /^(?:тест(?:овый)?(?:\s+тест)?\s*\d*|test\s*\d*|main)$/i.test(String(name||'').trim());}
  function extra(name){return /\((?:Add|Box)\)/i.test(name)||/^(?:услуги доставки|доставка|упаковоч|упаковка|подарочн(?:ая|ый)\s+(?:упаковка|пакет|коробка)|пакеты?(?:\s|\(|$)|премиум пакет|коробк|доплата)/i.test(String(name||'').trim());}
  function additions(){
    var out=[];function add(g,s,names){names.forEach(function(n){out.push([g,s,n]);});}
    // Named services in the Adesk export, grouped by their explicit service type.
    add('Загородный отдых','Загородный отдых',['Глэмпинг «Мох»','Глэмпинг «След Лося»','Villy Uley','Глэмпинг Villy Uley','Shanti home Озеро','Автоглэмпинг','Загородный Клуб «Скандинавия»','Загородный отдых в Twix House','Загородный отдых в Лехтуси']);
    add('Красота и здоровье','СПА и массаж',['SPA-погружение','SPA-программа с флоатингом для двоих','СПА-программа «Секрет гармонии»','СПА-программа «Ариан Красота»','СПА-программа «Пробуждение»','День СПА','Общий массаж тела','Уход за телом: Общий массаж тела','Массаж Ломи-ломи','Тайский традиционный массаж','Тайский оил массаж для двоих','Традиционный тайский фут-массаж','Тайский массаж Удар по усталости','Подбор прически со стилистом']);
    add('Полеты','Полеты',['Мастер-класс по управлению воздушным шаром','Обучение полетам на параплане','Полет на самолете Cessna 172']);
    add('Водные развлечения','Водные развлечения',['Прогулка на парусно-моторной яхте','Прогулка на парусно-моторной яхте MacGregor','Тренировка по вейксерфингу','Тренировка по вейксерфингу на Петровском','Вейкбординг','Вейкбординг Bannoe Wake','Пробное занятие по серфингу','Однодневный сплав на байдарках','Музыкальный вечерний круиз к Лахта Центру']);
    add('Катание и управление','Катание и управление',['Тур на вездеходах','Катание на снегоходе','Катание на снегоходах','Биатлон на танках','Курсы контраварийного вождения','Управление БТР и стрельба из РПД','Групповое катание на бронетехнике','Катание на танке Т-55','Заезд на внедорожных картингах','Спортивное вождение']);
    add('Спорт','Занятия спортом',['Индивидуальное занятие по паделу','Индивидуальное занятие на скалодроме','Индивидуальное занятие на скалодроме «Энергия высоты»','Тренировка по лыжам на тренажере SkyTech','Катание на роликах','Катание на роликах в Москве','Аэройога']);
    add('Красота и здоровье','Практики и уход',['Стояние на гвоздях','Тренировка ShapeMe']);
    add('Фотосессии','Фотосессии',['Фотосессия для беременных']);
    add('Путешествия и экскурсии','Экскурсии',['Прогулка по местам загадывания желаний','Индивидуальная авторская экскурсия по Санкт-Петербургу','Индивидуальная экскурсия в русский музей','Экскурсия в русский музей','Тур на остров Койонсаари','Экскурсия в Сортавалу и мраморный каньон Рускеала','Экскурсия «Арктическая деревня»']);
    add('Гастрономия','Рестораны и дегустации',['Экскурсия по барам с дегустацией','Ужин в итальянском ресторане','Ужин в ресторане «Пряности и радости на Московской»','Кулинарное свидание для двоих','Винное казино','Мастеркласс сомелье']);
    add('Мастер классы и обучение','Творческие мастер-классы',['Мастер-класс по керамической посуде','Мастер-класс по декоративной керамике','Мастер-класс по пошиву одежды','Мастер-класс по алкогольной живописи','Мастер-класс Аромадифузеры для дома','Мастер-класс Аромадиффузоры для дома','Романтическое свидание в гончарной мастерской','Художественный курс на выбор в школе искусств','Столярный мастер-класс','Мастер-класс по созданию бенто-тортов из мороженого','Мастер-класс «Как забивать кальян»','Обучение искусству граффити','граффити']);
    add('Экстремальные развлечения','Стрельба',['Курс Начинающий пистолет','Стрельба из пистолетов Трио']);
    add('Семейный отдых','Развлечения',['Квест для компании','Концерт живой музыки','Концерт живой музыки «Слушай сердцем»']);return out;
  }
  function taxonomy(catalogRows,financialRows){
    var exact=new Map(),aliases=new Map(),bundles=new Map();
    function put(map,k,v){if(!k)return;var old=map.get(k);if(old===undefined)map.set(k,v);else if(old&&JSON.stringify(old)!==JSON.stringify(v))map.set(k,null);}
    function add(g,s,n){var k=key(n);if(!k)return;var v=[String(g||'').trim(),String(s||'').trim(),String(n).trim()];if(!exact.has(k))exact.set(k,v);if(/^наборы(?:\s|$)/i.test(v[0]))put(bundles,k.replace(/^(?:подарочный\s+набор|п\/н)\s*/,''),v);}
    (catalogRows||[]).slice(4).forEach(function(r){if(r&&!r[0]&&r[3])add(r[1],r[2],r[3]);});
    if(exact.size<300)throw new Error('Каталог категорий подозрительно мал ('+exact.size+')');
    additions().forEach(function(t){add(t[0],t[1],t[2]);});
    var keys=Array.from(exact.keys()).sort(function(a,b){return b.length-a.length;});
    function bundle(name){var k=key(name).replace(/\s*\(\d+\)\s*$/,'').replace(/,?\s*(?:москва|мск|санкт петербург|спб)$/,'').trim();var q=String(name||'').match(/^Сертификат\s+[«"](.+?)[»"]\s+подарочный набор/i);if(q)k=key(q[1]);k=k.replace(/^(?:подарочный\s+набор|п\/н)\s*/,'').trim();return bundles.get(k)||null;}
    function base(name){if(!valid(name))return null;var k=key(name),b=bundle(name);if(b)return b;if(/^номинальный(?: подарочный)? сертификат(?:$|[:,\s])/.test(k))return ['Номинальный сертификат','','Номинальный сертификат'];if(exact.has(k))return exact.get(k);
      // A longer tariff may extend a whole service prefix. Reverse substring
      // matching cannot distinguish a set from a similarly named SPA or package.
      for(var i=0;i<keys.length;i++){var prefix=keys[i];if(k.indexOf(prefix)===0&&/^(?::|,|\s)/.test(k.slice(prefix.length)))return exact.get(prefix);}return null;
    }
    var h=financialRows&&financialRows[0]||[],p=h.indexOf('Проект'),l=h.indexOf('подбор артикула');
    if(p>=0&&l>=0)(financialRows||[]).slice(1).forEach(function(r){if(!valid(r[p])||!valid(r[l]))return;var found=base(r[l]);if(found)put(aliases,key(r[p]),found);});
    var aliasKeys=Array.from(aliases.keys()).sort(function(a,b){return b.length-a.length;});
    function classify(name){if(technical(name))return ['Технические позиции','Тестовые товары',String(name).trim()];var b=bundle(name);if(b)return b;var k=key(name);if(aliases.get(k))return aliases.get(k);var found=base(name);if(found)return found;for(var i=0;i<aliasKeys.length;i++){var prefix=aliasKeys[i],v=aliases.get(prefix);if(v&&k.indexOf(prefix)===0&&/^(?::|,|\s)/.test(k.slice(prefix.length)))return v;}return null;}
    classify.bundle=bundle;classify.exact=base;return classify;
  }
  function orderId(description){var m=String(description||'').match(/(?:заказ(?:у|а|ом)?\s*(?:№|#)?|сделк(?:а|е|у|и)\s*#?)\s*(\d+)/i);return m?m[1]:null;}
  function basket(text){var out=[];String(text||'').split(/[;\n]/).forEach(function(line){var m=line.trim().match(/^(.*?)\s+[xх×](\d+)\s*[—–-]/i);if(m&&!extra(m[1]))out.push({name:m[1].trim(),quantity:Number(m[2])});});return out;}
  function financialBasket(text){var out=[];String(text||'').split(/[;\n]/).forEach(function(line){var m=line.trim().match(/^(.*?)\s+[xх×](\d+)\s*[—–-]\s*(-?\d[\d\s]*(?:[.,]\d+)?)\s*(?:руб\.?|₽)\s*$/i);if(m)out.push({name:m[1].trim(),quantity:Number(m[2]),amount:Number(m[3].replace(/\s/g,'').replace(',','.'))});});return out;}
  function receiptText(description){return String(description||'').replace(/^.*?(?:заказ\s*(?:№|#)?\s*\d+|сделка\s*#?\s*\d+)(?:,\s*(?:Москва|Санкт-Петербург))?(?:\s*\((?:pay|payment):[^)]+\))?\s*:\s*/i,'').replace(/^Счет\s+\d+(?:\s*\(payment:[^)]+\))?\s*:\s*/i,'');}
  function allocations(project,lookup,description,classify,amount){
    var direct=valid(lookup)&&classify(lookup)||classify(project);if(direct)return [{classification:direct,amount:amount}];
    if(!project&&/доплат/i.test(description))return null;
    var lines=financialBasket(receiptText(description)),core=lines.filter(function(it){return !extra(it.name);});
    if(core.length>1&&Math.abs(lines.reduce(function(s,it){return s+it.amount;},0)-amount)<0.01){
      var result=lines.filter(function(it){return it.amount!==0;}).map(function(it){return {classification:extra(it.name)?['Доп услуги','Упаковка и доставка',it.name]:classify(it.name),amount:it.amount};});
      if(result.every(function(it){return !!it.classification;}))return result;
    }
    if(core.length===0&&lines.length&&lines.every(function(it){return extra(it.name);}))return [{classification:['Доп услуги','Упаковка и доставка',lines[0].name],amount:amount}];
    var found=financialProducts(project,lookup,description,classify,amount);return found?[{classification:found,amount:amount}]:null;
  }
  function financialProducts(project,lookup,description,classify,amount){
    var prepared=valid(lookup)&&classify(lookup);if(prepared)return prepared;
    var found=classify(project);if(found)return found;
    if(!project&&/доплат/i.test(description))return null;
    var text=String(description||'').replace(/^.*?(?:заказ\s*(?:№|#)?\s*\d+|сделка\s*#?\s*\d+)(?:,\s*(?:Москва|Санкт-Петербург))?(?:\s*\((?:pay|payment):[^)]+\))?\s*:\s*/i,'');
    text=text.replace(/^Счет\s+\d+(?:\s*\(payment:[^)]+\))?\s*:\s*/i,'');var items=basket(text),mapped=items.filter(function(it){return it.name!=='Без названия сертификата';}).map(function(it){return classify(it.name);});
    var matching=[];text.split(/[;\n]/).forEach(function(line){var m=line.trim().match(/^(.*?)\s+[xх×](\d+)\s*[—–-]\s*(-?\d[\d\s]*(?:[.,]\d+)?)\s*(?:руб\.?|₽)\s*$/i);if(m&&Number(String(m[3]).replace(/\s/g,'').replace(',','.'))===amount&&!extra(m[1])){var c=classify(m[1]);if(c)matching.push(c);}});if(matching.length===1)return matching[0];
    if(mapped.length&&mapped.every(function(it){return !!it&&JSON.stringify(it)===JSON.stringify(mapped[0]);}))return mapped[0];
    if(items.length>1)return null;
    var note=text.replace(/^заказ\s*(?:№|#)?\s*\d+[.,:\s]*/i,'').trim();return classify.bundle(note)||classify(note);
  }
  return {METRIC:METRIC,key:key,valid:valid,extra:extra,technical:technical,taxonomy:taxonomy,orderId:orderId,basket:basket,financialProducts:financialProducts,allocations:allocations,financialBasket:financialBasket};
});
