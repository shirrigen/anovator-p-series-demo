(function(root){
  'use strict';
  const C=root.ANOVATOR_CATALOG,H=root.ANOVATOR_HEIGHT,W=root.ANOVATOR_WEIGHT;
  const screenFlow=root.ANOVATOR_SCREEN_TEST_FLOW||(typeof module!=='undefined'?require('./screen-test-flow.js'):null);
  const motion=root.ANOVATOR_MOTION_TESTS||(typeof module!=='undefined'?require('./motion-tests.js'):null);
  const copy=x=>JSON.parse(JSON.stringify(x));
  const test=id=>C.tests.find(t=>t.id===id);
  const profile=id=>C.profiles.find(p=>p.id===id);
  const now=()=>new Date().toISOString();
  const reviewRoutes=()=>root.ANOVATOR_ROUTE_REVIEW===true;
  function fresh(profileId='p3'){
    const p=profile(profileId)||C.profiles[0];
    return {profileId:p.id,role:'self',route:'standby',returnRoute:'home',pendingTest:null,pendingMode:'single',mode:'single',user:null,consent:false,basics:{age:'',sex:'',height:null,weight:null},plan:[],scopeMode:'free',skipped:[],status:{},results:{},revision:0,attempts:{},trials:{},acqSerial:0,localTasks:{},lastStop:null,acq:null,stop:null,report:null,history:[],selectedHistory:null,selectedMetric:'fat',selectedView:'front',faceHidden:true,overlays:{grid:true,bones:true,risk:true,dimensions:true},admin:false,settings:{network:'online',language:'zh-CN',unit:'metric',activated:true,enabled:[...p.tests],height:p.height,weight:p.weight,lockType:null,sync:'idle',mirror:false,peripherals:{cuff:true,oximeter:true,spirometer:true,dynamometer:true},calibration:{tare:0},clinical:false},setupStep:0,service:{},message:'',events:[],reportPage:0,reportZoom:1,modeNotice:''};
  }
  function log(s,event,detail=''){s.events.push({at:now(),event,detail});if(s.events.length>120)s.events.shift();}
  function go(s,route){
    if(!C.isRouteVisible(route))route='home';
    if(['home','results','plan'].includes(route)){
      // Single-capability devices enter the task directly.
      if(singleBodyOnly(s)){openSingleBody(s);return;}
      if(!s.user||!s.consent)route=s.user?'consent':'identity';
      if(route==='home'||route==='results')delete s.planDraft;
    }
    s.route=route;s.message='';log(s,'页面',route);
  }
  function allowed(s,id){return profile(s.profileId).tests.includes(id)&&s.settings.enabled.includes(id);}
  function activeIds(s){return profile(s.profileId).tests.filter(id=>s.settings.enabled.includes(id));}
  function singleBodyOnly(s){const ids=activeIds(s);return ids.length===1&&ids[0]==='body';}
  function openSingleBody(s){
    if(s.acq){requestLeave(s,'home','home');return;}
    s.selectedHistory=null;s.receiptReturn=null;s.readingReturn=null;
    if(s.user&&s.results.body?.participantId===s.user.id){go(s,'result/body');return;}
    beginWalk(s,'body','single');
  }
  function validCount(s){return Object.keys(s.results).length;}
  // Current-session body composition unlocks optional measurements.
  // Selection defines scope; traversal can wrap inside that scope.
  function hasComplete(s,id){return !!s.results[id]&&!s.results[id].partial&&!s.results[id].needsReview;}
  function mandatoryReady(s){return hasComplete(s,'body')&&!!s.user&&s.results.body.participantId===s.user.id;}
  function canSkip(s,id=s.pendingTest){return s.mode==='retest'||(id!=='body'&&mandatoryReady(s));}
  function normalizePlan(s){s.plan=activeIds(s).filter(id=>id==='body'||s.plan.includes(id));}
  function completedIds(s){return activeIds(s).filter(id=>hasComplete(s,id));}
  function circularOrder(s,start=0){const order=activeIds(s).filter(id=>s.plan.includes(id));return order.slice(start).concat(order.slice(0,start));}
  function remaining(s){
    if(!mandatoryReady(s))return allowed(s,'body')?['body']:[];
    const order=activeIds(s).filter(id=>s.plan.includes(id));
    if(reviewRoutes()){
      const anchor=s.walk?.order?.[s.walk.cursor];
      const start=Math.max(0,order.indexOf(anchor));
      return circularOrder(s,start).filter(id=>!hasComplete(s,id)&&!s.skipped.includes(id));
    }
    const current=s.route.startsWith('result/')?s.route.split('/')[1]:null;
    const start=current&&order.includes(current)?(order.indexOf(current)+1)%order.length:Math.max(0,s.walk?.cursor||0);
    const candidates=circularOrder(s,start).filter(id=>!hasComplete(s,id)&&!s.skipped.includes(id));
    return candidates;
  }
  function next(s){return remaining(s)[0]||null;}
  function nextAfter(s,id){
    if(!mandatoryReady(s)&&id!=='body')return allowed(s,'body')?'body':null;
    const order=activeIds(s).filter(x=>s.plan.includes(x)),index=order.indexOf(id);
    return index<0?null:circularOrder(s,(index+1)%order.length).find(x=>x!==id&&!hasComplete(s,x)&&!s.skipped.includes(x))||null;
  }
  function naturalAnchor(s){
    if(s.route.startsWith('group-'))return s.group?.members.at(-1)||'bp';
    if(s.route.startsWith('result/')||s.route.startsWith('prepare/'))return s.route.split('/')[1];
    return s.pendingTest;
  }
  function naturalNext(s,anchor=naturalAnchor(s)){
    if(!mandatoryReady(s)||s.naturalCloseout===s.route)return null;
    const order=activeIds(s),index=order.indexOf(anchor);
    if(index<0)return null;
    return order.slice(index+1).find(id=>s.plan.includes(id)&&!s.skipped.includes(id))||null;
  }
  function readableResult(s,id){
    const record=s.results[id];
    return !!record&&s.user?.id!=null&&record.participantId===s.user.id&&!record.needsReview;
  }
  function outstanding(s){return activeIds(s).filter(id=>!hasComplete(s,id));}
  function completeCount(s){return completedIds(s).length;}
  function scope(s){
    const chosen=activeIds(s).filter(id=>s.plan.includes(id));
    const done=chosen.filter(id=>hasComplete(s,id));
    const missing=chosen.filter(id=>!hasComplete(s,id));
    return {chosen,done,missing,optional:activeIds(s).filter(id=>!chosen.includes(id)&&!s.results[id]),retained:activeIds(s).filter(id=>!chosen.includes(id)&&s.results[id]),complete:chosen.length>0&&!missing.length};
  }
  function suggestedNext(s){
    const current=s.route.startsWith('result/')?s.route.split('/')[1]:s.walk?.lastCompleted||s.pendingTest;
    return activeIds(s).slice(activeIds(s).indexOf(current)+1).find(id=>!s.plan.includes(id)&&!s.results[id])||null;
  }
  const detailRoutes=['metric','health','segments','posture-summary','group-result'];
  const inSessionHome=s=>['home','results'].includes(s.route);
  const preparing=(s,includeRecovery=false)=>s.route.startsWith('prepare/')||['prerequisites','group-prepare'].includes(s.route)||
    (s.route==='profile'&&!!s.pendingTest)||(includeRecovery&&s.route==='recovery');
  const viewedFromPreview=s=>!!s.previewResult&&s.route==='result/'+s.previewResult;
  function restoreVisibleTasks(s){
    const visible=C.isTestVisible;
    const pendingHidden=!visible(s.pendingTest), acquiringHidden=!visible(s.acq?.testId);
    const leaveHiddenRoute=!C.isRouteVisible(s.route)||acquiringHidden||
      (pendingHidden&&(preparing(s)||['recovery','unavailable','stop'].includes(s.route)));
    if(pendingHidden){s.pendingTest=null;s.pendingMode=s.mode='single';}
    if(acquiringHidden){
      const {testId,priorStatus}=s.acq;
      s.status[testId]=priorStatus||'unmeasured';
      s.acq=null;
      s.stop=null;
    }
    if(!visible(s.failure?.testId))s.failure=null;
    if(!visible(s.homeProject))s.homeProject=null;
    if(!visible(s.previewResult)){s.previewResult=null;s.previewResultRoute=null;}
    if(!visible(s.receiptReturn?.pendingTest))s.receiptReturn=null;
    if(!visible(s.assessmentPreparation?.pendingTest))s.assessmentPreparation=null;
    const reading=s.readingReturn;
    if(!C.isRouteVisible(reading?.route))s.readingReturn=null;
    else if(!C.isRouteVisible(reading?.resultBrowser?.previous?.route))reading.resultBrowser.previous=null;
    if(!C.isRouteVisible(s.historyReturn?.route))s.historyReturn=null;
    if(s.planDraft)s.planDraft.ids=s.planDraft.ids.filter(visible);
    const walk=s.walk;
    if(walk?.order.some(id=>!visible(id))){
      const {order,cursor}=walk;
      const anchor=order.slice(cursor).concat(order.slice(0,cursor)).find(visible);
      walk.order=order.filter(visible);
      walk.cursor=Math.max(0,walk.order.indexOf(anchor));
      if(!visible(walk.directTest)){delete walk.directTest;delete walk.homePreparation;}
      if(!visible(walk.homePreparation?.previous?.pendingTest))walk.homePreparation.previous=null;
    }
    if(leaveHiddenRoute)go(s,s.user?'home':'standby');
  }
  function rememberReading(s,includeResult=false,viewport=null){
    const fromResults=Number.isFinite(viewport?.scrollTop);
    if(s.selectedHistory||s.readingReturn?.resultBrowser||(!fromResults&&(s.readingReturn||s.receiptReturn)))return;
    if(detailRoutes.includes(s.route)||(includeResult&&s.route.startsWith('result/'))){
      const {route,selectedMetric,selectedView,homeProject,previewResult,previewResultRoute}=s;
      const origin={route,selectedMetric,selectedView,homeProject,previewResult,previewResultRoute:previewResultRoute??null};
      if(fromResults)origin.resultBrowser={scrollTop:viewport.scrollTop,details:viewport.details,previous:s.readingReturn??null};
      s.readingReturn=copy(origin);
    }
  }
  function preparationContext(s){
    const {route,pendingTest,pendingMode,mode,returnRoute,transition,selectedMetric,selectedView,retakeView}=s;
    return copy({route,pendingTest,pendingMode,mode,returnRoute,transition:transition||null,selectedMetric,selectedView,retakeView,screenPosition:s.localTasks?.screenPosition});
  }
  function rememberPreparation(s,viewport,fromProjectPreview=false,includeRecovery=false){
    if(!s.receiptReturn&&preparing(s,includeRecovery)){
      s.receiptReturn=preparationContext(s);
      if(viewport)s.receiptReturn.viewport=copy(viewport);
      if(fromProjectPreview)s.receiptReturn.fromProjectPreview=true;
    }
  }
  function restorePreparation(s,origin){
    const {route,screenPosition,viewport,fromProjectPreview,...task}=origin;
    Object.assign(s,task);
    if(route==='recovery'&&s.failure?.testId===origin.pendingTest){go(s,'recovery');return;}
    if(origin.pendingMode==='group')prepareGroup(s,true);
    else startTask(s,origin.pendingTest,origin.pendingMode,origin.returnRoute);
    if(s.route===route&&screenPosition===origin.pendingTest)s.localTasks.screenPosition=screenPosition;
  }
  function showOverview(s,direct=false){
    if(s.acq){s.message='请先完成或停止当前测量。';return;}
    const homePreparation=s.walk?.homePreparation;
    if(homePreparation){
      // Leaving a shortcut restores the earlier preparation, if any.
      s.receiptReturn=homePreparation.previous;
      delete s.walk.directTest;
      delete s.walk.homePreparation;
    }else rememberPreparation(s,null,false,direct);
    if(s.receiptReturn)delete s.receiptReturn.fromProjectPreview;
    s.homeProject=null;s.previewResult=null;s.readingReturn=null;s.selectedHistory=null;
    go(s,'home');
  }
  function beginWalk(s,id,mode='walk'){
    s.receiptReturn=null;s.readingReturn=null;s.previewResult=null;
    if(!allowed(s,id)){startTask(s,id,mode);return;}
    const requested=id;
    const following=s.scopeMode==='selected'?[id,'body']:activeIds(s);
    if(id!=='body'&&!mandatoryReady(s))id='body';
    const chosen=new Set([...s.plan,...following]);
    s.plan=activeIds(s).filter(x=>chosen.has(x));
    s.skipped=s.skipped.filter(x=>x!==id);
    if(s.status[id]==='skipped')s.status[id]='unmeasured';
    s.walk={order:[...s.plan],cursor:s.plan.indexOf(id),startId:id,origin:s.route,lastCompleted:null,bypassed:[]};
    s.transition=null;
    s.selectedHistory=null;
    if(canGroup(s,id))prepareGroup(s);else startTask(s,id,mode);
    if(requested!==id)s.message='请先完成人体成分分析，再选择其他项目。';
  }
  function advanceWalk(s,id){
    if(!s.walk)return;
    const direct=s.walk.directTest===id;
    const anchor=s.walk.order[s.walk.cursor];
    s.walk.order=activeIds(s).filter(x=>s.plan.includes(x));
    s.walk.cursor=direct?Math.max(0,s.walk.order.indexOf(anchor)):(s.walk.order.indexOf(id)+1)%s.walk.order.length;
    delete s.walk.directTest;
    delete s.walk.homePreparation;
    s.walk.lastCompleted=id;
    s.walk.bypassed=[];
    for(const candidate of circularOrder(s,s.walk.cursor)){
      if(hasComplete(s,candidate)){s.walk.bypassed.push(candidate);continue;}
      if(!s.skipped.includes(candidate))break;
    }
  }
  function continueWalk(s){
    s.receiptReturn=null;s.previewResult=null;
    if(reviewRoutes())s.readingReturn=null;
    const id=next(s);
    if(!id){if(!s.route.startsWith('result/')&&s.route!=='group-result')go(s,'results');return;}
    if(!s.walk){beginWalk(s,id,s.scopeMode==='selected'?'full':'walk');return;}
    delete s.walk.directTest;
    delete s.walk.homePreparation;
    s.walk.cursor=s.walk.order.indexOf(id);
    if(canGroup(s,id))prepareGroup(s);else startTask(s,id,s.mode==='full'?'full':'walk');
    s.transition=null;
  }
  function continueNatural(s,{expected,closeout=false}={}){
    if(!reviewRoutes()||!mandatoryReady(s)||!s.consent||s.acq||s.stop||s.privacyLocked||s.selectedHistory)return;
    const id=naturalNext(s);
    if((expected&&expected!==id)||(!id&&!closeout))return;
    s.receiptReturn=null;s.readingReturn=null;s.previewResult=null;s.previewResultRoute=null;
    if(!id){
      // A terminal skip returns to the newest readable result for End, not to the pending-work loop.
      const last=activeIds(s).filter(testId=>readableResult(s,testId))
        .sort((a,b)=>(s.results[b].revision||0)-(s.results[a].revision||0))[0];
      if(!last)return;
      s.naturalCloseout='result/'+last;
      go(s,s.naturalCloseout);
      return;
    }
    delete s.naturalCloseout;
    if(readableResult(s,id)){
      const record=s.results[id];
      if(id==='posture'&&record.partial){
        const views=record.views?Object.keys(record.views):[record.view];
        if(!views.includes(s.selectedView)&&['front','side'].includes(views[0]))s.selectedView=views[0];
      }
      go(s,'result/'+id);
      return;
    }
    const order=activeIds(s).filter(testId=>s.plan.includes(testId));
    s.walk??={startId:id,origin:s.route,lastCompleted:null,bypassed:[]};
    s.walk.order=order;s.walk.cursor=order.indexOf(id);
    delete s.walk.directTest;
    delete s.walk.homePreparation;
    s.retakeView=null;s.transition=null;
    if(s.results[id]){dispatch(s,'retest',{id,returnRoute:s.route});return;}
    startTask(s,id,s.scopeMode==='selected'?'full':'walk');
  }
  function preparePlannedTest(s,id,direct=false){
    const fromOverview=inSessionHome(s)&&!s.homeProject;
    const fromTask=direct&&(preparing(s,true)||detailRoutes.includes(s.route));
    if(!reviewRoutes()||(!fromOverview&&!fromTask&&!s.route.startsWith('result/'))||!s.user||!s.consent||s.selectedHistory||s.privacyLocked||s.acq)return;
    const {chosen,missing}=scope(s);
    const optional=direct&&allowed(s,id)&&!chosen.includes(id);
    if((!missing.includes(id)&&!optional)||(id!=='body'&&!mandatoryReady(s)))return;
    if(fromOverview&&s.results[id]?.needsReview)return;
    if(s.receiptReturn?.pendingTest===id){dispatch(s,'return-to-task');return;}
    const scheduled=next(s),mode=s.scopeMode==='selected'?'full':'walk';
    if(id===scheduled&&!s.results[id]?.partial){continueWalk(s);return;}
    // An explicit choice inserts one test at the current position in the plan.
    s.walk??={order:chosen,cursor:Math.max(0,chosen.indexOf(scheduled)),startId:scheduled||id,origin:s.route,lastCompleted:null,bypassed:[]};
    s.walk.directTest=id;
    if(fromTask)rememberPreparation(s,null,false,direct);
    if(fromOverview||fromTask)s.walk.homePreparation={previous:s.receiptReturn??null};
    s.receiptReturn=null;s.readingReturn=null;s.previewResult=null;s.previewResultRoute=null;s.transition=null;
    const posture=id==='posture'?s.results.posture:null;
    const view=posture?.partial&&posture.views?(posture.views.front?'side':'front'):null;
    s.retakeView=null;
    startTask(s,id,mode,null,view);
  }
  function openDirectProject(s,{id,resultViewport}){
    if(!reviewRoutes()||!s.user||!s.consent||s.acq||s.selectedHistory||s.privacyLocked||singleBodyOnly(s))return;
    if(!allowed(s,id)){s.message='此设备暂未开放该项目。';return;}
    if(preparing(s,true)&&s.mode==='retest'){s.message='请先完成或取消当前重测。';return;}
    if(s.route==='prepare/'+id||s.route==='result/'+id||(s.route==='group-prepare'&&s.group?.members.includes(id)))return;
    delete s.naturalCloseout;
    if(readableResult(s,id)){
      dispatch(s,'view-completed',{id,direct:true,resultViewport});
      return;
    }
    const ready=mandatoryReady(s),target=ready?id:'body';
    if(s.results[target]?.needsReview)dispatch(s,'retest',{id:target,returnRoute:s.route});
    else if(ready)preparePlannedTest(s,id,true);
    else beginWalk(s,'body');
    if(target!==id)s.message='请先完成人体成分分析，再选择其他项目。';
  }
  function needsProfile(s,id){const t=test(id);return t?.needsProfile&&(!s.basics.age||!s.basics.sex);}
  function needsBasics(s,id){return test(id)?.needsBasics&&H.required(s,id);}
  function startTask(s,id,mode='single',returnRoute=null,view=null){
    if(!C.isTestVisible(id))return;
    if(mode==='group'){prepareGroup(s);return;}
    if(!test(id)||!allowed(s,id)){s.pendingTest=id;go(s,'unavailable');return;}
    if(id!=='body'&&!mandatoryReady(s)){beginWalk(s,id);return;}
    if(id!=='grip'&&s.gripRetest)s.gripRetest=null;
    if(s.pendingTest!==id){s.retakeView=null;s.lastStop=null;}
    if(view)s.retakeView=view;
    if(id==='grip'&&!s.retakeView){
      const missing=gripMissingSide(s.results.grip);
      if(missing)(s.localTasks??={}).grip=missing;
    }
    s.pendingTest=id;s.pendingMode=mode;if(returnRoute)s.returnRoute=returnRoute;
    if(!s.user){go(s,'identity');return;}
    if(!s.consent){go(s,'consent');return;}
    if(needsProfile(s,id)){go(s,'profile');return;}
    s.mode=mode;
    const t=test(id);
    if(needsBasics(s,id)||(id!=='oxygen'&&t.peripheral&&!s.settings.peripherals[t.peripheral])){go(s,'prerequisites');return;}
    if(id==='oxygen'&&s.oxygenFlow){
      const previous=s.oxygenFlow.participantId===s.user.id?s.oxygenFlow:{};
      s.oxygenFlow={participantId:s.user.id,resultSand:previous.resultSand,settings:previous.settings,reduced:previous.reduced};
    }
    if(screenFlow.uses(id))s.localTasks.screenPosition=null;
    go(s,'prepare/'+id);
  }
  function resumePending(s){if(s.pendingTest)startTask(s,s.pendingTest,s.pendingMode);else go(s,'home');}
  function skipDestination(s,natural){
    if(s.mode==='retest')return s.returnRoute||'results';
    return natural&&reviewRoutes()?'next-natural':s.walk?'next':'results';
  }
  function requestLeave(s,target,kind){
    if(s.acq&&s.stop)return;
    if(kind==='skip'&&!canSkip(s)){s.message='体成分是必测项目。可重新测量，或退出本次测量。';return;}
    if(s.acq){
      if(kind!=='cancel'){s.message='请先停止当前测量，再选择其他操作。';return;}
      if(s.acq.bp?.pair){s.message='本次读数已取得，请等待设备结束和记录保存。';return;}
      // A deliberate stop is accepted once, in the current acquisition screen.
      // The device adapter, never a route change, confirms actual completion.
      const platformBusy=s.acq.testId==='scan360'&&s.acq.motion?.phase!=='release';
      s.stop={target:s.acq.stopReturn||target,kind,requested:true,status:'requested',previousRoute:s.route,acqId:s.acq.id,needsRelease:platformBusy||['bp','oxygen'].includes(s.acq.testId)||(s.acq.kind==='group'&&s.group.states.bp!=='queued'),confirmed:false,released:false};
      s.bodyDataReady=false;log(s,'停止已受理',s.acq.testId);return;
    }
    if(kind==='skip'&&s.pendingTest){
      const id=s.pendingTest;
      if(s.mode==='retest'&&id==='grip'){
        s.retakeView=null;
        s.gripRetest=null;
      }
      if(!s.results[id])s.status[id]='skipped';
      if(s.mode!=='retest'){
        if(!s.skipped.includes(id))s.skipped.push(id);
        advanceWalk(s,id);
      }
      log(s,s.mode==='retest'?'取消重测':'跳过项目',id);
    }
    if(target==='end'){endAssessment(s);}
    else if(target==='next'){continueWalk(s);}
    else if(target==='next-natural'){continueNatural(s,{closeout:true});}
    else {if(['home','results'].includes(target)){s.receiptReturn=null;s.readingReturn=null;s.previewResult=null;}go(s,target);}
  }
  function bodyWaiting(s){const missing=[!H.usable(s)?'身高':null,!W.usable(s)?'体重':null].filter(Boolean);return '正在获取'+missing.join('与')+'，请稍候。';}
  function samples(s,id){
    if(id==='grip')return gripValues(s);
    const values=copy(test(id).outputs);
    if(s.acq?.motion?.complete){
      return motion.seedValues(s.acq.motion,values,s.results[id]?.values);
    }
    if(id==='bp'&&s.acq?.kind!=='group'&&s.acq?.bp?.pair){
      return values.map(field=>({...field,value:s.acq.bp.pair[field.id]}));
    }
    if(id==='oxygen'){
      const pair=s.acq.oxygenPair;
      return values.map(field=>field.id==='spo2'?{...field,value:pair.oxygen}:field.id==='pulse'?{...field,value:pair.pulse}:field);
    }
    if(id==='rope'&&s.acq?.ropeRecord){
      const {count,duration}=s.acq.ropeRecord;
      return values.map(field=>({...field,value:field.id==='ropeCount'?count:duration}));
    }
    if(id==='lung'&&Number.isFinite(s.acq?.accessory?.peak))return values.map(field=>({...field,value:s.acq.accessory.peak}));
    if(id==='body'){
      const h=H.adopted(s)?.value,w=W.adopted(s)?.value;
      if(!H.usable(s)||!W.usable(s))throw new Error('Body result requires adopted height and current measured weight');
      for(const v of values){if(v.id==='height')v.value=h;if(v.id==='weight')v.value=w;if(v.id==='bmi')v.value=Math.round(w/(h/100)**2*10)/10;}
    }
    const scope=s.acq?.view,prior=s.results[id];
    if(scope&&prior&&['shoulder','grip'].includes(id))return values.map(v=>v.id===scope?v:copy(prior.values.find(x=>x.id===v.id)||v));
    return values;
  }
  function gripMissingSide(record){
    if(!record)return null;
    return ['left','right'].find(side=>!record.values.some(v=>v.id===side&&Number.isFinite(v.value)))||null;
  }
  function gripValues(s){
    const trials=s.gripRetest||s.trials?.grip||[];
    return ['left','right'].flatMap(side=>{
      const trial=trials.filter(v=>v.side===side&&v.participantId===s.user?.id).at(-1);
      if(trial)return [{id:side,label:side==='left'?'左手握力':'右手握力',value:trial.value,unit:'kg'}];
      const previous=s.gripRetest?null:s.results.grip?.values.find(v=>v.id===side);
      return previous?[copy(previous)]:[];
    });
  }
  function gripWorkingRecord(s){
    return s.gripRetest?{values:gripValues(s)}:s.results.grip;
  }
  function gripSide(s){return s.acq?.testId==='grip'?(s.acq.view||(s.acq.step<2?'left':'right')):(s.retakeView||s.localTasks?.grip||'left');}
  function saveGripTrial(s,side){
    const a=s.acq;if(!a||a.testId!=='grip'||s.stop||a.recordedSides?.includes(side))return;
    (a.recordedSides??=[]).push(side);s.trials??={};const trials=s.trials.grip??=[];
    (s.gripRetest||trials).push({side,value:a.accessory?.peak??(side==='left'?28.4:27.1),unit:'kg',at:now(),participantId:s.user.id,acqId:a.id,number:trials.filter(v=>v.side===side).length+1,sample:true,quality:'valid'});
    log(s,'单侧有效记录',side);
  }
  function saveResult(s,id){
    if(id==='oxygen'&&!s.acq?.oxygenPair)return false;
    if(id==='bp'&&s.acq?.kind!=='group'&&!(s.acq?.bp?.pair&&s.acq.bp.phase==='saving'))return false;
    if(id==='body'&&(!H.usable(s)||!W.usable(s)))return false;
    const t=test(id),prior=s.results[id];
    if(id==='grip'){
      s.acq.partial=samples(s,id).length<2;
      delete s.localTasks?.gripResultSide;
    }
    if(id==='shoulder'&&s.acq.motion?.complete)s.acq.partial=samples(s,id).length<4;
    const screenRecord=s.acq.screen?screenFlow.record(s.acq.screen):null;
    const attempt={at:now(),number:(s.attempts[id]?.length||0)+1,values:screenRecord?.values||samples(s,id),sample:true,quality:'valid',view:s.acq.view||null};
    (s.attempts[id]??=[]).push(attempt);
    s.revision++;
    s.results[id]={testId:id,values:attempt.values,at:attempt.at,revision:s.revision,attempt:attempt.number,sample:true,participantId:s.user.id,partial:!!s.acq.partial,view:s.acq.view||'both',priorRevision:prior?.revision||null,adoption:t.attempts?'本次尝试；正式采用规则待核':'有效事件模拟'};
    if(id==='posture'){
      // Each captured view has its own provenance. Aggregated fields stay tied to the analysis result.
      const priorViews=prior?(['front','side'].includes(prior.view)?[prior.view]:['front','side']):[];
      const views=prior?.views||Object.fromEntries(priorViews.map(view=>[view,{revision:prior.revision,at:prior.at}]));
      const updated=s.acq.view?[s.acq.view]:s.acq.partial?[s.acq.pose?.captured||s.acq.pose?.view||'front']:['front','side'];
      s.results[id].views={...views,...Object.fromEntries(updated.map(view=>[view,{revision:s.revision,at:attempt.at}]))};
      s.acq.partial=Object.keys(s.results[id].views).length<2;
      s.results[id].partial=s.acq.partial;
      s.selectedView=updated.length===1?updated[0]:s.selectedView;
    }
    if(screenRecord){
      attempt.screen=copy(screenRecord.screen);
      s.results[id].screen=copy(screenRecord.screen);
    }
    if(id==='body'){s.results[id].height=copy(H.adopted(s));s.results[id].weight=copy(W.adopted(s));}
    if(['bp','oxygen'].includes(id)||s.acq.motion?.complete){attempt.acqId=s.acq.id;s.results[id].acqId=s.acq.id;}
    s.status[id]=s.acq?.partial?'partial':'done';
    if(s.report&&!s.report.historyId){s.report.stale=true;}
    if(s.reports?.current)s.reports.current.stale=true;
    log(s,'有效结果模拟',id+' / v'+s.revision);
    return true;
  }
  function complete(s){
    const id=s.acq.testId;
    const gripRetest=id==='grip'?s.gripRetest:null;
    if(gripRetest&&gripRetest.length<2){
      // Keep the published pair until both new measurements are available.
      s.acq=null;s.stop=null;s.status.grip='done';
      const nextHand=gripRetest.length?gripMissingSide(gripWorkingRecord(s)):null;
      startTask(s,id,'retest',s.returnRoute,nextHand);
      return;
    }
    if(!saveResult(s,id)){s.bodyDataReady=true;s.message=bodyWaiting(s);return;}
    delete s.naturalCloseout;
    s.completedResultRevision=s.results[id].revision;
    if(gripRetest){s.trials.grip.push(...gripRetest);s.gripRetest=null;}
    if(id==='grip'&&!s.acq.partial&&s.receiptReturn?.pendingTest===id)s.receiptReturn=null;
    s.acq=null;s.stop=null;s.previewResult=null;
    if(s.walk?.directTest===id||!s.results[id].partial)s.skipped=s.skipped.filter(test=>test!==id);
    if(s.mode==='retest'){go(s,gripRetest?'result/grip':s.returnRoute||'result/'+id);}
    else {if(s.walk)advanceWalk(s,id);s.transition=null;go(s,'result/'+id);}
  }
  const bpPressureSamples=[145,138,127,117];
  function restoreBloodPressure(s){
    const a=s.acq;
    if(a?.testId==='bp'&&a.kind!=='group')a.bp??={phase:'connecting',pressure:null,pair:null,samples:0,telemetry:s.bpTelemetry!==false};
  }
  function bpDemoEvent(s){
    const bp=s.acq?.bp;
    if(!bp)return null;
    switch(bp.phase){
      case 'connecting':return {event:'connected',delay:620};
      case 'waiting':return bp.telemetry?{event:'pressure',pressure:bpPressureSamples[0],delay:850}:{event:'measuring',delay:850};
      case 'measuring':
        if(bp.telemetry&&bp.samples<bpPressureSamples.length)return {event:'pressure',pressure:bpPressureSamples[bp.samples],delay:760};
        return {event:'pair',pair:{systolic:121,diastolic:75},delay:bp.telemetry?1100:2800};
      case 'locked':case 'failed-release':return {event:'released',delay:1450};
      case 'saving':return {event:'saved',delay:1120};
      default:return null;
    }
  }
  function bloodPressureEvent(s,payload){
    const a=s.acq,bp=a?.bp,{event}=payload;
    if(!bp||s.stop||s.route!=='measure/bp'||a.id!==payload.acqId||s.user?.id!==payload.participantId)return;
    const collecting=['waiting','measuring'].includes(bp.phase);
    if(event==='connected'&&bp.phase==='connecting'&&s.settings.peripherals.cuff)bp.phase='waiting';
    else if(event==='measuring'&&bp.phase==='waiting')bp.phase='measuring';
    else if(event==='pressure'&&collecting&&bp.telemetry&&Number.isFinite(payload.pressure)&&payload.pressure>=0){
      bp.pressure=payload.pressure;bp.samples++;bp.phase='measuring';
    }else if(event==='pair'&&collecting&&[payload.pair?.systolic,payload.pair?.diastolic].every(v=>Number.isFinite(v)&&v>0)){
      bp.pair=copy(payload.pair);bp.phase='locked';
    }else if(event==='released'&&bp.phase==='locked')bp.phase='saving';
    else if(event==='saved'&&bp.phase==='saving')complete(s);
    else if(event==='save-failed'&&bp.phase==='saving')bp.phase='save-failed';
    else if(event==='retry-save'&&bp.phase==='save-failed')bp.phase='saving';
    else if(event==='no-reading'&&(collecting||bp.phase==='connecting'))bp.phase='failed-release';
    else if(event==='released'&&bp.phase==='failed-release'){
      s.failure={reason:'未取得有效的血压读数。',testId:'bp',confirmed:true};
      s.status.bp=s.results.bp?'done':'failed';s.acq=null;go(s,'recovery');
    }
  }
  function restoreScreen(s){
    const a=s.acq;
    if(!a||!screenFlow.uses(a.testId))return;
    const prior=s.results[a.testId];
    a.screen??=screenFlow.create(a.testId,{
      adjustment:s.profileId==='all'&&!!s.reviewAstigmatismAdjustment,
      examiner:s.profileId==='all'&&s.role==='operator'&&!!s.reviewExaminerVision,
      prior:prior?.partial&&s.mode!=='retest'?prior.screen:null
    });
    return a.screen;
  }
  function accessoryDemoEvent(s){
    const a=s.acq,stream=a?.accessory;
    if(!stream)return null;
    const values=a.testId==='lung'?[465,1219,1890,2575,3012,3200]:
      gripSide(s)==='left'?[8.1,14.9,22.6,28.4,20.6]:[7.6,14,23.9,27.1,16.5];
    if(stream.phase==='settling')return {event:'saved',delay:1250};
    if(stream.samples>=values.length)return {event:'released',delay:680};
    return {event:'sample',value:values[stream.samples],delay:stream.samples?590:1700};
  }
  function accessoryEvent(s,payload){
    const a=s.acq,stream=a?.accessory;
    if(!stream||s.stop||s.route!=='measure/'+a.testId||a.id!==payload.acqId||s.user?.id!==payload.participantId)return;
    if(payload.event==='sample'&&stream.phase!=='settling'&&Number.isFinite(payload.value)&&payload.value>=0){
      stream.live=payload.value;
      stream.peak=Math.max(stream.peak??0,stream.live);
      stream.samples++;
      stream.phase='live';
    }else if(payload.event==='released'&&stream.phase==='live'){
      stream.phase='settling';
    }else if(payload.event==='saved'&&stream.phase==='settling'){
      if(a.testId==='grip'){
        a.view??=gripSide(s);
        saveGripTrial(s,a.view);
      }
      complete(s);
    }
  }
  function completeScreen(s,outcome){
    const id=s.acq.testId;
    if(outcome==='partial'&&s.mode==='retest'&&hasComplete(s,id)){
      // A partial retest cannot replace an existing complete measurement.
      s.acq=null;s.stop=null;s.status[id]='done';
      go(s,s.returnRoute||'result/'+id);
      s.message='本次只完成一眼，仍显示上次的完整结果。';
      return;
    }
    if(outcome==='partial'||outcome==='complete'){
      s.acq.partial=outcome==='partial';
      complete(s);
    }
  }
  function retainScreenEyes(s){
    const a=s.acq,screen=a?.screen;
    if(!screen||!screenFlow.needsPosition(a.testId))return;
    const prior=s.results[a.testId];
    if(prior&&!prior.partial)return;
    if(Object.keys(screen.eyes).length<=Object.keys(prior?.screen?.eyes||{}).length)return;
    a.partial=true;
    saveResult(s,a.testId);
  }
  function screenInput(s,payload){
    const a=s.acq;
    if(!a||s.stop||a.id!==payload.acqId)return;
    const q=restoreScreen(s);
    if(!q||q.seq!==payload.seq)return;
    if(['skip-attempt','end-attempt'].includes(payload.op)){
      const allowed=(q.phase==='switch'&&payload.op==='end-attempt')||['early','miss','no-tap'].includes(q.phase);
      if(s.route!=='recovery'&&!allowed)return;
      retainScreenEyes(s);
      s.acq=null;
      s.failure=null;
      if(!s.results[a.testId])s.status[a.testId]='interrupted';
      const end=payload.op==='end-attempt';
      requestLeave(s,end?'end':skipDestination(s,payload.natural),end?'end':'skip');
      return;
    }
    if(s.route==='measure/'+a.testId)completeScreen(s,screenFlow.input(q,payload.op,payload.value));
  }
  function archive(s){
    if(!s.user||!validCount(s))return;
    const currentReport=s.reports?.current||(s.report&&!s.report.historyId?s.report:null);
    const record={id:'REC-'+Date.now(),participantId:s.user.id,name:s.user.name,date:now(),profileId:s.profileId,revision:s.revision,results:copy(s.results),report:currentReport?copy(currentReport):null,method:'prototype-v01',unit:'metric'};
    s.history.unshift(record);
  }
  function finishSession(s){
    archive(s);const keep={profileId:s.profileId,role:s.role,settings:copy(s.settings),history:copy(s.history),events:copy(s.events),accounts:copy(s.accounts||{})};
    for(const key of Object.keys(s))delete s[key];
    Object.assign(s,fresh(keep.profileId),keep);s.admin=false;go(s,'standby');log(s,'结束本次','公开身份、结果、待处理任务已清除');
  }
  function selectedRecord(s){return s.selectedHistory?s.history.find(h=>h.id===s.selectedHistory):null;}
  function currentReportContext(s){const h=selectedRecord(s);return h?{results:h.results,revision:h.revision,participantId:h.participantId,historyId:h.id}:{results:s.results,revision:s.revision,participantId:s.user?.id,historyId:null};}
  function canMakeCurrentReport(s){
    return mandatoryReady(s)&&!Object.values(s.results).some(record=>record.needsReview);
  }
  function openReport(s){
    const ctx=currentReportContext(s);
    if(!ctx.historyId&&!mandatoryReady(s)){s.message='请先完成体成分测量，再生成报告。';return false;}
    if(!Object.keys(ctx.results).length){s.message='还没有测量结果，暂时无法生成报告。';return false;}
    s.reports??={};
    if(s.report)s.reports[s.report.historyId||'current']=copy(s.report);
    s.report=copy(s.reports[ctx.historyId||'current']||selectedRecord(s)?.report||null);
    if(s.report?.participantId!==ctx.participantId)s.report=null;
    go(s,'report');return true;
  }
  function generateReport(s,template='standard'){
    const ctx=currentReportContext(s);if(!Object.keys(ctx.results).length)return;
    if(!ctx.historyId&&!mandatoryReady(s)){s.message='体成分尚未完成，请完成后再生成报告。';return;}
    if(Object.values(ctx.results).some(r=>r.needsReview)){s.message='个人资料已修改，请重测体成分后再生成报告。原报告会保留。';return;}
    const fields=Object.fromEntries(Object.entries(ctx.results).filter(([id])=>C.isTestVisible(id)));
    s.report={revision:ctx.revision,participantId:ctx.participantId,historyId:ctx.historyId,template,stage:'generating',saved:false,delivery:'pending',stale:false,generatedAt:now(),fields:copy(fields),omissions:ctx.historyId?[]:reportOmissions(s)};
  }
  function reportOmissions(s){
    return scope(s).chosen.filter(id=>!s.results[id]).map(id=>({id,state:s.skipped.includes(id)?'skipped':s.status[id]||'unmeasured'}));
  }
  function endAssessment(s){
    // Ending measurement starts report handoff; it does not clear this participant.
    if(s.privacyLocked||!mandatoryReady(s)){s.assessmentClosing=false;s.selectedHistory=null;go(s,'end');return;}
    if(!s.assessmentClosing){
      s.assessmentReturn=(preparing(s)||s.route.startsWith('result/')||['home','results','recovery',...detailRoutes].includes(s.route))?s.route:'home';
      s.assessmentPreparation=preparing(s)?preparationContext(s):null;
    }
    s.assessmentClosing=true;s.selectedHistory=null;
    if(openReport(s)&&(!s.report||s.report.stale||s.report.revision!==s.revision||JSON.stringify(s.report.omissions)!==JSON.stringify(reportOmissions(s))))generateReport(s,s.report?.template||'standard');
  }
  const groupIds=['body','bp'];
  const terminal=x=>['done','failed','interrupted'].includes(x);
  function groupAvailable(s){return ['parallel','sequential'].includes(s.reviewCombination)&&groupIds.every(id=>allowed(s,id));}
  function canGroup(s,id){return s.useCombination&&groupAvailable(s)&&groupIds.includes(id)&&groupIds.every(x=>s.plan.includes(x)&&!hasComplete(s,x)&&!s.skipped.includes(x));}
  // Result summaries read the current record, never the old acquisition snapshot.
  function groupResultState(s,id){
    if(s.results[id]?.needsReview)return 'needs-review';
    if(s.results[id]?.partial)return 'partial';
    if(hasComplete(s,id))return 'done';
    const status=s.status[id]||s.group?.states[id];
    return ['failed','interrupted','skipped'].includes(status)?status:'unmeasured';
  }
  function prepareGroup(s,resume=false){
    if(!groupAvailable(s)||!groupIds.every(id=>s.plan.includes(id))){s.message='请先选择体成分和血压，并开启一起测量。';return;}
    const missing=groupIds.filter(id=>!hasComplete(s,id));
    if(missing.length<2){s.useCombination=false;if(missing.length)beginWalk(s,missing[0]);else go(s,'group-result');return;}
    s.pendingTest='body';s.pendingMode='group';s.mode='group';
    if(!s.user){go(s,'identity');return;}if(!s.consent){go(s,'consent');return;}
    if(groupIds.some(id=>needsProfile(s,id))){go(s,'profile');return;}
    if(groupIds.some(id=>needsBasics(s,id))){go(s,'prerequisites');return;}
    // Preparation confirmations are deliberate user inputs, never sensor assertions.
    if(!resume||s.group?.phase!=='prepare'||s.group.execution!==s.reviewCombination)s.group={members:[...groupIds],execution:s.reviewCombination,phase:'prepare',ready:{cuff:false,feet:false,handles:false},states:{body:'pending',bp:'pending'},steps:{body:0,bp:0},origin:s.walk?.startId||'body'};
    go(s,'group-prepare');
  }
  function groupDispatch(s,action,p){
    if(action==='review-combination'){
      if(s.acq){s.message='请先停止当前测量，再更换演示条件。';return true;}
      s.reviewCombination=['parallel','sequential'].includes(p.mode)?p.mode:'off';s.useCombination=s.reviewCombination!=='off';
      if(s.route==='group-prepare'){if(groupAvailable(s))prepareGroup(s);else{startTask(s,'body','walk');}}
      return true;
    }
    if(action==='choose-combination'){
      if(s.route==='plan'&&s.planDraft)s.planDraft.useCombination=!!p.value;
      else s.useCombination=!!p.value;
      return true;
    }
    if(action==='prepare-group'){
      if(s.acq)return true;
      if(!groupAvailable(s)||!groupIds.every(id=>s.plan.includes(id))){s.message='请先选择体成分和血压，并开启一起测量。';return true;}
      s.scopeMode='selected';
      const missing=groupIds.filter(id=>!hasComplete(s,id));
      if(missing.length===1){s.useCombination=false;beginWalk(s,missing[0]);s.message='已有结果会保留，只需准备未完成的项目。';return true;}
      if(!missing.length){go(s,'group-result');return true;}
      s.useCombination=true;beginWalk(s,'body','full');return true;
    }
    if(action==='group-independent'){
      if(s.acq)return true;s.useCombination=false;s.group=null;startTask(s,'body','walk');return true;
    }
    if(action==='group-ready'){
      if(s.route==='group-prepare'&&s.group?.phase==='prepare'&&p.id in s.group.ready){s.group.ready[p.id]=!s.group.ready[p.id];}
      return true;
    }
    if(action==='start-group'){
      if(s.acq||s.route!=='group-prepare'||!s.group)return true;
      if(!groupAvailable(s)||!s.user||!s.consent||groupIds.some(id=>!s.plan.includes(id)||needsProfile(s,id)||needsBasics(s,id)||hasComplete(s,id))){s.message='测量条件已改变，请重新确认所选项目。';return true;}
      if(!s.settings.peripherals.cuff){s.message='袖带未连接，请连接后再开始。';return true;}
      if(!Object.values(s.group.ready).every(Boolean)){s.message='请确认已戴好袖带、站稳并握好手柄。';return true;}
      s.group.phase='measure';s.group.states={body:'collecting',bp:s.group.execution==='parallel'?'collecting':'queued'};
      H.begin(s);W.begin(s);
      s.lastStop=null;s.acq={id:++s.acqSerial,kind:'group',testId:'body',step:0,sequence:[0],partial:false};groupIds.forEach(id=>s.status[id]=s.group.states[id]==='collecting'?'measuring':'unmeasured');go(s,'group-measure');return true;
    }
    if(action==='group-event'){
      const g=s.group,id=p.id;
      if(s.route!=='group-measure'||g?.phase!=='measure'||!g.members.includes(id)||g.states[id]!=='collecting')return true;
      if(p.event==='advance'){g.steps[id]=Math.min(g.steps[id]+1,test(id).stages.length-1);return true;}
      if(!['valid','failed'].includes(p.event))return true;
      if(p.event==='valid'){
        if(id==='body'&&(!H.usable(s)||!W.usable(s))){s.bodyDataReady=true;s.message=bodyWaiting(s)+'血压测量不受影响。';return true;}
        const a=s.acq;s.acq={id:a.id,kind:a.kind,testId:id,view:null,partial:false};saveResult(s,id);s.acq=a;g.states[id]='done';
      }
      else {g.states[id]='failed';s.status[id]=s.results[id]?(s.results[id].partial?'partial':'done'):'failed';}
      if(g.execution==='sequential'&&id==='body'&&g.states.bp==='queued'){g.states.bp='collecting';s.status.bp='measuring';}
      if(g.members.every(x=>terminal(g.states[x]))){g.phase='release';log(s,'组合采集已结束','仍等待可放松确认');}
      return true;
    }
    if(action==='group-release'){
      if(s.route!=='group-measure'||s.group?.phase!=='release')return true;
      s.group.phase='result';s.acq=null;s.stop=null;advanceWalk(s,s.group.members[0]);go(s,'group-result');return true;
    }
    if(s.acq?.kind==='group'){
      if(action==='stopped'){
        if(!s.stop?.requested)return true;const x=s.stop;
        for(const id of s.group.members)if(!terminal(s.group.states[id])){s.group.states[id]='interrupted';s.status[id]=s.results[id]?(s.results[id].partial?'partial':'done'):'interrupted';}
        s.lastStop={testId:'group',group:true,view:null,acqId:s.acq.id};s.acq=null;s.stop=null;s.bodyDataReady=false;
        const missing=s.group.members.filter(id=>!hasComplete(s,id));
        if(!missing.length){s.group.phase='result';go(s,'group-result');}
        else if(missing.length===1){s.useCombination=false;s.pendingMode='walk';s.lastStop.testId=missing[0];startTask(s,missing[0],'walk');}
        else{s.group.phase='prepare';s.group.states={body:'pending',bp:'pending'};s.group.steps={body:0,bp:0};go(s,'group-prepare');}
        return true;
      }
      if(action==='stop'){requestLeave(s,'group-prepare','cancel');return true;}
      if(action==='skip'){s.message='请先停止当前测量，再跳过。';return true;}
      if(['advance','fail','retry','partial','start-measure','answer'].includes(action)){s.message='两项测量需分别操作演示控制。';return true;}
    }
    return false;
  }
  function dispatch(s,action,payload={}){
    if(action==='navigate'&&!C.isRouteVisible(payload.page))return s;
    if(['open-test','fill-test','retest','start-measure'].includes(action)&&!C.isTestVisible(payload.id??s.pendingTest))return s;
    H.init(s);W.init(s);
    s.message='';log(s,action,typeof payload==='string'?payload:JSON.stringify(payload));
    // Simulated and future real adapters attach the acquisition identity. Late
    // events cannot finish a stopped attempt or mutate a replacement attempt.
    const deviceEvents=['advance','partial','group-event','group-release','height-event','weight-event','stopped','stop-released','stop-status','stop-timeout','oxygen-release','oxygen-record'];
    if(deviceEvents.includes(action)&&payload.acqId!==undefined&&payload.acqId!==s.acq?.id)return s;
    if(s.stop&&['advance','partial','group-event','group-release','height-event','weight-event','answer','screen-input','retry','retest','fail'].includes(action))return s;
    if(s.privacyLocked&&!['unlock','end','confirm-end','timeout'].includes(action)){s.route='locked';s.message='请先解锁，或退出本次测量。';return s;}
    if(action==='oxygen-release'||action==='oxygen-record'){
      const a=s.acq;
      if(!a||a.testId!=='oxygen'||a.id!==payload.acqId||!s.user||s.user.id!==payload.participantId||s.stop||s.route!=='measure/oxygen')return s;
      if(action==='oxygen-release'){
        const pair=payload.pair;
        if(!a.oxygenPair&&Number.isFinite(pair?.oxygen)&&pair.oxygen>0&&pair.oxygen<=100&&Number.isFinite(pair?.pulse)&&pair.pulse>0)
          a.oxygenPair={oxygen:pair.oxygen,pulse:pair.pulse};
      }else if(a.oxygenPair){complete(s);}
      return s;
    }
    if(action==='bp-event'){bloodPressureEvent(s,payload);return s;}
    if(action==='motion-event'){
      const a=s.acq,q=a?.motion;
      if(!q||s.stop||s.route!=='measure/'+a.testId||payload.acqId!==a.id||payload.participantId!==s.user?.id||payload.version!==q.version)return s;
      if(motion.receive(q,payload)&&q.complete)complete(s);
      return s;
    }
    if(s.acq&&['identity','profile','basics','height-edit','height-record'].includes(action)){s.message='测量中无法修改个人资料，请结束测量后再修改。';return s;}
    if(action==='height-event'||action==='weight-event'){
      const accepted=(action==='height-event'?H:W).event(s,payload);
      if(accepted&&payload.event==='valid'&&s.bodyDataReady&&H.usable(s)&&W.usable(s)){
        if(s.acq?.kind==='group')groupDispatch(s,'group-event',{id:'body',event:'valid'});else complete(s);
      }
      return s;
    }
    if(s.acq&&['open-test','fill-test','fill-remaining','append-next','plan','toggle-plan','choose-all','apply-plan','start-plan','prepare-group','choose-combination','continue','continue-natural','retest','metric','history','settings','resume-task'].includes(action)){s.message='测量中无法更换项目，请先完成或停止本项。';return s;}
    if(!s.acq&&s.lastStop&&['select-project','home'].includes(action)){s.mode='walk';s.pendingMode='walk';s.retakeView=null;}
    if(action==='stop-released'){if(s.stop){s.stop.released=true;if(s.stop.confirmed)return dispatch(s,'stopped',{acqId:s.acq.id});}return s;}
    if(action==='stopped'&&s.stop?.requested){s.stop.confirmed=true;if(payload.released)s.stop.released=true;if(s.stop.needsRelease&&!s.stop.released){s.stop.status='releasing';return s;}}
    if(groupDispatch(s,action,payload))return s;
    switch(action){
      case 'start':go(s,s.settings.activated?'home':'setup');break;
      case 'home':case 'preview-home':showOverview(s,payload.direct);break;
      case 'open-direct-project':openDirectProject(s,payload);break;
      case 'preview-project':{
        const {id}=payload;
        if(s.acq){s.message='请先完成或停止当前测量，再切换项目。';break;}
        if(!s.user||!s.consent||s.selectedHistory||singleBodyOnly(s))break;
        if(!allowed(s,id)){s.message='此设备暂未开放该项目。';break;}
        if(preparing(s)&&s.mode==='retest'){s.message='请先完成或取消当前重测。';break;}
        rememberPreparation(s,null,reviewRoutes());
        if(reviewRoutes()&&s.readingReturn?.route==='result/'+id)s.readingReturn=null;
        if(!reviewRoutes()||s.route!=='result/'+id)rememberReading(s,true);
        s.homeProject=id;s.previewResult=null;
        if(!inSessionHome(s))go(s,'home');
        break;
      }
      case 'return-to-preview':{
        if(s.acq||!s.user||!s.consent||s.selectedHistory||singleBodyOnly(s))break;
        if(reviewRoutes()&&!viewedFromPreview(s))break;
        const id=reviewRoutes()?s.previewResult:payload.id||s.previewResult;
        const route=reviewRoutes()&&s.previewResultRoute==='results'?'results':'home';
        if(payload.direct)s.homeProject=null;
        else if(id&&allowed(s,id))s.homeProject=id;
        s.previewResult=null;
        s.previewResultRoute=null;
        if(!reviewRoutes())s.readingReturn=null;
        go(s,route);
        break;
      }
      case 'open-test':{
        const id=payload.id;s.selectedHistory=null;s.receiptReturn=null;s.previewResult=null;
        if(s.results[id])go(s,'result/'+id);else beginWalk(s,id);break;
      }
      case 'select-project':{
        const id=payload.id;
        if(s.acq){s.message='请先完成或停止当前测量，再切换项目。';break;}
        if(!allowed(s,id)){s.message='此设备暂未开放该项目。';break;}
        if(s.mode==='retest'&&(s.route.startsWith('prepare/')||s.route==='prerequisites')){s.message='请先完成或取消当前重测。';break;}
        if(s.route==='prepare/'+id||(s.route==='group-prepare'&&s.group?.members.includes(id)))break;
        if(s.results[id]){rememberReading(s);dispatch(s,'view-completed',{id});}
        else beginWalk(s,id);
        break;
      }
      case 'view-completed':{
        const id=payload.id;
        if(s.acq){s.message='请先完成或停止当前测量，再查看其他结果。';break;}
        if(!allowed(s,id)||!s.user||s.results[id]?.participantId!==s.user.id){s.message='这一项还没有测量结果。';break;}
        // Reading never moves the traversal or changes which task is being prepared.
        const fromPreparation=preparing(s,payload.direct);
        if(fromPreparation&&s.mode==='retest'){s.message='请先完成或取消当前重测。';break;}
        if(!s.receiptReturn&&!fromPreparation&&!inSessionHome(s)&&!s.route.startsWith('result/')&&!detailRoutes.includes(s.route)){
          s.message='请从项目导航查看本次结果。';break;
        }
        rememberPreparation(s,fromPreparation?payload.resultViewport:null,false,payload.direct);
        if(reviewRoutes()&&s.route!=='result/'+id&&!s.receiptReturn?.viewport){
          rememberReading(s,true,s.route.startsWith('result/')?payload.resultViewport:null);
        }
        if(inSessionHome(s)){
          s.previewResult=payload.direct||!reviewRoutes()||s.homeProject===id?id:null;
          if(reviewRoutes())s.previewResultRoute=s.previewResult?s.route:null;
          s.homeProject=payload.direct?null:id;
        }
        else if(s.previewResult!==id)s.previewResult=null;
        if(reviewRoutes()&&s.readingReturn?.route==='result/'+id)s.readingReturn=null;
        s.selectedHistory=null;go(s,'result/'+id);break;
      }
      case 'return-to-task':{
        if(s.acq){s.message='请先完成或停止当前测量。';break;}
        const origin=s.receiptReturn;if(!origin)break;
        s.receiptReturn=null;s.selectedHistory=null;s.previewResult=null;s.previewResultRoute=null;
        if(s.readingReturn?.resultBrowser)s.readingReturn=null;
        // Recheck readiness; browsing results must not bypass a disconnected accessory.
        restorePreparation(s,origin);
        break;
      }
      case 'fill-test':{
        const id=payload.id;
        if(hasComplete(s,id)){s.selectedHistory=null;go(s,'result/'+id);}else beginWalk(s,id);
        break;
      }
      case 'fill-remaining':{
        const id=scope(s).missing[0];
        if(id)beginWalk(s,id);else go(s,'results');
        break;
      }
      case 'append-next':{const id=suggestedNext(s);if(id)beginWalk(s,id);break;}
      case 'return-reading':{
        if(!s.acq&&s.readingReturn){
          const {resultBrowser,...origin}=copy(s.readingReturn);
          Object.assign(s,origin);
          s.readingReturn=resultBrowser?.previous??null;
        }
        break;
      }
      case 'edit-identity':
        if(!s.acq&&!validCount(s)&&s.user&&['consent','profile'].includes(s.route)){
          s.identityOrigin=s.route;go(s,'identity');
        }
        break;
      case 'cancel-identity-edit':
        if(s.route==='identity'&&s.identityOrigin){const original=s.identityOrigin;s.identityOrigin=null;go(s,original);}
        break;
      case 'identity':{
        const id=String(payload.id||'').trim();if(!id){s.message='请输入会员编号，或扫码登录。';break;}
        if(s.user&&s.user.id!==id&&validCount(s)){s.message='请先结束本次测量，再切换账号。';break;}
        if(s.user?.id!==id){
          s.basics={age:'',sex:'',height:null,weight:null};s.clinical=null;
          H.login(s,id);s.weight={record:null,status:'idle',attempt:null};
        }
        s.identityOrigin=null;
        s.user={id,name:payload.name||'演示受测者'};s.consent=false;go(s,'consent');break;
      }
      case 'consent':
        if(payload.agree){s.consent=true;resumePending(s);}
        else{s.consent=false;s.message='尚未开始测量。可重新确认，或退出本次测量。';}
        break;
      case 'profile':{
        if(!payload.sex||!(Number(payload.age)>0)){s.message='请选择性别，并填写大于 0 的年龄。';break;}
        if(payload.height!==undefined&&(H.automatic(s)||!H.number(payload.height))){s.message='请填写大于 0 的身高（cm）。';break;}
        if(payload.height!==undefined)H.manual(s,payload.height);
        s.basics={...s.basics,sex:payload.sex,age:Number(payload.age)};resumePending(s);break;
      }
      case 'basics':{
        if(H.required(s,s.pendingTest)&&!H.number(payload.height)){s.message='请填写大于 0 的身高（cm）。';break;}
        if(payload.height!==undefined&&!H.automatic(s))H.manual(s,payload.height);
        resumePending(s);break;
      }
      case 'height-record':if(s.user){s.heightReturn=s.route;go(s,'height-record');}break;
      case 'height-back':go(s,s.heightReturn||'home');break;
      case 'height-edit':{
        if(!s.user||H.automatic(s)||!s.admin){s.message='修改已保存的身高需联系工作人员；自动测得的身高请重新测量。';break;}
        if(!H.number(payload.height)){s.message='请填写大于 0 的身高（cm）。';break;}
        if(Number(payload.height)!==H.adopted(s)?.value){H.manual(s,payload.height);H.invalidate(s);s.revision++;s.message='身高已修改，请重测体成分。原结果、原报告和历史记录会保留。';}
        break;
      }
      case 'plan':{
        const fromSettings=s.route==='settings';
        go(s,'plan');
        if(s.route==='plan')s.planDraft={ids:activeIds(s).filter(id=>id==='body'||s.plan.includes(id)),useCombination:!!s.useCombination,fromSettings};
        break;
      }
      case 'cancel-plan':
        if(s.route==='plan'&&s.planDraft?.fromSettings){
          delete s.planDraft;
          go(s,'settings');
        }
        break;
      case 'choose-all':
        if(s.route==='plan'&&s.planDraft)s.planDraft.ids=activeIds(s);
        break;
      case 'toggle-plan':{
        const id=payload.id,draft=s.planDraft;
        if(s.route!=='plan'||!draft||!allowed(s,id))break;
        if(id==='body'){s.message='体成分是必测项目，无法取消。';break;}
        if(draft.ids.includes(id))draft.ids=draft.ids.filter(testId=>testId!==id);
        else draft.ids.push(id);
        break;
      }
      case 'apply-plan':
      case 'start-plan':{
        const draft=s.route==='plan'?s.planDraft:null;
        if(action==='apply-plan'&&!draft)break;
        if(draft){
          s.plan=draft.ids;
          s.useCombination=draft.useCombination&&draft.ids.includes('bp');
          delete s.planDraft;
        }
        normalizePlan(s);
        if(!s.plan.length){s.message='请至少选择一项。';break;}
        delete s.naturalCloseout;
        s.scopeMode='selected';
        if(action==='apply-plan'){
          s.walk=null;
          if(draft.fromSettings)go(s,'settings');
          else{
            s.homeProject=null;
            go(s,'home');
          }
          break;
        }
        const id=s.plan.find(x=>!hasComplete(s,x)&&!s.skipped.includes(x));
        if(id)beginWalk(s,id,'full');else go(s,'results');
        break;
      }
      case 'continue':continueWalk(s);break;
      case 'continue-natural':continueNatural(s,{expected:payload.id});break;
      case 'prepare-planned-test':preparePlannedTest(s,payload.id,payload.direct);break;
      case 'resume-task':
        s.connectionTask=null;
        if(s.pendingTest)startTask(s,s.pendingTest,s.pendingMode);
        break;
      case 'check-connection':{
        const device=test(s.pendingTest)?.peripheral;
        if(device&&!s.acq&&s.user&&s.consent&&preparing(s)){
          s.connectionTask={device,origin:s.route};go(s,'peripherals');
        }
        break;
      }
      case 'back-to-connection-task':
        if(s.connectionTask){const {origin}=s.connectionTask;s.connectionTask=null;go(s,origin);}
        break;
      case 'local-side':if(!s.acq&&s.route==='prepare/grip'&&['left','right'].includes(payload.side)){s.localTasks??={};s.localTasks.grip=payload.side;s.retakeView=payload.side;s.lastStop=null;}break;
      case 'grip-result-side':
        if(!s.acq&&s.route==='result/grip'&&hasComplete(s,'grip')&&['left','right'].includes(payload.side))
          (s.localTasks??={}).gripResultSide=payload.side;
        break;
      case 'start-grip-hand':{
        const record=s.results.grip,view=payload.view;
        const fromPreview=inSessionHome(s)&&s.homeProject==='grip';
        if(s.acq||!s.user||!s.consent||s.privacyLocked||s.selectedHistory||record?.participantId!==s.user.id||
          !['left','right'].includes(view)||!record.values.some(v=>Number.isFinite(v.value)))break;
        if(s.route!=='result/grip'&&(!fromPreview||view!==gripMissingSide(record)))break;
        s.gripRetest=null;
        // Reuse the normal device check and the single-side start without rendering another guide.
        startTask(s,'grip','retest','result/grip',view);
        if(s.route==='prepare/grip'){
          dispatch(s,'start-measure',{id:'grip',view});
          if(s.acq?.testId==='grip')s.acq.stopReturn='result/grip';
        }
        break;
      }
      case 'screen-position':if(!s.acq&&screenFlow.needsPosition(payload.id)&&s.route==='prepare/'+payload.id)s.localTasks.screenPosition=payload.id;break;
      case 'screen-input':screenInput(s,payload);break;
      case 'start-measure':{
        const id=payload.id||s.pendingTest;
        if(s.acq){s.message='测量仍在进行，请先完成或停止本项。';break;}
        if(!allowed(s,id)){s.pendingTest=id;go(s,'unavailable');break;}
        if(id!=='body'&&!mandatoryReady(s)){beginWalk(s,id);break;}
        if(hasComplete(s,id)&&!(s.mode==='retest'&&s.pendingTest===id)){
          go(s,'result/'+id);s.message='这一项已有结果，如需更新，请点击“重新测量”。';break;
        }
        const t=test(id);if(!s.user||!s.consent||needsProfile(s,id)||needsBasics(s,id)||(t.peripheral&&!s.settings.peripherals[t.peripheral])){startTask(s,id,s.mode);break;}
        const view=payload.view||s.retakeView||(id==='grip'&&!s.gripRetest?s.localTasks?.grip:null)||null;
        if(id==='grip'&&s.gripRetest&&(!['left','right'].includes(view)||s.gripRetest[0]?.side===view)){
          s.message='请选择本次要测的手。';break;
        }
        const scopes={posture:{front:[0,1,4],side:[2,3,4]},shoulder:{lf:[0],rf:[1],la:[2],ra:[3]},grip:{left:[0,1],right:[2,3]}};
        const sequence=scopes[id]?.[view]||(id==='posture'&&s.localTasks?.postureFirst==='side'?[2,3,0,1,4]:id==='shoulder'?[2,0,3,1]:t.stages.map((_,i)=>i));
        // Opening an optional preparation is a preview of its instructions. Start adopts it into the plan.
        if(s.walk?.directTest===id&&!s.plan.includes(id))s.plan=activeIds(s).filter(testId=>testId===id||s.plan.includes(testId));
        if(id==='body'){H.begin(s);W.begin(s);}
        s.lastStop=null;s.pendingTest=id;s.acq={id:++s.acqSerial,testId:id,step:sequence[0],sequence,priorStatus:s.status[id]||'unmeasured',view,partial:false};
        if(id==='bp')restoreBloodPressure(s);
        if(id==='posture'){
          const requiresDetection=payload.postureDetection===true;
          s.acq.pose={view:sequence[0]===2?'side':'front',started:requiresDetection?null:Date.now(),
            waiting:false,requiresDetection,detecting:requiresDetection};
        }
        if(id==='rope')s.acq.ropeStartedAt=Date.now();
        if(['lung','grip'].includes(id))s.acq.accessory={phase:'waiting',samples:0,live:null,peak:null};
        if(motion?.uses(id))s.acq.motion=motion.create(id,sequence);
        if(screenFlow.uses(id)){restoreScreen(s);s.localTasks.screenPosition=null;}
        s.retakeView=null;s.status[id]='measuring';go(s,'measure/'+id);break;
      }
      case 'motion-retry':
        if(s.acq?.motion&&!s.stop&&s.route==='measure/'+s.acq.testId)motion.tryAgain(s.acq.motion);
        break;
      case 'motion-partial':
        if(s.acq?.motion&&!s.stop&&s.route==='measure/shoulder'&&motion.finishPartial(s.acq.motion))complete(s);
        break;
      case 'accessory-event':accessoryEvent(s,payload);break;
      case 'rope-record':{
        const a=s.acq;
        if(a?.testId!=='rope'||s.route!=='measure/rope'||s.stop||payload.acqId!==a.id||payload.participantId!==s.user?.id)break;
        if(!Number.isInteger(payload.count)||payload.count<0||!Number.isFinite(payload.duration)||payload.duration<=0)break;
        a.ropeRecord={count:payload.count,duration:payload.duration};complete(s);break;
      }
      case 'posture-first':
        if(!s.acq&&!s.retakeView&&s.route==='prepare/posture'&&['front','side'].includes(payload.view))(s.localTasks??={}).postureFirst=payload.view;
        break;
      case 'posture-start-view':
        if(s.acq?.pose?.waiting&&!s.stop&&s.route==='measure/posture'){
          const pose=s.acq.pose;
          pose.waiting=false;pose.detecting=!!pose.requiresDetection;
          pose.started=pose.detecting?null:Date.now();
        }
        break;
      case 'posture-detected':{
        const a=s.acq,pose=a?.pose;
        if(a?.testId!=='posture'||s.route!=='measure/posture'||s.stop||!pose?.detecting||
           payload.acqId!==a.id||payload.participantId!==s.user?.id||payload.view!==pose.view)break;
        pose.detecting=false;
        pose.started=Date.now();
        break;
      }
      case 'posture-retake-view':{
        const a=s.acq,pose=a?.pose;
        if(!pose||s.stop||s.route!=='measure/posture'||pose.waiting||pose.detecting)break;
        a.id=++s.acqSerial;a.step=pose.view==='side'?2:0;
        pose.detecting=!!pose.requiresDetection;pose.started=pose.detecting?null:Date.now();
        break;
      }
      case 'posture-finish-view':{
        const a=s.acq,pose=a?.pose;
        if(!pose?.waiting||s.stop||s.route!=='measure/posture')break;
        a.view=pose.view==='side'?'front':'side';a.partial=!s.results.posture?.views?.[pose.view];
        complete(s);
        break;
      }
      case 'posture-retry':{
        const failure=s.failure;
        if(s.route!=='recovery'||failure?.testId!=='posture'||failure.confirmed===false)break;
        s.failure=null;startTask(s,'posture',s.mode,s.returnRoute,failure.view);
        break;
      }
      case 'advance':{
        if(!s.acq||s.acq.testId==='oxygen'||s.route==='stop'||s.route==='recovery')break;
        if(s.acq.bp){
          const next=bpDemoEvent(s);
          if(next)bloodPressureEvent(s,{...next,acqId:s.acq.id,participantId:s.user.id});
          break;
        }
        const screen=restoreScreen(s);
        if(screen){if(payload.acqId===undefined)completeScreen(s,screenFlow.sampleStep(screen));break;}
        const t=test(s.acq.testId),pose=s.acq.pose;
        if(pose?.detecting||pose?.waiting&&(pose.requiresDetection||payload.acqId!==undefined))break;
        if(s.acq.testId==='grip'&&[1,3].includes(s.acq.step)){saveGripTrial(s,s.acq.step===1?'left':'right');s.localTasks.grip=s.acq.step===1?'right':'left';}
        const sequence=s.acq.sequence||t.stages.map((_,i)=>i),position=sequence.indexOf(s.acq.step);
        if(position<sequence.length-1){
          s.acq.step=sequence[position+1];
          if(pose&&[0,2].includes(s.acq.step)){
            pose.captured=pose.view;
            pose.view=s.acq.step===2?'side':'front';
            pose.waiting=true;pose.started=null;
          }
        }
        else complete(s);
        break;
      }
      case 'partial':if(s.acq&&!['bp','oxygen'].includes(s.acq.testId)&&!s.acq.screen&&!s.acq.pose?.detecting){s.acq.partial=true;complete(s);}break;
      case 'stop':requestLeave(s,'prepare/'+s.pendingTest,'cancel');break;
      case 'skip-stopped':{
        if(s.acq||!s.lastStop)break;
        const id=s.pendingTest;s.mode='walk';s.pendingMode='walk';s.retakeView=null;s.receiptReturn=null;s.readingReturn=null;
        if(hasComplete(s,id)){
          advanceWalk(s,id);
          requestLeave(s,payload.natural&&reviewRoutes()?'next-natural':'next','confirmed');
        }else requestLeave(s,skipDestination(s,payload.natural),'skip');
        break;
      }
      case 'skip':requestLeave(s,skipDestination(s,payload.natural),'skip');break;
      case 'request-stop':if(!s.stop&&s.acq)requestLeave(s,'prepare/'+s.pendingTest,'cancel');break;
      case 'cancel-stop':break; // A stop already accepted is not an undo/resume promise.
      case 'stop-status':if(s.stop&&payload.status==='releasing'&&s.stop.needsRelease&&s.acq?.testId!=='oxygen')s.stop.status='releasing';break;
      case 'stop-timeout':if(s.stop)s.stop.status='unconfirmed';break;
      case 'retry-stop':if(s.stop&&s.stop.status==='unconfirmed')s.stop.status='requested';break;
      case 'stopped':{
        if(!s.stop?.requested)break;
        const x=s.stop,id=s.acq?.testId;
        retainScreenEyes(s);
        const view=id==='grip'?gripSide(s):s.acq?.view||null;
        s.lastStop={testId:id,view,acqId:s.acq?.id};s.retakeView=view;
        if(id==='grip')s.localTasks.grip=view;
        if(id)s.status[id]=s.results[id]?(s.results[id].partial?'partial':'done'):(x.kind==='skip'?'skipped':'interrupted');
        s.acq=null;s.stop=null;s.failure=null;s.bodyDataReady=false;
        if(x.kind==='skip'&&id){
          if(!s.results[id])s.status[id]='skipped';
          if(s.mode!=='retest'){if(!s.skipped.includes(id))s.skipped.push(id);advanceWalk(s,id);}
        }
        requestLeave(s,x.target,'confirmed');break;
      }
      case 'fail':{
        const a=s.acq;
        if(!a){s.service.error=payload.reason||'模拟失败';break;}
        if(a.bp){bloodPressureEvent(s,{event:'no-reading',acqId:a.id,participantId:s.user.id});break;}
        if(a.testId==='grip'&&(a.stopReturn||s.gripRetest))s.retakeView=a.view;
        const confirmed=payload.confirmed!==false&&(a.testId!=='scan360'||a.motion?.phase==='release');
        s.failure={reason:payload.reason||'采集失败',testId:a.testId,step:a.step,confirmed,...(a.pose?{view:a.pose.view}:{})};
        if(confirmed&&!a.screen&&a.kind!=='group'){
          if(a.pose?.captured&&!s.results.posture?.views?.[a.pose.captured]){
            a.view=a.pose.captured;saveResult(s,'posture');
          }
          s.status[a.testId]=s.results[a.testId]?(s.results[a.testId].partial?'partial':'done'):'failed';
          s.acq=null;s.bodyDataReady=false;
        }
        go(s,'recovery');
        break;
      }
      case 'retry':{
        if(s.acq&&s.failure?.confirmed===false){s.message='请先停止本次测量，等待设备确认。';break;}
        const id=s.failure?.testId||s.pendingTest;
        retainScreenEyes(s);
        s.acq=null;s.failure=null;s.status[id]=s.results[id]?(s.results[id].partial?'partial':'done'):'unmeasured';startTask(s,id,s.mode);break;
      }
      case 'retest':{
        const id=payload.id;
        let view=payload.view||null;
        s.returnRoute=payload.returnRoute||s.route;s.retakeView=null;
        if(id==='grip'){
          s.gripRetest=!view&&hasComplete(s,id)&&s.results.grip.participantId===s.user?.id?[]:null;
          if(s.gripRetest){s.lastStop=null;view='left';}
        }
        startTask(s,id,'retest',s.returnRoute,view);break;
      }
      case 'results':requestLeave(s,'results','results');s.selectedHistory=null;break;
      case 'metric':s.selectedMetric=payload.id;go(s,'metric');break;
      case 'view':s.selectedView=payload.view;break;
      case 'privacy':s.faceHidden=!s.faceHidden;break;
      case 'overlay':s.overlays[payload.id]=!s.overlays[payload.id];break;
      case 'history':if(!['history','history-record','compare'].includes(s.route))s.historyReturn=copy({route:s.route,selectedMetric:s.selectedMetric,selectedView:s.selectedView});s.selectedHistory=null;s.historyQuery=s.user?.id||'';go(s,'history');break;
      case 'return-history':if(!s.acq){const origin=s.historyReturn||{route:'home'};s.selectedHistory=null;Object.assign(s,copy(origin));s.historyReturn=null;}break;
      case 'history-query':if(s.admin||payload.id===s.user?.id){s.historyQuery=payload.id;}else s.message='查看他人记录需要工作人员授权。';break;
      case 'record':{const h=s.history.find(h=>h.id===payload.id);if(h&&(s.admin||h.participantId===s.user?.id)){s.selectedHistory=payload.id;go(s,'history-record');}else s.message='无法查看这条记录，请联系工作人员。';break;}
      case 'seed-history':{
        const user=s.user||{id:'DEMO-001',name:'演示受测者'};if(!s.user){s.user=user;s.consent=true;}
        if(s.history.some(h=>h.id==='H-DEMO-'+user.id+'-1'))break;
        s.historyQuery=user.id;
        for(let i=1;i<=2;i++){s.history.push({id:'H-DEMO-'+user.id+'-'+i,participantId:user.id,name:user.name,date:i===1?'2026-10-10T09:00:00Z':'2026-11-01T09:00:00Z',profileId:s.profileId,revision:1,method:'prototype-v01',unit:'metric',results:{body:{testId:'body',participantId:user.id,values:copy(C.bodyMetrics).map(v=>({...v,value:v.id==='weight'?70-i:v.value})),sample:true,revision:1,at:i===1?'2026-10-10':'2026-11-01'}},report:null});}break;
      }
      case 'report':{
        if(s.acq){s.message='请先完成或停止当前测量。';break;}
        if(s.selectedHistory||s.assessmentClosing)openReport(s);else endAssessment(s);
        break;
      }
      case 'generate-report':{
        if(s.acq||(!s.selectedHistory&&!s.assessmentClosing)){s.message='结束本次测量后即可生成报告。';break;}
        generateReport(s,payload.template||'standard');break;
      }
      case 'report-generated':if(s.report)s.report.stage='generated';break;
      case 'report-save':if(s.report&&s.report.stage==='generated'){s.report.saved=true;s.report.stage='saved';}break;
      case 'report-fail':if(s.report){s.report.stage=payload.stage||'generation-failed';s.report.saved=false;}break;
      case 'report-retry':if(s.report)s.report.stage=s.report.stage==='save-failed'?'generated':'generating';break;
      case 'delivery':if((s.report?.historyId||mandatoryReady(s))&&s.report?.saved&&!s.report.stale)go(s,'delivery');else s.message='报告尚未保存或已有更新，请返回报告页处理后再领取。';break;
      case 'deliver':if(s.report?.saved&&!s.report.stale)s.report.delivery=payload.kind==='print'?'printing':'code-ready';break;
      case 'delivered':if(s.report?.saved&&!s.report.stale&&['printing','code-ready'].includes(s.report.delivery))s.report.delivery='received';break;
      case 'delivery-fail':if(s.report)s.report.delivery=payload.kind==='print'?'print-failed':'code-expired';break;
      case 'report-page':s.reportPage=Math.max(0,Math.min(2,s.reportPage+payload.delta));break;
      case 'report-zoom':s.reportZoom=s.reportZoom===1?1.4:1;break;
      case 'end':requestLeave(s,'end','end');break;
      case 'resume-assessment':
        if(!s.acq){
          s.selectedHistory=null;s.assessmentClosing=false;
          const task=s.assessmentPreparation;
          s.assessmentPreparation=null;
          if(task)restorePreparation(s,task);else go(s,s.assessmentReturn||'home');
        }
        break;
      case 'exit-session':if(!s.acq)go(s,'end');break;
      case 'finish-session':
        if(!s.acq&&mandatoryReady(s)&&s.assessmentClosing&&s.report?.saved&&!s.report.stale&&!s.report.historyId)finishSession(s);
        else s.message='报告尚未保存，可返回重试或退出。';
        break;
      case 'confirm-end':if(!s.acq)finishSession(s);break;
      case 'settings':
        if(s.acq){s.message='请先完成或停止当前测量，再打开设置。';break;}
        if(s.route==='settings')break;
        if(!s.settingsOrigin)s.settingsOrigin=s.route;
        go(s,'settings');break;
      case 'admin':s.admin=true;log(s,'原型权限模拟','非真实账号验证');break;
      case 'manager-page':if(!s.admin){go(s,'settings');s.message='此操作需要管理员授权。';}else go(s,payload.page);break;
      case 'manager-back':{const origin=s.settingsOrigin||'standby';s.settingsOrigin=null;go(s,origin);break;}
      case 'network':s.settings.network=payload.value;s.service.network=payload.value==='online'?'已连接':'离线';break;
      case 'network-back':{const origin=s.networkOrigin||'settings';s.networkOrigin=null;go(s,origin);break;}
      case 'connect':
        if(s.route==='peripherals'&&s.connectionTask&&(payload.id!==s.connectionTask.device||payload.value===false))break;
        if(s.route==='peripherals'&&!s.connectionTask&&!s.admin)break;
        if(payload.id in s.settings.peripherals){s.settings.peripherals[payload.id]=payload.value!==false;s.service.peripheral=payload.value===false?'已断开':'连接成功（模拟）';}
        break;
      case 'toggle-service':if(payload.id==='body'){s.message='体成分是必测项目，无法关闭。';break;}if(!s.admin){s.message='此操作需要管理员授权。';break;}if(validCount(s)||s.acq||s.plan.length){s.message='请先结束本次测量，再更改可用项目。';break;}if(profile(s.profileId).tests.includes(payload.id)){const a=s.settings.enabled;s.settings.enabled=a.includes(payload.id)?a.filter(x=>x!==payload.id):a.concat(payload.id);}break;
      case 'language':s.settings.language=payload.language||s.settings.language;s.settings.unit=payload.unit||s.settings.unit;s.service.language='设置已保存。本演示暂不切换语言或换算单位。';break;
      case 'calibration':if(validCount(s)||s.acq){s.message='已有测量数据，请结束本次测量后再校准。';break;}s.settings.calibration.tare=Number(payload.tare)||0;s.settings.height=payload.height||s.settings.height;s.service.calibration='设置已保存（演示），未校准真实设备。';break;
      case 'setup-next':s.setupStep=Math.min(2,s.setupStep+1);break;
      case 'activate':s.settings.activated=true;s.service.activation='已激活（模拟）';go(s,'standby');break;
      case 'service':if(s.admin){s.service[payload.key]=payload.value;}else s.message='此操作需要管理员授权。';break;
      case 'lock-now':case 'timeout':
        if(s.acq){s.message='请先完成或停止当前测量。';break;}
        if(s.privacyLocked)break;
        s.lockOrigin={route:s.route,admin:s.admin};s.admin=false;s.privacyLocked=true;go(s,'locked');break;
      case 'unlock':{
        const origin=s.lockOrigin;s.lockOrigin=null;s.admin=!!origin?.admin;s.privacyLocked=false;go(s,origin?.route||s.returnRoute||'standby');break;
      }
      case 'reset-device':if(s.user||s.acq||validCount(s)){s.message='请先退出本次测量，再重置演示设置。';break;}if(s.admin&&payload.confirmed){s.settings.activated=false;s.service.reset='模拟完成；数据范围仍需正式规则';s.settingsOrigin=null;s.setupStep=0;go(s,'setup');}break;
      case 'clinical':s.clinical={name:payload.name||'',bed:payload.bed||'',admission:payload.admission||''};go(s,'home');break;
      case 'answer':if(s.acq&&!s.acq.screen){(s.acq.answers??=[]).push({step:s.acq.step,value:payload.value});}break;
      case 'navigate':
        if(s.acq&&payload.page!==s.route){requestLeave(s,payload.page,'navigate');break;}
        if(payload.page==='peripherals'&&!s.admin&&!s.connectionTask){s.message='请由工作人员打开配件设置。';break;}
        if(payload.page==='network'&&s.route!=='network')s.networkOrigin=s.route;
        go(s,payload.page);break;
      default:throw new Error('Unknown action: '+action);
    }
    if(s.report){s.reports??={};s.reports[s.report.historyId||'current']=copy(s.report);}
    return s;
  }
  root.ANOVATOR_ENGINE={fresh,dispatch,activeIds,singleBodyOnly,allowed,remaining,next,nextAfter,naturalNext,outstanding,hasComplete,completedIds,completeCount,validCount,selectedRecord,currentReportContext,canMakeCurrentReport,reportOmissions,test,profile,copy,scope,suggestedNext,groupAvailable,canGroup,groupResultState,mandatoryReady,canSkip,gripSide,gripMissingSide,gripWorkingRecord,restoreScreen,viewedFromPreview,restoreVisibleTasks,restoreBloodPressure,bpDemoEvent,accessoryDemoEvent};
  if(typeof module!=='undefined')module.exports=root.ANOVATOR_ENGINE;
})(globalThis);
