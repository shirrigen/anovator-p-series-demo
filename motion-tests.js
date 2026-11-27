(function(root){
  'use strict';

  const ids=['balance','shoulder','pushups','jump','scan360'];
  const directions=['lf','rf','la','ra'];
  const holdMs=10000;
  const balanceSamples=[80,79,81,82,80,81,82,81,81];
  const shoulderSamples=[28,57,86,115];
  const shoulderPeaks={lf:155,rf:158,la:160,ra:162};
  const labels={
    lf:{side:'Left',motion:'Forward raise'},
    rf:{side:'Right',motion:'Forward raise'},
    la:{side:'Left',motion:'Side raise'},
    ra:{side:'Right',motion:'Side raise'}
  };
  const packet=(event,delay,fields={})=>({event,delay,...fields});

  function create(id,sequence){
    if(!ids.includes(id))return null;
    return {
      id,phase:'position',sequence:sequence||[],cursor:0,version:0,enteredAt:Date.now(),samples:0,
      value:null,done:{},count:null,note:null,complete:false
    };
  }

  function enter(q,phase,note=null){
    q.phase=phase;
    q.note=note;
    q.enteredAt=Date.now();
    q.samples=0;
    q.version++;
    return true;
  }

  function direction(q){
    return directions[q.sequence[q.cursor]]||directions[0];
  }

  function finish(q){
    q.complete=true;
    return enter(q,'recorded');
  }

  function balance(q,p){
    if(q.phase==='position'&&p.event==='position-ready')return enter(q,'holding');
    if(q.phase==='holding'&&p.event==='balance-sample'&&Number.isFinite(p.value)&&p.value>=0&&p.value<=100){
      if(Number.isFinite(p.roll)&&Number.isFinite(p.pitch)){q.roll=p.roll;q.pitch=p.pitch;}
      q.value=p.value;q.samples++;q.version++;return true;
    }
    if(q.phase==='holding'&&p.event==='hold-ended'&&Number.isFinite(p.duration)&&p.duration>0){
      q.done.holdDuration=p.duration;return enter(q,'release');
    }
    if(q.phase==='holding'&&['foot-down','tracking-lost'].includes(p.event)){
      return enter(q,'invalid',p.event);
    }
    if(q.phase==='release'&&p.event==='saved'){
      if(Number.isFinite(p.value)&&p.value>=0&&p.value<=100)q.done.balance=p.value;
      return finish(q);
    }
    return false;
  }

  function shoulder(q,p){
    const id=direction(q);
    if(q.phase==='position'&&p.event==='position-ready')return enter(q,'raising');
    if(q.phase==='raising'&&p.direction===id&&p.event==='angle'&&Number.isFinite(p.value)&&p.value>=0&&p.value<=180){
      q.value=p.value;q.samples++;q.version++;return true;
    }
    if(q.phase==='raising'&&p.direction===id&&p.event==='raise-ended'&&Number.isFinite(p.value)&&p.value>=0&&p.value<=180){
      q.done[id]=p.value;q.value=p.value;return enter(q,'lower');
    }
    if(q.phase==='raising'&&p.event==='tracking-lost')return enter(q,'lost','tracking-lost');
    if(q.phase==='lower'&&p.event==='arm-lowered'){
      if(q.cursor+1>=q.sequence.length)return enter(q,'release');
      q.cursor++;q.value=null;return enter(q,'position');
    }
    if(q.phase==='release'&&p.event==='saved')return finish(q);
    return false;
  }

  function pushups(q,p){
    if(q.phase==='position'&&p.event==='position-ready')return enter(q,'repeating');
    if(q.phase==='repeating'&&p.event==='rep-counted'&&Number.isInteger(p.total)&&p.total>(q.count??0)){
      q.count=p.total;q.note='counted';q.samples++;q.version++;return true;
    }
    if(q.phase==='repeating'&&p.event==='rep-rejected'){
      q.note='rejected';q.samples++;q.version++;return true;
    }
    if(q.phase==='repeating'&&p.event==='tracking-lost')return enter(q,'lost','tracking-lost');
    if(q.phase==='repeating'&&p.event==='reps-ended'&&q.count>0)return enter(q,'release');
    if(q.phase==='release'&&p.event==='saved'){
      q.done.reps=q.count;return finish(q);
    }
    return false;
  }

  function jump(q,p){
    if(q.phase==='position'&&p.event==='position-ready')return enter(q,'go');
    if(q.phase==='go'&&p.event==='takeoff')return enter(q,'airborne');
    if(q.phase==='airborne'&&p.event==='landed')return enter(q,'landing');
    if(q.phase==='landing'&&p.event==='landing-valid'&&Number.isFinite(p.height)&&p.height>0){
      q.done.jumpHeight=p.height;return enter(q,'release');
    }
    if(q.phase==='landing'&&p.event==='landing-invalid')return enter(q,'invalid','landing-invalid');
    if(['go','airborne','landing'].includes(q.phase)&&p.event==='tracking-lost')return enter(q,'invalid','tracking-lost');
    if(q.phase==='release'&&p.event==='saved')return finish(q);
    return false;
  }

  function scan(q,p){
    if(q.phase==='position'&&p.event==='platform-ready')return enter(q,'rotating');
    if(q.phase==='rotating'&&p.event==='turn'&&Number.isFinite(p.angle)&&p.angle>=0&&p.angle<=360){
      q.value=p.angle;q.samples++;q.version++;return true;
    }
    if(q.phase==='rotating'&&p.event==='scan-ended')return enter(q,'platform-stopping');
    if(q.phase==='platform-stopping'&&p.event==='platform-stopped')return enter(q,'still');
    if(q.phase==='still'&&p.event==='step-off-permitted')return enter(q,'release');
    if(q.phase==='release'&&p.event==='image-invalid')return enter(q,'invalid','image-invalid');
    if(q.phase==='release'&&p.event==='saved')return finish(q);
    return false;
  }

  const handlers={balance,shoulder,pushups,jump,scan360:scan};

  function receive(q,packet){
    return handlers[q.id](q,packet);
  }

  function tryAgain(q){
    if(!['invalid','lost'].includes(q.phase))return false;
    if(q.phase==='invalid'){q.value=null;q.done={};}
    else if(q.id==='shoulder')q.value=null;
    return enter(q,'position');
  }

  function finishPartial(q){
    if(!['position','lost'].includes(q.phase)||q.id!=='shoulder'||!Object.keys(q.done).length)return false;
    return finish(q);
  }

  function nextBalance(q){
    if(q.phase==='position')return packet('position-ready',3900);
    if(q.phase==='holding')return q.samples<balanceSamples.length?
      packet('balance-sample',1000,{value:balanceSamples[q.samples],
        roll:[-.08,.17,.02,-.12,-.06,.1,.05,0,.025][q.samples],
        pitch:[.04,.06,-.04,-.05,0,.07,.04,-.02,0][q.samples]})
      :packet('hold-ended',1000,{duration:holdMs/1000});
    if(q.phase==='release')return packet('saved',1400,{value:81});
  }

  function nextShoulder(q){
    if(q.phase==='position')return packet('position-ready',2200);
    const id=direction(q);
    if(q.phase==='raising')return q.samples<shoulderSamples.length?
      packet('angle',670,{direction:id,value:shoulderSamples[q.samples]}):
      packet('raise-ended',830,{direction:id,value:shoulderPeaks[id]});
    if(q.phase==='lower')return packet('arm-lowered',1650);
    if(q.phase==='release')return packet('saved',1250);
  }

  function nextPushups(q){
    if(q.phase==='position')return packet('position-ready',2300);
    if(q.phase==='repeating'){
      if(q.samples===2)return packet('rep-rejected',1440);
      if((q.count??0)<12)return packet('rep-counted',1320,{total:(q.count??0)+1});
      return packet('reps-ended',1000);
    }
    if(q.phase==='release')return packet('saved',1300);
  }

  function nextJump(q){
    if(q.phase==='position')return packet('position-ready',2350);
    if(q.phase==='go')return packet('takeoff',1350);
    if(q.phase==='airborne')return packet('landed',750);
    if(q.phase==='landing')return packet('landing-valid',720,{height:42.6});
    if(q.phase==='release')return packet('saved',1400);
  }

  function nextScan(q){
    if(q.phase==='position')return packet('platform-ready',2500);
    if(q.phase==='rotating'){
      if(q.samples<8)return packet('turn',850,{angle:(q.samples+1)*45});
      return packet('scan-ended',500);
    }
    if(q.phase==='platform-stopping')return packet('platform-stopped',1100);
    if(q.phase==='still')return packet('step-off-permitted',950);
    if(q.phase==='release')return packet('saved',1450);
  }

  const demo={balance:nextBalance,shoulder:nextShoulder,pushups:nextPushups,jump:nextJump,scan360:nextScan};

  function seedValues(q,original,prior=[]){
    if(!q.complete)return null;
    const apply=field=>Object.hasOwn(q.done,field.id)?{...field,value:q.done[field.id],pending:false}:field;
    const declared=original.map(apply);
    if(q.id==='shoulder'){
      const known=new Map(prior.filter(field=>!field.pending).map(field=>[field.id,field]));
      return original.flatMap(field=>Object.hasOwn(q.done,field.id)?[apply(field)]:known.has(field.id)?[known.get(field.id)]:[]);
    }
    if(q.id==='balance'&&Number.isFinite(q.done.holdDuration)){
      declared.push({id:'holdDuration',label:'有效保持时长',value:q.done.holdDuration,unit:'s'});
    }
    if(q.id==='jump'&&Number.isFinite(q.done.jumpHeight)){
      declared.push({id:'jumpHeight',label:'弹跳高度',value:q.done.jumpHeight,unit:'cm'});
    }
    return declared;
  }

  const api={
    uses:id=>ids.includes(id),holdMs,create,direction,labels,receive,tryAgain,finishPartial,seedValues,
    demoNext:q=>demo[q.id](q)
  };
  if(typeof module!=='undefined')module.exports=api;
  root.ANOVATOR_MOTION_TESTS=api;
})(globalThis);
