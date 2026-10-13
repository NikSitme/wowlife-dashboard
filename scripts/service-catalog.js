(function(root,factory){var api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.WowlifeServiceCatalog=api;})(typeof window==='undefined'?globalThis:window,function(){
  function norm(s){return String(s||'').toLowerCase().replace(/ё/g,'е').replace(/[«»"“”]/g,'').replace(/\s+/g,' ').trim();}
  function classifier(taxonomy){
    var terms=(taxonomy||[]).filter(function(t){return t[0]&&t[2]&&norm(t[0])!=='наборы впечатлений'&&norm(t[0])!=='номинальный сертификат';}).map(function(t){return {category:t[0].trim(),subcategory:t[1],term:norm(t[2])};}).sort(function(a,b){return b.term.length-a.term.length;});
    return function(name){var n=norm(name);if(!n)return 'Без категории';var exact=terms.find(function(t){return t.term===n;});if(exact)return exact.category;
      var match=terms.find(function(t){return t.term.length>=5&&n.indexOf(t.term)>=0;});return match?match.category:'Без категории';};
  }
  function filter(services,city,selection){
    var f=selection||{},q=norm(f.q),min=f.min===''||f.min==null?null:Number(f.min),max=f.max===''||f.max==null?null:Number(f.max);
    return services.filter(function(s){return s.city===city&&(!q||norm(s.name+' '+s.partner).indexOf(q)>=0)&&(!f.category||s.category===f.category)&&(!f.partner||s.partner===f.partner)&&(min===null||!Number.isFinite(min)||s.price>=min)&&(max===null||!Number.isFinite(max)||s.price<=max);}).sort(function(a,b){if(f.sort==='price-asc')return a.price-b.price||a.name.localeCompare(b.name,'ru');if(f.sort==='price-desc')return b.price-a.price||a.name.localeCompare(b.name,'ru');return a.name.localeCompare(b.name,'ru');});
  }
  return {classifier:classifier,filter:filter};
});
