(function(root){
 'use strict';

 const motion=root.matchMedia?.('(prefers-reduced-motion: reduce)');
 let animation=0,runtime=null,libraryRequest,libraries;

 const actions=html=>'<div class="wrap task-actions">'+html+'</div>';
 const field='<div class="rope-canvas-slot" aria-hidden="true"></div>';
 const elapsedLabel=(seconds)=>Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0');

 function loadLibraries(){
   libraryRequest??=Promise.all([import('./rope-field.js'),import('three').catch(()=>null)])
     .then(([module,THREE])=>libraries={module,THREE});
   return libraryRequest;
 }

 function render(s,kind,{b,esc,E,record,resultActions}){
   const a=s.acq,stop=s.stop,ready=kind==='prepare',result=kind==='result';
   const count=record?.values.find(v=>v.id==='ropeCount')?.value;
   const seconds=record?.values.find(v=>v.id==='duration')?.value;
   const skip=E.canSkip(s,'rope')?b(s.mode==='retest'?'Cancel retest':'Skip','skip'):'';
   const kindText=s.lastStop?.testId==='rope'?'Try again':'Start';
   const heading=ready?'<p class="rope-instruction">Make room to jump.</p>':'<p class="rope-instruction">'+
     (result?'Your jumps are recorded.':stop?'Stop jumping.':'Jump at your own pace.')+'</p>';
   const content=ready?'<img class="rope-ready-art" src="assets/rope-ui/rope-ready.png" alt="Rope and clear space for jumping">'+
     '<p class="rope-note">Check the rope connection and clear the area around you.</p>':
     field+'<div class="rope-reading"><p class="rope-count-name">Jumps</p><strong class="rope-count">'+(result?esc(count):'')+'</strong>'+
     '<div class="rope-time"><small>'+(result?'Duration':'Time left')+'</small><strong>'+
     (result&&Number.isFinite(seconds)?elapsedLabel(seconds):'1:00')+'</strong></div></div>'+
     '<p class="rope-status" role="status">'+(result?'Recorded · demo':stop?'Confirming stop…':'Waiting for the first jump')+'</p>';
   const buttons=ready?actions(skip+b(kindText,'start-measure',{id:'rope'},'primary')):
     result?resultActions('rope'):actions(stop?.status==='unconfirmed'?b('Retry stop','retry-stop',{},'primary'):b(stop?'Stopping':'Stop','stop',{},'stop-action',!!stop));
   return '<div class="body-wrap"><section class="body-screen rope-screen" lang="en" data-rope-stage="'+
     (result?'result':ready?'ready':'measuring')+'" data-attempt="'+(a?.id||record?.acqId||'')+'"><h1 class="body-title">Jump rope</h1>'+
     heading+content+'</section></div>'+buttons;
 }

 function mountField(slot,libraries){
   const canvas=document.createElement('canvas');
   slot.replaceChildren(canvas);
   let field;
   try{
     if(libraries.THREE)field=libraries.module.buildThreeField(canvas,libraries.THREE);
   }catch{}
   if(!field){
     const fallback=document.createElement('canvas');
     canvas.replaceWith(fallback);
     field=libraries.module.buildCanvasField(fallback);
   }
   return field;
 }

 function attachField(slot,libraries){
   if(!runtime.field){
     runtime.field=mountField(slot,libraries);
     runtime.field.canvas.addEventListener('webglcontextlost',event=>{
       event.preventDefault();
       if(!runtime||runtime.field.canvas!==event.currentTarget||!event.currentTarget.isConnected)return;
       const replacement=document.createElement('canvas');
       event.currentTarget.replaceWith(replacement);
       runtime.field.dispose?.();
       runtime.field=libraries.module.buildCanvasField(replacement);
     },{once:true});
   }else if(runtime.field.canvas.parentNode!==slot)slot.append(runtime.field.canvas);
   slot.dataset.renderer=runtime.field.type;
 }

 function updateReadout(screen,snapshot){
   const count=screen.querySelector('.rope-count');
   if(snapshot.total!==null&&count.textContent!==String(snapshot.total))count.textContent=String(snapshot.total);
   const time=screen.querySelector('.rope-time strong');
   const status=screen.querySelector('.rope-status');
   const remaining=elapsedLabel(snapshot.remaining);
   if(time.textContent!==remaining)time.textContent=remaining;
   const ready=snapshot.view==='waiting'?'Waiting for the first jump':snapshot.view==='receipt'?'Counted':'Keep jumping';
   const content=snapshot.stage==='confirming'?'You can stop jumping. Recording…':ready;
   if(status.textContent!==content)status.textContent=content;
   if(snapshot.stage==='confirming')screen.querySelector('.rope-instruction').textContent='You can stop jumping.';
   screen.dataset.ropeStage=snapshot.view;
 }

 function clear(){
   cancelAnimationFrame(animation);
   runtime?.field?.dispose?.();
   runtime=null;
 }

 function sync(s,act,enabled){
   cancelAnimationFrame(animation);
   const screen=document.querySelector('.rope-screen'),slot=screen?.querySelector('.rope-canvas-slot');
   const result=s.route==='result/rope';
   const a=s.acq;
   const serial=result?'result:'+screen?.dataset.attempt:a?.id;
   if(!slot||!result&&s.route!=='measure/rope'){
     clear();
     if(screen?.closest('.direct-navigation')&&screen.dataset.ropeStage==='ready')loadLibraries().catch(()=>{});
     return;
   }
   if(s.stop){
     if(screen.closest('.direct-navigation')&&runtime?.serial===serial){
       if(runtime.field){
         slot.append(runtime.field.canvas);
         slot.dataset.renderer=runtime.field.type;
       }
       const snapshot=runtime.session?.snapshot();
       if(snapshot){
         if(snapshot.total!==null)screen.querySelector('.rope-count').textContent=String(snapshot.total);
         screen.querySelector('.rope-time strong').textContent=elapsedLabel(snapshot.remaining);
       }
       screen.dataset.ropeStage='stopping';
     }
     return;
   }
   if(!result&&!enabled)return;
   if(runtime?.serial!==serial){
     // Keep the same field through the device's release and saved-result handoff.
     if(result&&runtime){runtime.serial=serial;}
     else{clear();runtime={serial,field:null,session:null};}
   }
   const view=runtime;
   const showField=dependencies=>{
     if(runtime!==view||!screen.isConnected)return;
     const {module}=dependencies;
     attachField(slot,dependencies);
     const start=performance.now();
     if(result){
       const sample={stage:'result',elapsed:module.testTime+module.resultDelay,brakeAt:module.testTime,pulseAt:-Infinity};
       view.field.draw(module.exposureAt(sample,motion?.matches,module.opticalProfile,400));
       return;
     }
     let elapsed=Math.max(0,Date.now()-(a.ropeStartedAt||Date.now()));
     if(!view.session){
       view.session=new module.RopeSession();
       view.session.begin('each',Math.min(elapsed,module.testTime));
       view.session.advance(Math.max(0,elapsed-module.testTime));
     }else elapsed=view.session.elapsed;
     let previous=start;
     function tick(now){
       if(runtime!==view||!screen.isConnected)return;
       view.session.advance(now-previous);previous=now;
       const sample=view.session.snapshot();
       if(sample.stage==='result'){
         act('rope-record',{count:sample.total,duration:module.testTime/1000,acqId:a.id,participantId:s.user.id});
         return;
       }
       updateReadout(screen,sample);
       view.field.draw(module.exposureAt(sample,motion?.matches,module.opticalProfile,0));
       animation=requestAnimationFrame(tick);
     }
     animation=requestAnimationFrame(tick);
   };
   if(libraries){showField(libraries);return;}
   loadLibraries().then(showField).catch(()=>{
     if(screen.isConnected)screen.querySelector('.rope-status').textContent='Preview unavailable. Stop and try again.';
   });
 }

 root.ANOVATOR_ROPE_UI={render,sync};
})(globalThis);
