(function(root){
 'use strict';
 const flow=root.ANOVATOR_MOTION_TESTS;
 const names={balance:'Balance assessment',shoulder:'Shoulder mobility',pushups:'Push-ups',jump:'Leg power',scan360:'360° body scan'};
 const shape='assets/motion-ui/';
 const inputReduced=root.matchMedia('(prefers-reduced-motion: reduce)');
 const number=(n)=>Number.isFinite(n)?String(n):'';
 const footer=content=>'<div class="wrap task-actions">'+content+'</div>';
 const status=text=>'<p class="motion-status" role="status">'+text+'</p>';
 const make=s=>'<strong>'+s+'</strong>';
 const motorIcon='<span class="motor-placeholder-icon" aria-hidden="true"></span>';

 function frame(id,phase,inner,actions){
   const title=id==='balance'?'<strong>Balance</strong> assessment':'<strong>'+names[id]+'</strong>';
   return '<div class="body-wrap"><section class="body-screen motion-stage" lang="en" data-motion-test="'+id+
     '" data-motion-phase="'+phase+'"><h1 class="body-title">'+title+'</h1>'+inner+'</section></div>'+footer(actions);
 }

 function skip(s,{b,E},id){
   return E.canSkip(s,id)?b(s.mode==='retest'?'Cancel retest':'Skip','skip'):'';
 }

 function start(s,c,id){
   const view=id==='shoulder'?s.retakeView:null;
   const item=flow.labels[view],directive=item?item.side+' · '+item.motion:'';
   const retry=s.lastStop?.testId===id?'Try again':'Start';
   let detail='';
   if(id==='balance'){
     detail='<div class="motion-prep-copy balance-ready-copy"><h2>Stand on<br>both feet.</h2><p>Tap Start, then follow<br>the posture cues.</p>'+
       '<div class="balance-ten"><strong>'+flow.holdMs/1000+' s</strong><small>Single-leg hold</small></div>'+
       '<ol><li>Palms together</li><li>Lift one foot</li><li>Close eyes on cue</li></ol></div>'+
       balancePose()+'<p class="balance-pose-caption">After Start</p>'+
       (s.mode==='retest'&&s.results.balance?'<p class="balance-retained">Previous result kept.</p>':'')+
       status('Listen for the finish cue.');
   }else if(id==='shoulder'){
     detail='<div class="motion-prep-copy"><p class="motion-quiet">'+(directive||'Four directions')+'</p>'+
       '<h2>Stand in view.</h2><p>Follow the on-screen prompt for each arm.</p></div>'+
       shoulderIcon()+status('Keep your arms down until the cue.');
   }else if(id==='scan360'){
     detail='<div class="motion-prep-copy"><h2>Stand in position.</h2><p>Step onto the platform and stand still. Keep the area around it clear.</p></div>'+
       scanGraphic(null)+status('Wait for the platform cue before moving.');
   }else{
     const prompt=id==='jump'?'Take your starting position.':'Get into position.';
     detail='<p class="motion-intro">'+prompt+'</p><div class="motion-ready-art" aria-hidden="true"><img src="'+shape+id+'-ready.png" alt=""></div>'+
       status(id==='jump'?'Wait for the start cue.':'Keep your full body in view.');
   }
   return frame(id,'ready',detail,skip(s,c,id)+c.b(retry,'start-measure',{id,...(view?{view}:{})},'primary'));
 }

 function readout(label,value,unit){
   return '<div class="motion-readout"><span>'+label+'</span>'+
      (Number.isFinite(value)?'<p><strong>'+number(value)+'</strong><small>'+unit+'</small></p>':'')+'</div>';
 }

 function stop(s,c){
   return s.stop?.status==='unconfirmed'?c.b('Retry stop','retry-stop',{},'primary'):
     c.b(s.stop?'Stopping':'Stop','stop',{},'stop-action',!!s.stop);
 }

 function retryControls(s,c){
   return c.b('Retry','motion-retry',{},'primary')+stop(s,c);
 }

 function balancePose(){
   return '<img class="balance-ready-pose" src="'+shape+'balance-pose.png" alt="Stand on one leg with palms together">';
 }

 function balanceVessel(id){
   return '<div class="balance-vessel" data-fluid-attempt="'+id+'"></div>';
 }

 function balanceDuring(s,c,q){
   const p=q.phase;
   if(p==='position'){
     const prep='<div class="motion-prep-copy balance-ready-copy"><h2>Get into<br>position.</h2>'+
       '<p>Bring your palms<br>together. Lift one foot.</p>'+
       '<p class="balance-position-cue">Close your eyes when<br>you hear the start cue.</p></div>';
     return frame('balance',p,prep+balancePose()+status('Waiting for a steady pose…'),stop(s,c));
   }
   if(p==='invalid'){
     return frame('balance',p,'<div class="balance-fault"><h2>'+
       (q.note==='foot-down'?'Foot touched down early.':'Tracking lost.')+'</h2><p>Open your eyes and put both feet down.</p></div>'+
       balanceVessel(s.acq.id)+status('No result saved for this attempt.'),retryControls(s,c));
   }
   const ended=p==='release';
   const cue=ended?'Open your eyes and put both feet down.':'Keep your eyes closed.<br>Stand on one leg, palms together.';
   const seconds=Math.max(0,Math.ceil((flow.holdMs-Date.now()+q.enteredAt)/1000));
   const timing=ended?readout('Valid hold',q.done.holdDuration,'s'):
     '<div class="motion-readout"><span>Time left</span><p><strong data-hold-start="'+q.enteredAt+'">'+seconds+'</strong><small>s</small></p>'+
     '<span class="balance-time-track" aria-hidden="true"></span></div>';
   const detail='<p class="motion-intro">'+cue+'</p>'+balanceVessel(s.acq.id)+
     '<div class="balance-readings">'+readout('Live balance ability',q.value,'%')+timing+'</div>';
   return frame('balance',p,detail+status(ended?'Saving result…':'Wait for the finish cue.'),ended?'':stop(s,c));
 }

 function shoulderIcon(){
   return '<span class="shoulder-placeholder-icon" aria-hidden="true"></span>';
 }

 function shoulderDuring(s,c,q){
   const item=flow.labels[flow.direction(q)];
   const phase=q.phase;
   const forward=item.motion.startsWith('Forward');
   const count=Object.keys(q.done).length;
   const goal=q.sequence.length;
   const side=item.side.toLowerCase();
   const headline=phase==='lost'?'Return to the camera.':phase==='lower'?'Lower your '+side+' arm.':
     phase==='release'?'You can relax now.':phase==='position'?'Get ready.':
     'Raise your '+side+' arm '+(forward?'forward and up.':'out and up.');
   const hint=phase==='lost'?'Tracking paused. Measured directions are kept.':
     phase==='lower'?item.side+' · '+item.motion+' recorded':
     phase==='release'?'Saving measured directions…':
     phase==='position'?'Keep your arms down. Wait for the on-screen cue.':'Keep your elbow straight.';
   const angle=phase==='raising'||phase==='lower'?q.value:null;
   const angleReadout=Number.isFinite(angle)?readout(phase==='lower'?'Recorded angle':'Current angle',angle,'°'):'';
   const keep=phase==='lost'&&count?c.b('Keep measured directions','motion-partial',{},'shoulder-partial-action'):'';
   const detail='<div class="shoulder-motion-callout">'+
     '<p class="shoulder-direction"><strong>'+item.side+' · '+item.motion+'</strong></p>'+
     '<h2>'+headline+'</h2><p>'+hint+'</p></div>'+
     shoulderIcon()+'<div class="shoulder-live"'+(Number.isFinite(angle)?' data-live-angle="'+angle+'"':'')+'>'+
     angleReadout+'<p class="motion-quiet">'+count+' of '+goal+' '+(goal===1?'direction':'directions')+' recorded</p></div>'+keep+
     status(phase==='raising'?(angle===null?'Waiting for an angle':'Live tracking'):phase==='lost'&&!keep?'Re-enter the capture area to resume.':'');
   const actions=phase==='lost'?retryControls(s,c):phase==='release'?'':stop(s,c);
   return frame('shoulder',phase,detail,actions);
 }

 function motorDuring(s,c,q){
   const p=q.phase,push=q.id==='pushups';
   const copy=push?{position:'Get into the start position.',repeating:'Keep your form.',lost:'Tracking paused.',release:'You can stop now.'}:
     {position:'Hold your starting position.',go:'Go',airborne:'Movement detected.',landing:'Landing detected.',release:'You can relax now.',invalid:'This attempt was not recorded.'};
   const hint=push?(p==='lost'?'Return to the marked area. Valid reps are kept.':p==='position'?'Waiting for the camera':p==='release'?'Saving valid reps…':
     q.note==='rejected'?'Last rep did not count':q.note==='counted'?'✓ Last rep counted':'Waiting for the first valid rep'):
     p==='invalid'?'Stand steady, then try again.':p==='landing'?'Checking the landing':p==='release'?'Saving the captured attempt…':
     p==='go'?'Jump on cue':p==='airborne'?'Waiting for the landing':'Waiting for a stable standing position';
   const heading=p==='go'?'<p class="jump-go">Go</p>':'<p class="motion-intro">'+copy[p]+'</p>';
   const data=push?'<div class="motor-live">'+readout('Valid reps',q.count,'')+'</div>':'';
   const controls=['lost','invalid'].includes(p)?retryControls(s,c):p==='release'?'':stop(s,c);
   return frame(q.id,p,heading+motorIcon+data+status(hint),controls);
 }

 function scanGraphic(angle){
   const rotation=Number.isFinite(angle)?angle:0;
   return '<div class="scan-field" aria-hidden="true"><img src="assets/chrome-v04/project-scan360.svg" alt="">'+
     '<svg viewBox="0 0 230 160"><ellipse cx="115" cy="100" rx="104" ry="45" fill="none" stroke="#747f90" stroke-dasharray="2 5"/>'+
     '<g transform="rotate('+rotation+' 115 100)"><path d="M114 99L181 88" stroke="#a9b9d0" opacity=".42"/>'+
     '<circle cx="181" cy="88" r="4" fill="#d5e1ee"/></g></svg></div>';
 }

 function scanDuring(s,c,q){
   const states={
     position:['Stand still.','Waiting for the platform to be ready.'],
     rotating:['Hold your position.','The platform is rotating.'],
     'platform-stopping':['Stay on the platform.','Waiting for rotation to stop.'],
     still:['Stay where you are.','The platform is still. Wait for the step-off cue.'],
     release:['You may step off.','Checking the captured images…'],
     invalid:['The scan needs another try.','Step back on the platform when ready.']
   };
   const [head,note]=states[q.phase];
   return frame('scan360',q.phase,'<div class="motion-prep-copy"><h2>'+head+'</h2><p>'+note+'</p></div>'+
     scanGraphic(q.value),q.phase==='invalid'?retryControls(s,c):q.phase==='release'?'':stop(s,c));
 }

 function acquiring(s,id,c){
   const q=s.acq?.motion;
   if(!q||s.stop){
     const details=s.stop?.status==='unconfirmed'?'The device has not confirmed stopping. Try the stop command again.':
       id==='scan360'?'Stay on the platform until it confirms you can step off.':'Wait for the device to confirm this attempt is stopped.';
     if(id==='balance')return frame(id,'stopping','<div class="balance-fault"><h2>'+
       (s.stop?.status==='unconfirmed'?'Stop not confirmed':'Stopping measurement')+
       '</h2><p>Open your eyes and put both feet down.</p></div>'+balanceVessel(s.acq?.id||'stopping')+status(details),stop(s,c));
     const statusCopy=id==='shoulder'?'Lower your arm.':'';
     return frame(id,'stopping','<div class="motion-prep-copy failure-copy"><h2>Stopping measurement</h2><p>'+details+'</p></div>'+
       status(statusCopy),stop(s,c));
   }
   if(id==='balance')return balanceDuring(s,c,q);
   if(id==='shoulder')return shoulderDuring(s,c,q);
   if(id==='scan360')return scanDuring(s,c,q);
   return motorDuring(s,c,q);
 }

 function shoulderResult(s,c,record){
   const ids=['lf','rf','la','ra'];
   const find=id=>record.values.find(v=>v.id===id&&!v.pending);
   const measured=ids.filter(find).length;
   const columns='<div class="shoulder-result-columns"><span>Left shoulder</span><span>Right shoulder</span></div>';
   const cells=[['lf','rf','Forward raise'],['la','ra','Side raise']].map(([left,right,label])=>
     '<section><h2>'+label+'</h2><div>'+ [left,right].map(id=>{
       const value=find(id);
       return value?'<strong>'+c.esc(value.value)+'°</strong>':'<span>Not measured</span>';
     }).join('')+'</div></section>').join('');
   const missing=ids.find(id=>!find(id));
   const approach=missing?c.b('Measure '+flow.labels[missing].side.toLowerCase()+' '+flow.labels[missing].motion.toLowerCase(),
      'retest',{id:'shoulder',view:missing},'primary'):c.resultContinuation();
   const repair=missing?{action:'retest',label:'Measure '+flow.labels[missing].side.toLowerCase()+' '+flow.labels[missing].motion.toLowerCase(),
     payload:{id:'shoulder',view:missing}}:null;
   const actions=c.reviewResultButtons?c.reviewResultButtons('shoulder',repair,null):
     (missing?c.resultBackAction()?'':c.b('Next','continue'):'')+(c.resultBackAction()||approach);
   const options=ids.map(id=>c.b((find(id)?'Retest ':'Measure ')+flow.labels[id].side.toLowerCase()+' '+flow.labels[id].motion.toLowerCase(),
        'retest',{id:'shoulder',view:id})).join('');
   return frame('shoulder','result','<p class="motion-intro">'+measured+' of 4 directions measured</p>'+shoulderIcon()+
     '<div class="shoulder-results">'+columns+cells+'</div><div class="shoulder-retakes">'+options+'</div>',actions);
 }

 function result(s,id,c){
   const record=c.record;
   if(id==='shoulder')return shoulderResult(s,c,record);
   const value=key=>record.values.find(v=>v.id===key&&!v.pending)?.value;
   let detail='';
   if(id==='balance'){
     detail='<p class="motion-intro">Measurement complete.</p>'+balanceVessel(record.acqId||'result')+
       '<div class="balance-readings">'+readout('Balance score',value('balance'),'%')+
       readout('Valid hold',value('holdDuration'),'s')+'</div>'+status('Reading recorded');
   }else if(id==='jump'){
     detail='<p class="motion-intro">Your jump is recorded.</p>'+motorIcon+'<div class="motor-live">'+
       readout('Jump height',value('jumpHeight'),'cm')+'</div>'+status(Number.isFinite(value('jumpHeight'))?'Recorded · Demo result':'Height unavailable');
   }else if(id==='pushups'){
     detail='<p class="motion-intro">Valid reps recorded.</p>'+motorIcon+'<div class="motor-live">'+
       readout('Valid reps',value('reps'),'')+'</div>'+status(record.sample?'Recorded · Demo result':'Recorded');
   }else{
     detail='<div class="motion-prep-copy"><h2>Capture recorded.</h2><p>The capture status is saved to this session.</p></div>'+
       scanGraphic(null)+status('3D model unavailable in this preview.');
   }
   return frame(id,'result',detail,c.reviewResultButtons?c.reviewResultButtons(id):c.b('Retest','retest',{id})+c.resultContinuation());
 }

 function recovery(s,id,c){
   if(s.acq?.motion&&s.failure?.confirmed===false)return acquiring(s,id,c);
   return frame(id,'recovery','<div class="motion-prep-copy failure-copy"><h2>Measurement interrupted.</h2><p>'+
     (s.results[id]?'Your previous result is saved.':'Return to the starting position when ready.')+'</p></div>',
     skip(s,c,id)+c.b('Try again','retry',{},'primary'));
 }

 function render(s,kind,id,c){
   if(kind==='prepare')return start(s,c,id);
   if(kind==='measure')return acquiring(s,id,c);
   if(kind==='recovery')return recovery(s,id,c);
   return result(s,id,c);
 }

 root.ANOVATOR_MOTION_UI={render,uses:flow.uses};
})(globalThis);
