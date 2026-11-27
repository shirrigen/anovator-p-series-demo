(function(root){
 'use strict';
 const label={front:'Front',side:'Side'};
 const captureId={front:0,side:2};
 const countdownLength=5000;
 const standardOverlays={grid:true,bones:true,risk:true,dimensions:true};
 const resultArt=root.ANOVATOR_POSTURE_RESULT_ART;

 // Examples from the selected Figma result boards, used only for simulated records.
 // The vertical positions anchor each readout to its own callout in the diagrams.
 const resultFields={
   front:{
     alignment:[
       ['headTilt','Head tilt',140,'1.4','°','Normal'],
       ['unevenShoulders','Uneven\nshoulders',212,'4.2','cm','Risk'],
       ['spinalCurvature','Lateral spinal\ncurvature',304,'1.8','cm','Normal'],
       ['kneeAlignment','O-leg',396,'3.6° / 4.0°','','Risk'],
     ],
     dimensions:[
       ['shoulderWidth','Shoulder width',184,'40.95','cm'],
       ['armCircumference','Arm\ncircumference',246,'28.24','cm'],
       ['waist','Waist\ncircumference',314,'78.31','cm'],
       ['hip','Hip\ncircumference',382,'94.61','cm'],
     ],
   },
   side:{
     alignment:[
       ['forwardHead','Forward head',140,'1.4','°','Not graded'],
       ['kyphosis','Kyphosis',222,'0.8','°','Not graded'],
       ['pelvicAlignment','Pelvic\nalignment',304,'6.0','°','Not graded'],
       ['kneeHyperextension','Knee\nhyperextension',386,'1.1','°','Not graded'],
     ],
     dimensions:[
       ['upperBodyLength','Upper body\nlength',180,'75.03','cm'],
       ['lowerBodyLength','Lower body\nlength',268,'82.57','cm'],
       ['thighLength','Thigh length',356,'35.95','cm'],
       ['lowerLegLength','Lower leg\nlength',426,'46.62','cm'],
     ],
   },
 };
 let clock;

 const row=html=>'<div class="wrap task-actions">'+html+'</div>';
 const artwork='assets/posture-ui/';
 function captured(s,view,ctx){
   if(s.acq?.testId==='posture'&&s.acq.pose?.captured===view)return true;
   const record=ctx.record||s.results.posture;
   return record?.views?!!record.views[view]:record?.view==='both'||record?.view===view;
 }

 function views(kind,view,s,ctx){
   const ready=kind==='prepare',switchable=ready||kind==='result'||kind==='detail';
   return '<span class="pose-view-label">'+label[view]+' view</span>'+
     '<div class="pose-view-switch" role="group" aria-label="Camera view">'+Object.entries(label).map(([id,name])=>{
     const saved=captured(s,id,ctx),inactive=!switchable||(ready&&s.retakeView&&id!==view);
     const icon='<img class="pose-view-icon" src="'+artwork+id+'-view-24.svg" width="24" height="24" alt="">';
     const check=saved?'<img class="pose-capture-check" src="'+artwork+'captured-10.svg" width="10" height="10" alt="">':'';
     return '<button type="button" aria-pressed="'+(id===view)+'" aria-label="'+name+' view'+(saved?', captured':'')+
       '" data-captured="'+saved+'" data-action="'+(ready?'posture-first':'view')+'" data-payload="'+ctx.esc(JSON.stringify({view:id}))+
       '" '+(inactive?'disabled':'')+'>'+icon+check+'</button>';
   }).join('')+'</div>';
 }

 function picture(view,s,{analysis=false,crop=false,model='zero'}={}){
   const grid=analysis&&s.overlays.grid;
   const figure=model==='guide'?'<div class="pose-guide-window"><img class="pose-guide" src="'+artwork+'gold-family-front-side-v01.png" alt="Gold mannequin showing the '+view+' position"></div>':
     model==='zero'?'<img class="pose-capture" src="'+artwork+'gold-family-front-side-v01.png" alt="Simulated '+view+' camera capture">'+
       (s.faceHidden?'<span class="pose-face-mask" aria-label="Face hidden"></span>':''):'';
   return '<div class="pose-field'+(grid?' pose-field-grid':'')+(analysis?' pose-field-analysis':'')+
     (crop?' pose-field-aim':'')+'" data-view="'+view+'" data-model="'+model+'">'+figure+'</div>';
 }

 function frame(kind,view,s,ctx,content,actions){
   const showPrivacy=['result','detail'].includes(kind)&&captured(s,view,ctx);
   const privacy=showPrivacy?'<button type="button" class="pose-privacy" data-action="privacy" data-face-hidden="'+s.faceHidden+
     '" aria-label="'+(s.faceHidden?'Show face':'Hide face')+'"><img src="'+artwork+'face-'+(s.faceHidden?'hidden':'visible')+
     '-24.svg" width="24" height="24" alt=""></button>':'';
   const title=['result','detail'].includes(kind)?'<strong>Body</strong> posture':'<strong>Body posture</strong>';
   return '<div class="body-wrap"><section class="body-screen pose-screen" lang="en" data-pose-stage="'+kind+'" data-pose-view="'+view+'"><h1 class="body-title">'+title+'</h1>'+
     '<div class="pose-subnav">'+views(kind,view,s,ctx)+privacy+'</div>'+
     content+'</section></div>'+row(actions);
 }

 function prepare(s,c){
   const view=s.retakeView||s.localTasks?.postureFirst||'front',side=view==='side';
   const note=side?'Turn sideways. Keep your gaze forward.':'Face the camera. Let your arms rest naturally.';
   const shot=picture(view,s,{crop:true,model:'guide'});
   const content=shot+'<div class="pose-instruction"><h2>'+(side?'Turn to the side.':'Face the camera.')+'</h2><p>'+note+'</p></div>'+
     '<p class="pose-note">'+(s.lastStop?.testId==='posture'?'Capture stopped. Start again when ready.':'Stand upright. Keep your whole body in view.')+'</p>';
   return frame('prepare',view,s,c,content,
     (c.E.canSkip(s,'posture')?c.b(s.mode==='retest'?'Cancel retake':'Skip','skip'):'')+c.b('Start','start-measure',{id:'posture'},'primary'));
 }

 function measure(s,c){
   const a=s.acq,pose=a?.pose;
   if(!pose)return prepare(s,c);
   const {view,started,waiting,detecting}=pose,stop=s.stop;
   const counting=!waiting&&!detecting&&a.step===captureId[view];
   const analysing=!waiting&&!detecting&&!counting;
   const status=stop?(stop.status==='unconfirmed'?'Stop not confirmed':'Stopping…'):
     waiting?'Change position.':detecting?'Finding you…':counting?'Keep still.':'Analysing';
   const message=stop?'Stay in position until the device stops.':
      waiting?(view==='side'?'Turn sideways and keep looking ahead.':'Face the camera again. Let your arms rest.'):
      detecting?'Stand where the camera can see your whole body.':
      counting?'Capture starts after the countdown.':'Capture received. Checking image quality.';
   const content=picture(view,s,{crop:!analysing,analysis:analysing,model:waiting?'guide':detecting?'none':'zero'})+
     '<div class="pose-instruction"><h2 role="status">'+status+'</h2><p>'+message+'</p>'+
     (counting&&!stop?'<div class="pose-countdown" data-started="'+started+'"><strong>5</strong>'+
       '<svg class="pose-countdown-ring" viewBox="0 0 68 68" aria-hidden="true"><circle cx="34" cy="34" r="31"/>'+
       '<circle cx="34" cy="34" r="31" pathLength="1" stroke-dasharray="1" stroke-dashoffset="0" transform="rotate(-90 34 34)"/></svg></div>':'')+'</div>'+
     '<p class="pose-note">'+(waiting?'When in position, start the '+view+' capture.':
       detecting?'The countdown starts when you’re in view.':'Keep your arms relaxed and remain still.')+'</p>';
   const actions=stop?stop.status==='unconfirmed'?c.b('Retry stop','retry-stop',{},'primary'):c.b('Stopping','stop',{},'stop-action',true):
     waiting?c.b('Finish with '+(view==='side'?'front':'side')+' view','posture-finish-view')+
       c.b('Capture '+view+' view','posture-start-view',{},'primary'):
       detecting?c.b('Stop','stop',{},'stop-action'):c.b('Retake this view','posture-retake-view',{},'primary');
   return frame(waiting?'next-view':detecting?'detecting':counting?'countdown':'analysis',view,s,c,content,actions);
 }

 function readings(record,view,overlays,esc){
   const {alignment,dimensions}=resultFields[view];
   const values=new Map(record.values.map(value=>[value.id,value]));

   function column(fields,kind){
     return '<dl class="pose-readings pose-readings-'+kind+'" aria-label="'+
       (kind==='alignment'?'Posture indicators':'Body measurements')+'">'+fields.map(([id,name,y,example,unit,grade])=>{
         const field=values.get(id);
         const value=field&&!field.pending?field.value:record.sample?example:null;
         const suffix=field&&!field.pending?field.unit:unit;
         const status=kind==='alignment'&&overlays.risk&&record.sample?grade:'';
         const tone=status==='Normal'?'normal':status==='Risk'?'risk':'neutral';
         return '<div class="pose-reading" data-reading="'+id+'" data-tone="'+tone+'" style="top:'+y+'px">'+
           '<dt>'+esc(name).replaceAll('\n','<br>')+'</dt><dd>'+
           (value===null?'<span class="pose-reading-empty">Unavailable</span>':'<span class="pose-reading-value">'+esc(value)+'</span>'+
             (suffix?'<small>'+esc(suffix)+'</small>':''))+'</dd>'+
           (status?'<dd class="pose-reading-grade">'+status+'</dd>':'')+'</div>';
       }).join('')+'</dl>';
   }

   return column(alignment,'alignment')+(overlays.dimensions?column(dimensions,'dimensions'):'');
 }

 function result(s,c,detail){
   const record=c.record;
   if(!record)return prepare(s,c);
   const view=label[s.selectedView]?s.selectedView:'front';
   const available=captured(s,view,c);
   const overlays=c.hideImageLayers?standardOverlays:s.overlays;
   const content=available?resultArt.render(view,overlays,s.faceHidden)+readings(record,view,overlays,c.esc)+
      (record.sample?'<p class="pose-demo-caption">'+(c.pagesRelease?'Sample pose &amp; readings':'Demo capture &amp; readings')+'</p>':''):
      '<div class="pose-empty"><h2>'+label[view]+' view not captured</h2><p>The other view is saved.</p></div>';
   const overlay=available&&detail&&!c.hideImageLayers?'<div class="pose-overlays" aria-label="Image layers">'+
     [['grid','Grid'],['bones','Landmarks'],['dimensions','Dimensions'],...(view==='front'?[['risk','Risk']]:[])]
       .map(([id,name])=>c.b(name,'overlay',{id},s.overlays[id]?'active':'')).join('')+'</div>':'';
   const controls=s.selectedHistory?c.n('Back to record','history-record','primary'):
     c.b(available?'Retake '+view+' view':'Capture '+view+' view','retest',{id:'posture',view,returnRoute:detail?'posture-summary':'result/posture'},available?'':'primary');
   const next=detail?c.n('Back to result','result/posture','primary'):c.resultContinuation();
   const review=!!c.reviewResultButtons&&!s.selectedHistory;
   const local=detail&&c.localDetail;
   const detailLink=detail&&review&&!local?c.n('Back to result','result/posture','pose-layer-link pose-local-back'):
     !detail&&available&&!c.hideImageLayers?c.n('Image layers','posture-summary','pose-layer-link'):'';
   const viewAction={action:'retest',label:(available?'Retake ':'Capture ')+view+' view',payload:{id:'posture',view,returnRoute:detail?'posture-summary':'result/posture'}};
   const missingView=c.hideImageLayers&&!detail&&record.partial&&Object.keys(label).find(side=>!captured(s,side,c));
   const repair=missingView?{...viewAction,label:'Capture '+missingView+' view',payload:{...viewAction.payload,view:missingView}}:
     available?null:viewAction;
   const retake=available||!c.hideImageLayers?viewAction:null;
   const actions=local?c.n('Back to posture result','result/posture','result-return')+controls:review?
     c.reviewResultButtons('posture',repair,retake):controls+(s.selectedHistory||!available?'':next);
   return frame(detail?'detail':'result',view,s,c,content+overlay+detailLink,actions);
 }

 function recovery(s,c){
   const view=s.failure?.view||s.retakeView||'front';
   const safe=s.failure?.confirmed!==false;
   const record=s.results.posture;
   const content='<div class="pose-empty"><h2>'+ (safe?'No usable '+view+' capture':'Waiting for the camera')+
     '</h2><p>'+ (safe?'Check that your whole body is visible. '+(record?'Your earlier capture is still saved.':'Try the same view again.'):'Stay in position until the device stops.')+'</p></div>';
   const retry=safe?c.b('Try again','posture-retry',{},'primary'):
     s.stop?.status==='unconfirmed'?c.b('Retry stop','retry-stop',{},'primary'):c.b(s.stop?'Stopping':'Stop','stop',{},'stop-action',!!s.stop);
   return frame('recovery',view,s,c,content,(safe&&c.E.canSkip(s,'posture')?c.b('Skip','skip'):'')+retry);
 }

 function render(s,kind,c){
   if(kind==='prepare')return prepare(s,c);
   if(kind==='measure')return measure(s,c);
   if(kind==='recovery')return recovery(s,c);
   return result(s,c,kind==='detail');
 }

 function sync(){
   clearInterval(clock);
   const countdown=document.querySelector('.pose-countdown');
   if(!countdown)return;
   const value=countdown.querySelector('strong');
   const arc=countdown.querySelector('.pose-countdown-ring circle:last-child');
   const started=Number(countdown.dataset.started);
   const update=()=>{
     const elapsed=Math.max(0,Math.min(countdownLength,Date.now()-started));
     const remaining=String(Math.max(1,Math.ceil((countdownLength-elapsed)/1000)));
     if(value.textContent!==remaining)value.textContent=remaining;
     arc.setAttribute('stroke-dashoffset',String(elapsed/countdownLength));
   };
   update();clock=setInterval(update,80);
 }

 root.ANOVATOR_POSTURE_UI={render,sync};
})(globalThis);
