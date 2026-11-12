(function(){
  'use strict';
  var API=window.WowlifePricingProjects;
  if(!API)return;
  API.mount=function(options){
    var root=options.root,storage;
    try{storage=window.localStorage;}catch(e){storage={getItem:function(){return null;},setItem:function(){throw e;},length:0};}
    var journal=new API.Journal(storage,window.indexedDB),bar=root.querySelector('#prProjectBar'),status=bar.querySelector('[role="status"]');
    var dialog=root.querySelector('#prProjectDialog'),body=dialog.querySelector('.pr-project-body'),title=dialog.querySelector('h2');
    var ctrl=new API.Controller({get:options.get,apply:options.apply,storage:storage,journal:journal,
      call:API.rpc(window.WOWLIFE_PROJECT_CONFIG,window.fetch.bind(window)),confirm:window.confirm.bind(window),
      editing:function(){return root.contains(document.activeElement)&&!!document.activeElement.closest('input,select,textarea');},
      status:function(s){status.textContent=s.message;bar.dataset.status=s.kind;root.querySelector('#prProjectName').textContent=s.project?s.project.title:'Общий проект не подключён';
        ['#prProjectShare','#prProjectHistory'].forEach(function(sel){root.querySelector(sel).hidden=!s.connected;});
        root.querySelector('#prProjectRetry').hidden=s.kind!=='error'&&s.kind!=='pending';
        root.querySelector('#prProjectRemote').hidden=!['conflict','empty'].includes(s.kind);root.querySelector('#prProjectEmpty').hidden=s.kind!=='empty';
      }});
    function show(label){title.textContent=label;body.replaceChildren();if(!dialog.open)dialog.showModal();return body;}
    function el(tag,text,parent){var n=document.createElement(tag);if(text)n.textContent=text;if(parent)parent.appendChild(n);return n;}
    function button(text,parent,fn){var b=el('button',text,parent);b.type='button';b.className='pr-btn';b.addEventListener('click',fn);return b;}
    function fail(e){ctrl.notify('error',e.message||'Не удалось выполнить действие');}
    function saveFile(data,label){var a=document.createElement('a'),url=URL.createObjectURL(new Blob([JSON.stringify({format:'wowlife-pricing-project',version:1,savedAt:new Date().toISOString(),state:API.shared(data)},null,2)],{type:'application/json'}));a.href=url;a.download='wowlife-наборы-'+(label||new Date().toISOString().replace(/[:.]/g,'-'))+'.json';a.click();setTimeout(function(){URL.revokeObjectURL(url);},30000);}
    async function openProject(value){
      var c=API.parseLink(value);if(!c){fail(Error('Вставьте полную закрытую ссылку общего проекта'));return;}
      try{ctrl.notify('pending','Открываю общий проект…');await ctrl.connect(c);dialog.close();if(ctrl.base){window.history.replaceState(null,'',API.link(c,window.location.href));}}
      catch(e){fail(e);}
    }
    root.querySelector('#prProjectOpen').addEventListener('click',function(){var box=show('Открыть общий проект'),label=el('label','Закрытая ссылка проекта',box),input=el('input','',label);input.type='url';input.placeholder='Вставьте ссылку, полученную от Никиты или Василисы';input.autocomplete='off';el('p','Ссылка даёт доступ к составам и ценам проекта. Передавайте её только тем, кто работает над наборами.',box);button('Открыть',box,function(){openProject(input.value);});input.focus();});
    root.querySelector('#prProjectShare').addEventListener('click',async function(){var url=API.link(ctrl.conn,'https://niksitme.github.io/wowlife-dashboard/');
      try{await navigator.clipboard.writeText(url);ctrl.notify('saved','Закрытая ссылка скопирована. Передайте её Василисе.');}
      catch(e){var box=show('Ссылка общего проекта'),input=el('input','',box);input.value=url;input.readOnly=true;input.select();}
    });
    root.querySelector('#prProjectDownload').addEventListener('click',function(){saveFile(options.get());});
    root.querySelector('#prProjectImport').addEventListener('click',function(){root.querySelector('#prProjectFile').click();});
    root.querySelector('#prProjectFile').addEventListener('change',async function(e){var file=e.target.files[0];if(!file)return;
      try{if(file.size>2500000)throw Error('Резервный файл слишком большой');var parsed=JSON.parse(await file.text()),data=API.validate(parsed.state||parsed);
        if(!window.confirm('Открыть копию с '+data.customSets.length+' наборами? Текущая версия будет сохранена в истории устройства.'))return;
        await journal.backup(options.get(),'before-file-import');options.apply(data);ctrl.record();dialog.close();
      }catch(err){fail(err);}finally{e.target.value='';}
    });
    async function history(local){
      try{var box=show(local?'Копии на этом устройстве':'История общего проекта');el('p','Перед открытием копии текущие правки сохраняются. Восстановленная версия записывается как новое изменение.',box);
        var rows=local?await journal.list():(await ctrl.call('history',ctrl.args())).versions;
        if(!rows.length)el('p','Сохранённых версий пока нет.',box);
        rows.slice(0,100).forEach(function(v){var line=el('div','',box);line.className='pr-project-version';var state=local?API.shared(v.state):null;
          el('span',(local?'Копия':'Версия '+v.revision)+' · '+new Date(v.savedAt).toLocaleString('ru-RU')+' · наборов: '+(local?state.customSets.length:v.sets),line);
          button('Открыть копию',line,async function(){try{
            var data=local?state:API.validate((await ctrl.call('version',Object.assign(ctrl.args(),{p_revision:v.revision}))).state);
            if(!window.confirm('Восстановить '+data.customSets.length+' наборов из этой копии?'))return;
            await journal.backup(options.get(),'before-history-restore');options.apply(data);ctrl.paused=false;ctrl.record();dialog.close();
          }catch(e){fail(e);}});
          if(local)button('Скачать',line,function(){saveFile(v.state);});
        });
      }catch(e){fail(e);}
    }
    root.querySelector('#prProjectHistory').addEventListener('click',function(){history(false);});
    root.querySelector('#prProjectLocal').addEventListener('click',function(){history(true);});
    root.querySelector('#prProjectRetry').addEventListener('click',function(){ctrl.flush();});
    root.querySelector('#prProjectRemote').addEventListener('click',function(){if(window.confirm('Открыть общую версию? Ваши текущие правки останутся в «Копиях устройства».'))ctrl.useRemote().catch(fail);});
    root.querySelector('#prProjectEmpty').addEventListener('click',function(){if(window.confirm('Подтверждаете удаление всех новых наборов из общего проекта? Прежняя версия останется в истории.'))ctrl.confirmEmpty();});
    root.querySelector('#prProjectClose').addEventListener('click',function(){dialog.close();});
    window.addEventListener('online',function(){ctrl.flush();});
    window.addEventListener('beforeunload',function(e){if(ctrl.dirty){e.preventDefault();e.returnValue='';}});
    document.addEventListener('visibilitychange',function(){if(document.hidden)ctrl.flush();else ctrl.poll();});
    var interval=setInterval(function(){ctrl.dirty?ctrl.flush():ctrl.poll();},10000);
    window.addEventListener('pagehide',function(){clearInterval(interval);});
    // Do not replace newer in-memory edits with an asynchronous startup recovery.
    var starting=API.stable(API.shared(options.get()));
    ctrl.ready=(async function(){
      var copies=await journal.list(),current=options.get();
      if(!API.valuable(current)&&copies.length&&API.valuable(copies[0].state)&&API.stable(API.shared(current))===starting){
        options.apply(API.shared(copies[0].state));journal.local(options.get());ctrl.notify('local','Восстановлена последняя копия с этого устройства.');
      }
      var fromLink=API.parseLink(window.location.href),saved=null;
      if(!fromLink){try{saved=JSON.parse(storage.getItem(API.CONNECTION)||'null');}catch(e){}}
      var c=fromLink||saved;
      if(c&&c.id&&c.key){await openProject(API.link(c,window.location.href));}
      else ctrl.notify('local','Сохраняется на устройстве. Откройте закрытую ссылку для совместной работы.');
    })().catch(fail);
    ctrl.saveFile=saveFile;return ctrl;
  };
})();
