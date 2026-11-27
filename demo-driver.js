(function(root){
  'use strict';
  // Explicitly simulated transport. The engine has no elapsed-time completion rule.
  function create({getState,send,render,enabled,reportReceipts=false,clock=root}){
    let timer=null,key='';
    function clear(){if(timer!==null)clock.clearTimeout(timer);timer=null;key='';}
    function syncReport(s){
      const report=s.report;
      if(!reportReceipts||!s.assessmentClosing||!report||report.historyId||report.stale||
         !['report','report-preview','delivery'].includes(s.route)){clear();return;}
      const {stage,delivery}=report;
      const action=stage==='generating'?'report-generated':stage==='generated'?'report-save':
        delivery==='printing'?'delivered':null;
      if(!action){clear();return;}
      const nextKey=JSON.stringify([report.participantId,report.generatedAt,report.revision,action]);
      if(timer!==null&&key===nextKey)return;
      clear();key=nextKey;
      timer=clock.setTimeout(()=>{
        timer=null;key='';
        if(getState()!==s||s.report!==report||!s.assessmentClosing||report.stale||report.stage!==stage||report.delivery!==delivery)return;
        send(action,{});render();
      },720);timer?.unref?.();
    }
    function sync(){
      const s=getState(),a=s.acq;
      if(!enabled()||s.privacyLocked){clear();return;}
      if(!a){syncReport(s);return;}
      if(a.testId==='oxygen'||(s.route==='recovery'&&!s.stop)){clear();return;}
      let action,payload={},delay=2200;
      if(s.stop){
        if(s.stop.status==='unconfirmed'){clear();return;}
        const windDown=s.stop.needsRelease;
        if(windDown&&s.stop.status==='requested'){action='stop-status';payload.status='releasing';delay=180;}
        else{action='stopped';payload.released=!!windDown;delay=windDown?2200:180;}
      }else if(a.kind==='group'){
        if(s.group.phase==='release'){action='group-release';delay=750;}
        else{const id=s.group.members.find(id=>s.group.states[id]==='collecting');if(!id){clear();return;}
          action='group-event';payload={id,event:s.group.steps[id]<root.ANOVATOR_CATALOG.tests.find(t=>t.id===id).stages.length-1?'advance':'valid'};}
      }else if(a.bp){
        const next=root.ANOVATOR_ENGINE.bpDemoEvent(s);
        if(!next){clear();return;}
        ({delay,...payload}=next);
        action='bp-event';payload.participantId=s.user.id;
      }else if(a.testId==='rope'&&a.ropeStartedAt&&root.ANOVATOR_ROPE_UI){
        clear();return;
      }else if(a.accessory&&root.ANOVATOR_ACCESSORY_UI){
        ({delay,...payload}=root.ANOVATOR_ENGINE.accessoryDemoEvent(s));
        action='accessory-event';
        payload.participantId=s.user.id;
      }else if(a.motion&&root.ANOVATOR_MOTION_UI){
        const next=root.ANOVATOR_MOTION_TESTS.demoNext(a.motion);
        if(!next){clear();return;}
        ({delay,...payload}=next);
        action='motion-event';
        payload.participantId=s.user.id;
        payload.version=a.motion.version;
      }else if(a.pose){
        if(a.pose.waiting){clear();return;}
        if(a.pose.detecting){
          action='posture-detected';payload={view:a.pose.view,participantId:s.user.id};delay=620;
        }else{
          action='advance';delay=[0,2].includes(a.step)?5000:2400;
        }
      }else if(['vision','color','astigmatism','agility'].includes(a.testId)){clear();return;}
      else action='advance';
      const nextKey=JSON.stringify([a.id,a.step,a.accessory?.samples,s.stop?.status,s.group?.steps,s.group?.phase,action,payload]);
      if(timer!==null&&key===nextKey)return;
      clear();key=nextKey;payload.acqId=a.id;
      timer=clock.setTimeout(()=>{timer=null;key='';if(getState()!==s||s.acq?.id!==payload.acqId)return;send(action,payload);render();},delay);timer?.unref?.();
    }
    return {sync,clear};
  }
  root.ANOVATOR_DEMO_DRIVER={create};
})(globalThis);
