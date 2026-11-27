(function(root){
 'use strict';
 const names={
   lung:{primary:'Lung',secondary:' capacity',peripheral:'Spirometer',unit:'mL'},
   grip:{primary:'Grip',secondary:' strength',peripheral:'Dynamometer',unit:'kg'}
 };
 const types=['lung','grip'];
 const file='assets/accessory-ui/';
 const hand={left:'Left',right:'Right'};
 const row=html=>'<div class="wrap task-actions">'+html+'</div>';
 const sample=value=>Number.isFinite(value)?new Intl.NumberFormat('en',{maximumFractionDigits:1}).format(value):'';

 function surface(id,stage,content,actions){
   const name=names[id];
   return '<div class="body-wrap"><section class="body-screen accessory-screen" lang="en" data-accessory="'+id+
     '" data-accessory-stage="'+stage+'"><h1 class="body-title"><strong>'+name.primary+'</strong>'+name.secondary+
     '</h1>'+content+'</section></div>'+row(actions);
 }

 function sideSelector(s,c,current){
   const inResult=s.route==='result/grip';
   const action=inResult?'grip-result-side':'local-side';
   const options=Object.entries(hand).map(([side,label])=>'<button type="button" aria-pressed="'+(current===side)+
     '" data-action="'+action+'" data-payload="'+c.esc(JSON.stringify({side}))+'" '+(!inResult&&!s.gripRetest&&s.mode==='retest'&&s.retakeView&&s.retakeView!==side?'disabled':'')+'>'+
     label+' hand</button>');
   return '<div class="accessory-side" role="group" aria-label="'+(inResult?'Retest hand':'Choose hand')+'">'+options.join('')+'</div>';
 }

 function previousSide(record,side){
   return record?.values.find(v=>v.id!==side);
 }

 function savedSide(record,c){
   return record?'<p class="accessory-other">'+hand[record.id]+' hand recorded <strong>'+sample(record.value)+' '+c.esc(record.unit)+'</strong></p>':'';
 }

 function prepare(s,id,c){
   const stopped=s.lastStop?.testId===id;
   const grip=id==='grip';
   const record=grip?c.E.gripWorkingRecord(s):null;
   const missing=record?.values.length?c.E.gripMissingSide(record):null;
   const streamlined=c.streamlinedGrip||!!s.gripRetest;
   const side=grip?(streamlined&&!s.retakeView&&missing?missing:c.E.gripSide(s)):null;
   const saved=side?previousSide(record,side):null;
   const changingHand=saved&&missing===side;
   const cancel=s.mode==='retest'?(changingHand&&!s.gripRetest?'Cancel':'Cancel retest'):'Skip';
   const later=c.E.canSkip(s,id)?c.b(cancel,'skip'):'';
   if(grip){
     if(streamlined&&changingHand){
       const start=c.b('Start '+side+' hand','start-measure',{id,view:side},'primary');
       return surface(id,'handoff-ready',gripHandoff(saved,side,stopped),later+start);
     }
     const intro='<div class="grip-ready-intro"><h2>Get ready.</h2><p>'+
       (changingHand?'Switch to your '+side+' hand.':'Choose either hand to start.')+'</p></div>';
     const position='<div class="grip-ready-stance"><h2>Stand tall.</h2>'+
       '<p>Feet hip-width apart.</p><p>Arm straight at your side.</p><p>Keep the meter clear of<br>your leg.</p></div>';
     const figure='<img class="grip-ready-figure" data-hand="'+side+'" src="'+file+'grip-ready.png" '+
       'width="256" height="384" alt="Standing with the grip meter beside your leg">';
     const gripDetail='<figure class="grip-ready-detail"><div><img src="'+file+'grip-hold.png" width="167" height="167" '+
       'alt="Hand fitted around the grip meter handle"></div><figcaption>Adjust grip to fit.</figcaption></figure>';
     const connection='<p class="grip-ready-connection"><img src="'+file+'grip-connected.svg" width="14" height="14" alt="">Grip meter connected</p>';
     const cue='<p class="grip-ready-cue">'+(stopped?'Grip test stopped. Try again when ready.':'Press Start before you squeeze.')+'</p>';
     const start=c.b(stopped?'Try again':'Start','start-measure',{id,view:side},'primary');
     return surface(id,'ready',figure+intro+sideSelector(s,c,side)+savedSide(saved,c)+
       position+gripDetail+connection+cue,later+start);
   }

   const guidance='<ol class="accessory-breath"><li><span>At the cue</span><strong>Breathe in fully.</strong></li>'+
     '<li><span>Into the mouthpiece</span><strong>Breathe out steadily.</strong></li></ol>';
   const connection='<div class="accessory-status"><span class="accessory-connected">✓</span> '+names[id].peripheral+
     ' connected'+(stopped?'<small>Stopped. Restart when ready.</small>':'')+'</div>';
   const figure='<img class="accessory-figure" src="'+file+id+'-ready.png" alt="Spirometer mouthpiece and preparation posture">';
   return surface(id,'ready',figure+guidance+connection,later+c.b(stopped?'Try again':'Start','start-measure',{id},'primary'));
 }

 function material(id,phrase,phase,index=0,value=null){
   // The visual gain shapes the material. It does not set a measurement threshold.
   const level=Number.isFinite(value)?Math.tanh(Math.max(0,value)/(id==='lung'?2400:32)):0;
   return '<div aria-hidden="true" class="accessory-material" data-motion="'+phase+'" style="--accessory-strength:'+Math.min(index,6)+
     ';--accessory-level:'+level.toFixed(3)+'"><img src="'+file+id+'-material.png" alt=""><span></span></div>'+
     '<p class="accessory-phrase">'+phrase+'</p>';
 }

 function reading(label,value,unit){
   const display=sample(value);
   return '<section class="accessory-reading"><h2>'+label+'</h2>'+(display===''?'':
     '<p class="accessory-value"><strong>'+display+'</strong><small>'+unit+'</small></p>')+'</section>';
 }

 function gripHandoff(recorded,side,stopped){
   const status=recorded?hand[recorded.id]+' hand recorded.':'No reading recorded.';
   const value=recorded?reading(hand[recorded.id]+' hand',recorded.value,'kg'):'';
   const prompt=!recorded?'Get ready to try again.':stopped?'Start again when your '+side+' hand is ready.':
     'Switch to your '+side+' hand. Start when ready.';
   return material('grip',status,'result')+value+'<p class="grip-handoff-note">'+prompt+'</p>';
 }

 function measure(s,id,c){
   const stream=s.acq?.accessory,grip=id==='grip',side=c.E.gripSide(s),stop=s.stop;
   const phase=stop?'stopping':stream?.phase||'waiting';
   const settling=phase==='settling';
   const value=settling?stream.peak:stream?.live;
   const gripWaiting=grip&&c.streamlinedGrip&&phase==='waiting';
   const gripPrompt=gripWaiting?'Hold the meter in your '+side+' hand.':'Squeeze with your '+side+' hand.';
   const help=stop?(grip?'Release your grip.':'Stop blowing.'):settling?(grip?'Relax your hand.':'You can stop blowing.') :
     grip?gripPrompt:phase==='waiting'?'Breathe in fully, then blow into the mouthpiece.':'Keep blowing steadily.';
   const status=stop?(stop.status==='unconfirmed'?'Stop not confirmed':'Waiting for stop confirmation…'):
      settling?'Recording…':phase==='waiting'?(grip?'Waiting for a squeeze':'Waiting for a breath'):(grip?hand[side]+' hand · Measuring':'Exhaling');
   const caption=gripWaiting?'Squeeze when ready.':grip?(settling?'Peak this squeeze':'Live force'):'Exhaled volume';
   const trailing=(grip&&phase==='live'?'<p class="accessory-peak">Peak this squeeze <strong>'+sample(stream?.peak)+' kg</strong></p>':'')+
     (grip?savedSide(previousSide(c.E.gripWorkingRecord(s),side),c):'');
   const controls=stop?.status==='unconfirmed'?c.b('Retry stop','retry-stop',{},'primary'):
     settling?'':c.b(stop?'Stopping':'Stop','stop',{},'stop-action',!!stop);
   return surface(id,phase,material(id,help,phase,stream?.samples,value)+reading(caption,value,names[id].unit)+trailing+
     (gripWaiting?'':'<div class="accessory-status" role="status">'+status+'</div>'),controls);
 }

 function gripResult(s,c){
   const {b,record,resultContinuation,resultBackAction,reviewResultButtons}=c;
   const id='grip',missing=c.E.gripMissingSide(record);
   const fullRetest=c.streamlinedGrip&&!missing;
   const recorded=record.values.find(v=>v.id!==missing&&hand[v.id]&&Number.isFinite(v.value));
   const selected=missing?recorded?.id:(s.localTasks?.gripResultSide||(hand[record.view]?record.view:'left'));
   const action=c.streamlinedGrip&&recorded?'start-grip-hand':'retest';
   const retest=fullRetest?{action:'retest',label:'Retest',payload:{id}}:
     selected?{action,label:'Retest '+selected+' hand',payload:{id,view:selected}}:null;
   const repair=missing?{action,label:action==='start-grip-hand'?'Start '+missing+' hand':'Prepare · '+hand[missing]+' hand',
     payload:{id,view:missing}}:null;
   let content;
   if(missing)content=gripHandoff(recorded,missing,s.lastStop?.testId===id&&s.lastStop.view===missing);
   else{
     content=material(id,'Both hands recorded.','result');
     content+='<div class="accessory-sides">'+Object.entries(hand).map(([side,label])=>
       reading(label+' hand',record.values.find(v=>v.id===side&&Number.isFinite(v.value)).value,'kg')).join('')+'</div>';
     if(!fullRetest)content+='<div class="grip-result-options"><span>Retest hand</span>'+sideSelector(s,c,selected)+'</div>';
   }
   const actions=reviewResultButtons?reviewResultButtons(id,repair,retest):
     (retest?b(retest.label,retest.action,retest.payload):'')+
     (repair?b(repair.label,repair.action,repair.payload,'primary')+(resultBackAction()||b('Continue','continue')):resultContinuation());
   return surface(id,missing?'handoff':'result',content,actions);
 }

 function result(s,id,c){
   if(id==='grip')return gripResult(s,c);
   const {b,record,resultContinuation,reviewResultButtons}=c;
   const actions=reviewResultButtons?reviewResultButtons(id):b('Retest','retest',{id})+resultContinuation();
   return surface(id,'result',material(id,'Measurement complete.','result')+
     reading('Lung capacity',record.values[0]?.value,'mL')+
     '<div class="accessory-status">Result recorded · Attempt '+record.attempt+'</div>',actions);
 }

 function recovery(s,id,c){
   const {E,b}=c,name=names[id],device=E.test(id).peripheral;
   const connection=s.route==='prerequisites';
   const connected=s.settings.peripherals[device];
   const safe=s.failure?.confirmed!==false;
   const detail=connection?(connected?'The connection is ready. Continue to preparation.':'Check the '+name.peripheral.toLowerCase()+' and try reconnecting.'):
     safe?(id==='lung'?'Check the seal around the mouthpiece. Try again when ready.':'Check the current hand and position on the grip meter. Try again when ready.'):'Wait until the device stops.';
   const action=connection?connected?b('Continue','resume-pending',{},'primary'):b('Check connection','check-connection',{},'primary'):
     safe?b('Try again','retry',{},'primary'):s.stop?.status==='unconfirmed'?b('Retry stop','retry-stop',{},'primary'):
       b(s.stop?'Stopping':'Stop','stop',{},'stop-action',!!s.stop);
   const heading=connection?(connected?'Device connected':'Device not connected'):safe?'No valid reading':'Waiting for the device';
   const makingUp=id==='grip'&&E.gripMissingSide(s.results.grip)===E.gripSide(s);
   const cancel=s.mode==='retest'?(makingUp?'Cancel':'Cancel retest'):'Skip';
   return surface(id,'recovery','<div class="accessory-recovery"><h2>'+heading+'</h2><p>'+detail+'</p>'+
      (s.results[id]?'<p>Your previous result is saved.</p>':'')+'</div>',
     (safe&&E.canSkip(s,id)?b(cancel,'skip'):'')+action);
 }

 root.ANOVATOR_ACCESSORY_UI={uses:id=>types.includes(id),render(s,kind,id,c){
   if(kind==='prepare')return prepare(s,id,c);
   if(kind==='measure')return measure(s,id,c);
   if(kind==='result')return result(s,id,c);
   return recovery(s,id,c);
 }};
})(globalThis);
