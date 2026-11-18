(function(root,factory){
  var api=factory(root);
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.DashboardRuntime=api;
})(typeof window==='object'?window:globalThis,function(root){
  'use strict';
  function create(options){
    options=options||{};
    var sections=new Map(),frame=null,flushing=false;
    var clock=options.now||function(){return root.performance&&typeof root.performance.now==='function'?root.performance.now():Date.now();};
    var schedule=options.schedule||function(fn){return typeof root.requestAnimationFrame==='function'?root.requestAnimationFrame(fn):setTimeout(fn,0);};
    var cancel=options.cancel||function(id){if(typeof root.cancelAnimationFrame==='function')root.cancelAnimationFrame(id);else clearTimeout(id);};
    function visible(section){try{return section.isVisible();}catch(error){report(error,section.key);return false;}}
    function report(error,key){
      if(options.onError){try{options.onError(error,key);}catch(ignored){}}
      else if(root.console&&root.console.error)root.console.error('Dashboard render: '+key,error);
    }
    function pendingVisible(){return Array.from(sections.values()).some(function(s){return s.dirty&&visible(s);});}
    function mark(section){
      if(!root.document||typeof root.document.querySelector!=='function')return;
      try{var panel=root.document.querySelector('[data-panel="'+section.key+'"]');if(panel){panel.setAttribute('data-render-count',String(section.renders));panel.setAttribute('data-render-ms',String(Math.round(section.lastDuration*100)/100));}}catch(ignored){}
    }
    function queue(){
      if(frame!==null||flushing||!pendingVisible())return;
      frame=schedule(function(){frame=null;flush();});
    }
    function draw(section){
      if(!section.dirty||!visible(section))return false;
      section.dirty=false;var start=clock();
      try{section.render();section.renders++;section.error=null;}
      catch(error){section.error=error;report(error,section.key);}
      finally{section.lastDuration=Math.max(0,clock()-start);section.totalDuration+=section.lastDuration;mark(section);}
      return true;
    }
    function flush(key){
      if(flushing)return;
      if(frame!==null){cancel(frame);frame=null;}
      flushing=true;
      try{
        if(key!==undefined){var section=sections.get(key);if(section)draw(section);}
        else sections.forEach(draw);
      }finally{flushing=false;queue();}
    }
    function register(key,render,isVisible){
      if(typeof key!=='string'||!/^[-a-z0-9_]+$/i.test(key)||typeof render!=='function'||typeof isVisible!=='function')throw new TypeError('Invalid dashboard section');
      if(sections.has(key))throw new Error('Dashboard section already registered: '+key);
      var section={key:key,render:render,isVisible:isVisible,dirty:false,requests:0,renders:0,error:null,lastDuration:0,totalDuration:0};
      sections.set(key,section);mark(section);
      function request(){section.dirty=true;section.requests++;queue();}
      request.immediate=function(){section.dirty=true;section.requests++;flush(key);};
      request.pending=function(){return section.dirty;};
      request.dispose=function(){if(sections.get(key)===section)sections.delete(key);if(frame!==null&&!pendingVisible()){cancel(frame);frame=null;}};
      return request;
    }
    return {
      register:register,
      activate:function(key){flush(key);},
      flush:function(){flush();},
      stats:function(){var out={};sections.forEach(function(s,key){out[key]={pending:s.dirty,requests:s.requests,renders:s.renders,error:s.error?String(s.error.message||s.error):null,lastDuration:s.lastDuration,totalDuration:s.totalDuration};});return out;}
    };
  }
  var api=create();api.create=create;return api;
});
