(function(root,factory){
  var api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;else root.MetrikaUsers=api;
})(typeof window==='object'?window:globalThis,function(){
  'use strict';
  var ENDPOINT='https://zdmhrtwdsreznsjmdads.supabase.co/functions/v1/metrika-users';
  var KEY='sb_publishable_fe5iiKS113rcWQqWGBGNuQ_ukc-5dSE';
  function aligned(points,report){
    var byRange={};
    if(!report||report.version!==1||report.metric!=='ym:s:users'||!Array.isArray(report.points))return points.map(function(){return null;});
    report.points.forEach(function(p){if(typeof p.users==='number'&&Number.isFinite(p.users)&&p.users>=0)byRange[p.from+'|'+p.to]=p.users;});
    return points.map(function(p){
      if(!p.from||p.from>report.through)return null;
      var to=p.to<report.through?p.to:report.through,key=p.from+'|'+to;
      return Object.prototype.hasOwnProperty.call(byRange,key)?byRange[key]:null;
    });
  }
  function client(fetcher){
    var cache=new Map();
    return function(options){
      var query=new URLSearchParams({from:options.from,to:options.to,step:options.step}).toString();
      var existing=cache.get(query);
      if(existing&&Date.now()-existing.at<300000)return existing.promise;
      var promise=fetcher(ENDPOINT+'?'+query,{headers:{apikey:KEY}}).then(function(r){if(!r.ok)throw new Error('Метрика недоступна');return r.json();}).then(function(report){
        if(report.version!==1||report.metric!=='ym:s:users'||report.from!==options.from||report.to!==options.to||report.step!==options.step||!Array.isArray(report.points))throw new Error('Неверный ответ Метрики');
        return report;
      }).catch(function(e){cache.delete(query);throw e;});
      if(cache.size>=30)cache.delete(cache.keys().next().value);
      cache.set(query,{at:Date.now(),promise:promise});
      return promise;
    };
  }
  return {aligned:aligned,client:client};
});
