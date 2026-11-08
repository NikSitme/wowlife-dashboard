(function(root,factory){var api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.WowlifeServiceCatalog=api;})(typeof window==='undefined'?globalThis:window,function(){
  function norm(s){return String(s||'').toLowerCase().replace(/ё/g,'е').replace(/[«»"“”]/g,'').replace(/\s+/g,' ').trim();}
  function classifier(data){
    var services=data&&data.services||{},categories=data&&data.categories||[];
    return function(row){
      var record=row&&services[String(row.sid||row.id||'')];
      return record&&record.city===row.city&&categories.indexOf(record.category)>=0?record.category:'Без категории';
    };
  }
  function filter(services,city,selection){
    var f=selection||{},q=norm(f.q),min=f.min===''||f.min==null?null:Number(f.min),max=f.max===''||f.max==null?null:Number(f.max);
    return services.filter(function(s){return s.city===city&&matchesQuery(s,q)&&(!f.category||s.category===f.category)&&(!f.partner||s.partner===f.partner)&&(min===null||!Number.isFinite(min)||s.price!==null&&s.price>=min)&&(max===null||!Number.isFinite(max)||s.price!==null&&s.price<=max);}).sort(function(a,b){if(f.sort==='price-asc'||f.sort==='price-desc'){if(a.price===null||b.price===null)return a.price===b.price? a.name.localeCompare(b.name,'ru'):a.price===null?1:-1;return (f.sort==='price-asc'?a.price-b.price:b.price-a.price)||a.name.localeCompare(b.name,'ru');}return a.name.localeCompare(b.name,'ru');});
  }
  function matchesQuery(row,query){
    var q=norm(query);if(!q)return true;
    var items=row.items||[],ids=[row.sid,row.id].concat(items.map(function(i){return i.sid;})).filter(function(id){return id!=null;}).map(String);
    var numeric=q.match(/^(?:id\s*[:#]?\s*)?(\d+)$/);
    if(numeric)return ids.indexOf(numeric[1])>=0;
    return norm([row.name,row.partner].concat(ids,items.map(function(i){return i.name+' '+(i.partner||'');})).join(' ')).indexOf(q)>=0;
  }
  function paginate(items,page,size){
    size=Math.max(1,Math.floor(Number(size)||100));
    var total=items.length,pages=Math.max(1,Math.ceil(total/size));
    page=Math.min(pages,Math.max(1,Math.floor(Number(page)||1)));
    var start=(page-1)*size;
    return {items:items.slice(start,start+size),page:page,pages:pages,total:total,from:total?start+1:0,to:Math.min(start+size,total)};
  }
  return {classifier:classifier,filter:filter,paginate:paginate,matchesQuery:matchesQuery};
});
