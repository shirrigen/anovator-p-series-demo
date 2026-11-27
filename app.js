(function(){
'use strict';
const C=ANOVATOR_CATALOG,P=ANOVATOR_PAGES,E=ANOVATOR_ENGINE,H=ANOVATOR_HEIGHT,W=ANOVATOR_WEIGHT,ACCOUNT_K='anovator-g01-v04-accounts',FEEDBACK_K='anovator-g01-v04-feedback';
const params=typeof location==='undefined'?null:new URLSearchParams(location.search);
const pagesRelease=window.ANOVATOR_PAGES_RELEASE===true;
const scenario=pagesRelease?null:params?.get('scenario');
const routeReview=window.ANOVATOR_ROUTE_REVIEW===true,h10Footer=!!window.ANOVATOR_FOOTER_H10;
const directNavigation=routeReview&&h10Footer&&(pagesRelease||params?.get('navigation')==='direct');
if(directNavigation)document.documentElement?.classList.add('direct-navigation');
const directMotion=directNavigation?window.ANOVATOR_DIRECT_MOTION:null;
const scenarioSession=['route-review','bp-review','session-progress','layers-review','title-review','recorded-review','examiner-vision',
  'posture-result','shoulder-icon','grip-ready','all-results'].includes(scenario)||directNavigation&&['home-first','home-review'].includes(scenario);
const K=pagesRelease?'anovator-pages-demo-v01':(scenarioSession?'anovator-g01-v06-'+scenario:'anovator-g01-v05')+(directNavigation?'-direct':'');
const SF=ANOVATOR_SCREEN_TEST_FLOW,SUI=ANOVATOR_SCREEN_TEST_UI;
const BODY=window.ANOVATOR_BODY_UI,ENTRY=window.ANOVATOR_ENTRY_UI;
const POSTURE=window.ANOVATOR_POSTURE_UI;
const ROPE=window.ANOVATOR_ROPE_UI;
const ACCESSORY=window.ANOVATOR_ACCESSORY_UI;
const MOTION=window.ANOVATOR_MOTION_UI,MOTION_FLOW=window.ANOVATOR_MOTION_TESTS,MOTION_RUNTIME=window.ANOVATOR_MOTION_RUNTIME;
// Demo-only defaults. Engine data validity and real-device rules stay separate.
const GN=ANOVATOR_GLOBAL_CHROME;let automaticDemo=true,demoDriver=null;
const DEMO=Object.freeze({age:30,sex:'female',height:174,weight:68.4,...window.ANOVATOR_DEMO_PROFILE});
const $=q=>document.querySelector(q),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let state=E.fresh(pagesRelease?'all':undefined),tab='experience',inspect='standby',search='',feedback=[],reviewConfirm=null,storageWarning='';
let projectDirectory=null,receiptScroll=0,homeRailScroll=0,lastHomeProject=null,restoredReading=null;
let restorePreviewFocus=null;
try{const saved=JSON.parse(sessionStorage.getItem(K));if(saved&&C.profiles.some(p=>p.id===saved.profileId))state=saved;}catch{}
if(!pagesRelease){
 try{feedback=JSON.parse(localStorage.getItem(FEEDBACK_K)||'[]');}catch{}
 try{state.accounts=JSON.parse(localStorage.getItem(ACCOUNT_K)||'{}');}catch{storageWarning='本浏览器不能读取演示账号缓存；本次资料仍可使用，跨登录保存需重新验证。';}
}
H.init(state);
E.restoreVisibleTasks(state);
if(directNavigation&&!state.selectedHistory&&state.results.posture){
  if(state.route==='posture-summary')state.route='result/posture';
  if(state.returnRoute==='posture-summary')state.returnRoute='result/posture';
}
if(directNavigation&&state.completedResultRevision==null&&E.hasComplete(state,'body')&&state.results.body.participantId===state.user?.id){
 // Older builds cleared the current result when the user selected another project.
 const body=state.results.body;
 if(body.revision===state.revision&&(state.localTasks?.bodyIntroReady||body.priorRevision!=null))
   state.completedResultRevision=body.revision;
}
if(directNavigation&&state.completedResultRevision===undefined&&state.route.startsWith('result/')){
 // Restore a just-saved result from a session cached before completion was tracked.
 const id=state.route.split('/')[1];
 const revision=state.results[id]?.revision;
 const [saved,entry]=state.events.slice(-2);
 const justSaved=revision!=null&&saved?.event==='有效结果模拟'&&saved.detail===id+' / v'+revision&&
   entry?.event==='页面'&&entry.detail===state.route;
 state.completedResultRevision=justSaved?revision:null;
}
const oxygenHost=typeof window.ANOVATOR_OXYGEN_HOST==='function'?window.ANOVATOR_OXYGEN_HOST({getState:()=>state,E,run,persist,render,automatic:()=>automaticDemo,
  resultControls:routeReview?()=>reviewResultControls('oxygen'):undefined,resultBack:resultFooterBack,
  resultEndGlyph:reviewResultEndGlyph,directEnd:directNavigation,requestEnd:openDirectEnd,resultEndEmphasized}):null;
const oxygenPage=()=>oxygenHost?oxygenHost.isPage(state):/^(prepare|measure|result)\/oxygen$/.test(state.route)&&!!state.user&&!state.selectedHistory&&!state.privacyLocked&&E.allowed(state,'oxygen');
function oxygenScreen(){
 const navigation=directNavigation?GN.navigation(state,E,b,null,true):
   GN.resultBrowser?.(state,E)?resultProgress():GN.navigation(state,E,b);
 const footerClass=usesRecordedResultFooter()?' recorded-footer':'';
 return '<div class="device oxygen-screen'+(directNavigation?' direct-project-rail':'')+footerClass+'">'+GN.header(state,b)+'<article class="device-main oxygen-main" aria-label="血氧与脉率"><div class="oxygen-mount" data-oxygen-mount>'+(oxygenHost?'':'血氧模块未加载，请刷新页面。')+'</div></article><div class="device-bottom">'+navigation+'</div>'+(projectDirectory?renderDirectory():'')+'</div>';
}
const labels={unmeasured:'未测',measuring:'测量中',done:'已完成',partial:'部分完成',skipped:'已跳过',interrupted:'已中断',failed:'需要重测','needs-review':'资料已更新，需重测'};
const b=(text,action,payload={},cls='',disabled=false)=>`<button class="${cls}" data-action="${esc(action)}" data-payload="${esc(JSON.stringify(payload))}" ${disabled?'disabled':''}>${esc(text)}</button>`;
const n=(text,page,cls='')=>b(text,'navigate',{page},cls);
// Historical storage and review pages remain available; participant entry points are deferred.
const historyEntry=()=>C.features.history?b('历史记录','history'):'';
const spec=id=>P.pages.find(p=>p.id===id),t=id=>E.test(id),profile=()=>E.profile(state.profileId);
const badge=(text,cls='')=>`<span class="badge ${cls}">${esc(text)}</span>`;
let productNotes=[],reviewActions='';
const reviewNote=text=>{productNotes.push(text);return '';};
const info=(text,warning=false)=>`<div class="info ${warning?'warning':''}">${esc(text)}</div>`;
const list=items=>`<ul>${items.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`;
const refs=keys=>`<div class="refs">${[...new Set(keys||[])].filter(k=>C.sources[k]).map(k=>`<a href="${esc(C.sources[k].url)}" target="_blank" rel="noopener">${esc(C.sources[k].title)} ↗</a>`).join('')}</div>`;
const status=id=>labels[state.status[id]||'unmeasured'];
const field=(name,label,value='',type='text',extra='')=>`<label>${esc(label)}<input name="${name}" type="${type}" value="${esc(value)}" ${extra}></label>`;
const select=(name,label,items,value)=>`<label>${esc(label)}<select name="${name}">${items.map(([v,l])=>`<option value="${esc(v)}" ${v===value?'selected':''}>${esc(l)}</option>`).join('')}</select></label>`;
const form=(action,fields,submit='保存并继续')=>`<form data-form="${action}" class="form-grid">${fields}<button class="primary" type="submit">${esc(submit)}</button></form>`;
const title=(name,desc)=>`<h1>${esc(name)}</h1>${desc?`<p class="muted">${esc(desc)}</p>`:''}`;
const active=()=>E.activeIds(state),valid=()=>E.validCount(state),singleBody=()=>E.singleBodyOnly(state);
function resetReview(profileId=state.profileId){const accounts=E.copy(state.accounts||{}),role=state.role,history=E.copy(state.history||[]);state=E.fresh(profileId);projectDirectory=null;receiptScroll=0;homeRailScroll=0;lastHomeProject=null;Object.assign(state,{accounts,role,history});H.init(state);}
function heightSummary(record=H.adopted(state),link=true){
 if(!record){if(!state.pendingTest||state.pendingTest!=='body')return '';return `<div class="height-summary"><strong>${H.automatic(state)?'测量时自动获取身高':'请填写身高'}</strong><span>${esc(H.label(H.method(state)))}</span></div>`;}
 return `<div class="height-summary"><div><strong>${esc(record.value)} <small>cm</small></strong><span>${esc(H.label(record.method))}${record.origin==='account'?' · 来自账号资料':record.origin==='measurement'?' · 本次采集':''}</span></div>${link?b('核对资料','height-record',{},'small'):''}</div>`;
}
function requiredFields(){
 if(!t(state.pendingTest)?.needsBasics)return '';
 return (H.required(state,state.pendingTest)?field('height','身高 · cm',DEMO.height,'number','step="0.1" min="0.1" required inputmode="decimal"'):'');
}
function heightRecordPage(){
 const r=H.adopted(state),time=v=>v?new Date(v).toLocaleString('zh-CN'):'—';
 return title('身高记录','用于本次体成分分析。')+heightSummary(r,false)+(r?`<dl class="height-facts"><dt>记录来源</dt><dd>${esc(H.label(r.method))}${r.origin==='account'?' · 来自账号资料':''}</dd><dt>记录时间</dt><dd>${esc(time(r.recordedAt))}</dd><dt>使用时间</dt><dd>${esc(time(r.adoptedAt))}</dd></dl>`:info('还没有身高记录。'))+(H.automatic(state)?info('身高由设备测得，重新测量时会更新。'):state.admin?info('修改后将保存到账号。已有体成分结果需重新测量，历史记录不受影响。',true)+form('height-edit',field('height','身高 · cm',r?.value||'','number','step="0.1" min="0.1" required'),'保存修改'):info('需要修改身高，请联系工作人员。'))+(state.results.body?.needsReview?info('身高已修改，请重测体成分后再生成报告。',true)+b('重测人体成分','retest',{id:'body',returnRoute:'result/body'},'primary'):'')+`<div class="wrap task-actions">${b('返回','height-back')}</div>`;
}
function reviewNotice(){
 return (storageWarning?info(storageWarning,true):'')+(reviewConfirm?`<div class="review-confirm" role="alert" lang="zh-CN"><strong>替换当前虚构会话？</strong><p>当前演示进度将重置。已保存的演示记录和评审反馈会保留。</p>${b('确认','confirm-review',{},'primary')}${b('保留当前','cancel-review')}</div>`:'');
}
function recentAccounts(){
 const ids=Object.keys(state.accounts).map(k=>{try{return JSON.parse(k);}catch{return [];}}).filter(([device])=>device===state.profileId).map(([,id])=>id).slice(-3);
 return ids.length?'<div class="recent-accounts"><p>最近使用的账号</p>'+ids.map(id=>b(id,'identity',{id,name:'演示受测者'},'small')).join('')+'</div>':'';
}
const records=()=>state.history.filter(r=>r.participantId===(state.historyQuery||state.user?.id));
const valuesHTML=(values,clickable=false)=>`<div class="metric-list">${values.map(v=>`<div class="metric"><div>${esc(v.label)}${v.pending?'<small>'+(['postureRisk','colorResult','grade'].includes(v.id)?'未评级':v.id==='model'?'暂无模型':'暂无数据')+'</small>':''}</div><div><strong>${esc(v.pending?'—':v.value)}</strong> <small style="display:inline">${esc(v.unit)}</small></div>${clickable?b('详情','metric',{id:v.id},'small'):''}</div>`).join('')}</div>`;
function scene(label,detail='动作示意'){return `<div class="scene"><div><div class="figure" aria-hidden="true"></div><strong>${esc(label)}</strong><br><small>${esc(detail)}</small></div></div>`;}
function skipAction(id=state.pendingTest){return E.canSkip(state,id)?b(state.mode==='retest'?'取消重测':'跳过','skip'):'';}
function showsBodyIntroduction(){
 return directNavigation&&state.route==='prepare/body'&&state.mode!=='retest'&&
   !state.localTasks?.bodyIntroReady&&!state.results.body&&!state.acqSerial;
}
function directBodyCapture(){
 return directNavigation&&state.route==='measure/body'&&state.acq?.testId==='body';
}
function canFinishDemoCapture(){
 return pagesRelease&&directBodyCapture()&&!state.stop&&!state.privacyLocked&&H.usable(state)&&W.usable(state);
}
function demoRequirementLocked(){
 return !!(state.acq||state.stop||state.assessmentClosing||state.privacyLocked);
}
function continuationHint(id){if(singleBody())return '';if(id==='body'&&!E.mandatoryReady(state)&&state.mode!=='retest')return '<span class="continuation-hint">完成体成分后，可选择其他项目</span>';const next=directNavigation?E.naturalNext(state,id):E.nextAfter(state,id);return state.mode==='retest'?'':`<span class="continuation-hint">${next?'下一项：'+esc(t(next).name):'已到最后一项。可结束测量，或选择其他项目。'}</span>`;}
// Single and combined results share task priorities; ending the session belongs
// to the footer, except for the genuine one-capability terminal flow.
const pairedProjectName='Body composition & blood pressure';
function nextControl(action,target){
 return {action,label:'Next · '+target,caption:'Next',target};
}
function nextProjectControl(id){
 return nextControl('continue',E.canGroup(state,id)?pairedProjectName:projectName(id));
}
function resultSuccessor(id){
 return directNavigation?E.naturalNext(state,id):E.next(state);
}
function returnPreparation(english=false,cls='primary'){
 const origin=state.receiptReturn;
 const id=origin.pendingTest;
 if(routeReview)return b(nextControl('return-to-task',preparationName()).label,'return-to-task',{},cls);
 const name=origin.pendingMode==='group'?(english?'paired':'组合'):english?(projectActionNames[id]||projectName(id)):t(id).name;
 return b(english?'Back to '+name+' prep':'返回'+name+'准备','return-to-task',{},cls);
}
function resultBackAction(english=false){
 if(state.receiptReturn)return returnPreparation(english);
 if(state.readingReturn)return b(english?'Back to '+readingDestination(true):'返回'+readingDestination(),'return-reading',{},'primary');
 if(E.viewedFromPreview(state))return b(english?'Back to preview':'返回项目速览','return-to-preview',{},'primary');
 return '';
}
function readingDestination(english=false){
 const {route,selectedMetric}=state.readingReturn;
 const metric=state.results.body?.values?.find(v=>v.id===selectedMetric)?.label;
 if(routeReview&&route==='metric')return (metric&&window.ANOVATOR_REVIEW_EN?.text(metric))||'body composition result';
 const detail={metric:english?'metric detail':(state.results.body?.values.find(v=>v.id===selectedMetric)?.label||'指标')+'详情',
   health:english?'health analysis':'健康分析',segments:english?'body segments':'身体分部',
   'posture-summary':english?'posture detail':'体态详情','group-result':english?'paired result':'组合结果'};
 const id=route.split('/')[1];
 return id?(english?projectName(id)+' result':t(id).name+'结果'):(detail[route]||(english?'result':'结果'));
}
function preparationName(){
 const origin=state.receiptReturn;
 return origin.pendingMode==='group'?pairedProjectName:projectName(origin.pendingTest);
}
function reviewResultBack(){
 if(!routeReview||state.acq||state.selectedHistory||!state.route.startsWith('result/'))return null;
 const id=state.route.split('/')[1];
 if(directNavigation&&state.completedResultRevision!=null&&state.completedResultRevision===state.results[id]?.revision)return null;
 const taskBack=state.receiptReturn&&{action:'return-to-task',
   label:'Back to '+preparationName()+(state.receiptReturn.route==='recovery'?'':' prep')};
 if(state.receiptReturn?.fromProjectPreview)return taskBack;
 const previewBack=E.viewedFromPreview(state)?{action:'return-to-preview',label:'Back to preview'}:null;
 if(previewBack&&GN.inlineResultLinks)return previewBack;
 if(state.readingReturn?.resultBrowser&&state.readingReturn.route!==state.route)
   return {action:'return-reading',label:'Back to '+readingDestination(true)};
 if(state.receiptReturn&&(GN.resultBrowser?.(state,E)||state.receiptReturn.viewport))return taskBack;
 if(previewBack)return previewBack;
 if(taskBack)return taskBack;
 if(state.readingReturn&&state.readingReturn.route!==state.route)
   return {action:'return-reading',label:'Back to '+readingDestination(true)};
 return null;
}
function resultFooterBack(){
 if(directNavigation)return null;
 const contextualBack=reviewResultBack();
 if(contextualBack)return contextualBack;
 if(GN.resultBrowser?.(state,E)){
   const id=state.route.split('/')[1];
   if(canReadResult(id))return {action:'preview-project',label:'Back to '+projectName(id)+' preview',payload:{id}};
 }
 return null;
}
function usesRecordedResultFooter(context=reviewResultBack()){
 return directNavigation&&!!context&&canReadResult(state.route.split('/')[1]);
}
function reviewResultEndGlyph(){
 if(!directNavigation)return 'end';
 return canEndFromResult()?'end-h08-14':null;
}
function canEndFromResult(){
 if(!directNavigation||state.acq||state.stop||state.privacyLocked||state.selectedHistory||!E.canMakeCurrentReport(state))return false;
 return state.route==='group-result'||state.route.startsWith('result/')&&canReadResult(state.route.split('/')[1]);
}
function resultEndEmphasized(){
 return canEndFromResult()&&!resultSuccessor()&&!state.results[state.route.split('/')[1]]?.partial;
}
function openDirectEnd(source){
 if(!canEndFromResult()||$('.assessment-end-dialog'))return;
 const records=Object.keys(state.results).filter(id=>C.isTestVisible(id)&&canReadResult(id));
 const partial=records.filter(id=>state.results[id].partial);
 const missing=E.reportOmissions(state);
 const proceed=()=>{
   run('end',{});
   render();
   window.scrollTo(0,0);
 };
 if(!partial.length&&!missing.length){proceed();return;}

 const group=(label,names)=>`<section><h3>${label} · ${names.length}</h3><p>${esc(names.join(', '))}</p></section>`;
 const dialog=document.createElement('dialog');
 dialog.className='assessment-end-dialog';
 dialog.lang='en';
 dialog.setAttribute('aria-labelledby','assessment-end-title');
 dialog.innerHTML=`<form method="dialog">
   <h2 id="assessment-end-title">End testing?</h2>
   <p>Your report will include the results recorded so far.</p>
   <div class="assessment-end-summary">
     ${group('Recorded',records.filter(id=>!state.results[id].partial).map(projectName))}
     ${partial.length?group('Partly recorded',partial.map(projectName)):''}
     ${missing.length?group('Without results',missing.map(({id,state:status})=>projectName(id)+(status==='skipped'?' (skipped)':''))):''}
   </div>
   <div class="assessment-end-actions">
     <button value="continue" autofocus>Continue testing</button>
     <button value="end">End</button>
   </div>
 </form>`;
 const device=$('.device');
 const position=()=>{
   const bounds=device.getBoundingClientRect();
   const visibleTop=Math.max(0,bounds.top),visibleBottom=Math.min(window.innerHeight,bounds.bottom);
   dialog.style.setProperty('--end-scale',String(bounds.width/360));
   dialog.style.left=(bounds.left+bounds.width/2)+'px';
   dialog.style.top=((visibleTop+visibleBottom)/2)+'px';
   dialog.style.maxHeight=Math.max(0,visibleBottom-visibleTop-24)+'px';
 };
 const returnRoute=state.route,revision=state.revision,member=state.user.id;
 const lifetime=new AbortController();
 dialog.addEventListener('close',()=>{
   lifetime.abort();
   dialog.remove();
   if(dialog.returnValue==='end'&&state.route===returnRoute&&state.revision===revision&&
      state.user?.id===member&&canEndFromResult())proceed();
   else source?.focus({preventScroll:true});
 },{once:true});
 document.body.append(dialog);
 position();
 dialog.showModal();
 directMotion?.openOverlay(dialog);
 window.addEventListener('resize',position,{signal:lifetime.signal});
 window.addEventListener('scroll',position,{signal:lifetime.signal,passive:true});
}
function reviewResultControls(id,repair=null,retest=id?{action:'retest',label:'Retest',payload:{id}}:null){
 const reading=state.readingReturn;
 const contextualBack=reviewResultBack();
 const back=!directNavigation&&!contextualBack&&reading&&reading.route!==state.route?
   {action:'return-reading',label:'Back to '+readingDestination(true)}:null;
 const record=state.results[id];
 if(record?.partial&&!repair){
   const eye=record.screen?.eyes?(record.screen.eyes.left?'right':'left'):null;
   repair={action:'fill-test',label:eye?'Test '+eye+' eye':'Finish test',payload:{id}};
 }
 const needsBody=!E.mandatoryReady(state);
 const canRetest=repair!==retest&&!(id==='body'&&needsBody);
 const secondary=(canRetest?retest:null)||back;
 const next=resultSuccessor(id);
 if(directNavigation&&!needsBody&&next){
   // Keep the way forward visible on partial results. Posture's local action follows the selected view.
   const local=repair&&(id!=='posture'||!retest)?repair:secondary;
   return {primary:{...nextControl('continue-natural',projectName(next)),payload:{id:next}},secondary:local};
 }
 if(usesRecordedResultFooter(contextualBack)&&record?.partial)
   return {primary:repair,secondary:id==='posture'?secondary:null};
 const previewReadback=contextualBack?.action==='return-to-preview'&&GN.inlineResultLinks;
 if(!directNavigation&&contextualBack&&(previewReadback||GN.resultBrowser?.(state,E)||state.receiptReturn?.viewport||state.readingReturn?.resultBrowser))
   return {primary:repair,secondary};
 if(!directNavigation&&state.receiptReturn&&(!needsBody||state.receiptReturn.pendingTest==='body')){
   const primary=contextualBack?.action==='return-to-task'?repair:nextControl('return-to-task',preparationName());
   return {primary,secondary:(canRetest?retest:null)||(repair!==primary?repair:null)||back};
 }
 const requiredRetry={action:'fill-test',label:'Retest body composition',payload:{id:'body'}};
 const primary=needsBody?(E.canGroup(state,'body')?nextProjectControl('body'):requiredRetry):
   repair||(next&&next!==id?nextProjectControl(next):null);
 return {primary,secondary};
}
function reviewResultButtons(id,repair,retest){
 const {primary,secondary}=reviewResultControls(id,repair,retest);
 return (secondary?b(secondary.label,secondary.action,secondary.payload):'')+
   (primary?b(primary.label,primary.action,primary.payload,'primary'):'');
}
function resultContinuation(){
 const next=E.next(state),suggested=E.suggestedNext(state);
 const back=resultBackAction();
 if(back)return back;
 if(!E.mandatoryReady(state))return b('重测人体成分','fill-test',{id:'body'},'primary');
 if(next){const repair=state.results[next]||['failed','interrupted'].includes(state.status[next]);return repair?b('重测 · '+t(next).name,'fill-test',{id:next},'primary'):b('下一项 · '+t(next).name,'continue',{},'primary');}
 return `<span class="continuation-hint">${E.scope(state).complete?'已选项目已完成':'已到最后一项。可从项目导航选择跳过的项目。'}</span>`+(suggested?`<div class="optional-next"><span><small>还可以测</small><strong>${esc(t(suggested).name)}</strong></span>${b('测量','append-next')}</div>`:b('返回本次测量','return-to-preview',{id:state.route.startsWith('result/')?state.route.split('/')[1]:undefined}));
}
function resultActions(id){
 if(singleBody()){
   const reportReady=directNavigation?canEndFromResult():E.mandatoryReady(state);
   return `<div class="wrap task-actions">${reportReady?b('结束本次测量','end',{},'primary')+b('重新测量','retest',{id}):b('重新测量','retest',{id},'primary')+b('退出本次测量','end')}${historyEntry()}</div>`;
 }
 if(routeReview)return '<div class="wrap task-actions">'+reviewResultButtons(id)+'</div>';
 const repairBody=!E.mandatoryReady(state)&&id==='body'&&!state.receiptReturn&&!state.readingReturn&&!E.viewedFromPreview(state);
 return `<div class="wrap task-actions">${resultContinuation()}${id&&!repairBody?(state.results[id]?.partial?b('继续测量','fill-test',{id}):b('重新测量','retest',{id})):''}</div>`;
}
function resultTile(id){
 const x=t(id),r=state.results[id],complete=E.hasComplete(state,id);
 return `<section class="result-tile ${r?'has-result':'missing-result'}"><div class="task-head"><h3>${esc(x.name)}</h3>${badge(status(id),complete?'ok':r?'warn':'')}</div>${r?`<div class="tile-values">${r.values.slice(0,2).map(v=>`<span>${esc(v.label)}<strong>${esc(v.value)} <small>${esc(v.unit)}</small></strong></span>`).join('')}</div>`:'<div class="blank-value" aria-label="无测量值">—</div>'}<div class="wrap">${r?b('查看结果','open-test',{id},'small'):b('测量此项','fill-test',{id},'small')}${r&&!complete?b('继续测量','fill-test',{id},'small'):''}</div></section>`;
}
function completionReceipt(id,reading=false,currentIds=[id]){
 if(singleBody())return '';
 if(state.acq||(!reading&&state.mode==='retest'))return '';
 const tr=state.transition,ids=E.completedIds(state),latest=tr?.to===id&&state.results[tr.from]?tr.from:active().filter(x=>state.results[x]).sort((a,b)=>state.results[b].revision-state.results[a].revision)[0];
 const compact=active().length<=4;
 if(active().length===1){
   if(reading||!latest)return '<p class="project-single">本次测量 · '+esc(t(id||active()[0]).name)+'</p>';
   return `<div class="completion-receipt"><span>${esc(t(latest).name)} · ${state.results[latest].partial?'已有已完成':'已完成'}${tr?.to===id&&tr.bypassed.length?`<small>${esc(tr.bypassed.map(i=>t(i).name).join('、'))}已完成，无需重复测量</small>`:''}</span>${b('查看','view-completed',{id:latest},'small')}</div>`;
 }
 const sc=E.scope(state);
 return `<section class="completion-receipt ${compact?'receipt-compact':'receipt-many'}" aria-label="测量项目"><div class="receipt-heading"><span aria-live="polite">本次 ${sc.done.length}/${sc.chosen.length} 已完成${sc.optional.length?' · '+sc.optional.length+' 项还可以测':''}</span><div class="receipt-controls" hidden><button data-action="scroll-completed" data-payload='{"direction":-1}' aria-label="查看前面的项目">←</button><button data-action="scroll-completed" data-payload='{"direction":1}' aria-label="查看后面的项目">→</button></div></div><nav class="receipt-list" aria-label="本次项目导航">${active().map(x=>{const complete=E.hasComplete(state,x),partial=state.results[x]?.partial,current=currentIds.includes(x);const label=current&&!reading?(currentIds.length>1?'一起准备':'准备中'):complete?'已完成':partial?'部分完成':state.results[x]?.needsReview?'需重测':!E.mandatoryReady(state)&&x!=='body'?'先完成体成分':state.plan.includes(x)?status(x):'还可以测';return `<button class="receipt-item ${complete?'is-complete':partial?'is-partial':'not-complete'} ${current?'is-current':''}" data-action="select-project" data-payload="${esc(JSON.stringify({id:x}))}" ${current?'aria-current="page"':''}><span class="receipt-light" aria-hidden="true"></span><span>${esc(t(x).name)}<small>${esc(label)}</small></span></button>`;}).join('')}</nav></section>`;
}
function setupReceiptRail(){
 const rail=$('.receipt-list'),controls=$('.receipt-controls');if(!rail||!controls)return;
 const atHome=onHome(),project=state.homeProject||null;
 const update=()=>{
   if(!rail.isConnected)return;
   if(atHome)homeRailScroll=rail.scrollLeft;else receiptScroll=rail.scrollLeft;
   controls.hidden=rail.scrollWidth<=rail.clientWidth+1;
   const buttons=controls.querySelectorAll('button');
   buttons[0].disabled=rail.scrollLeft<2;
   buttons[1].disabled=rail.scrollLeft>=rail.scrollWidth-rail.clientWidth-2;
 };
 rail.scrollLeft=atHome?homeRailScroll:receiptScroll;
 const current=rail.querySelector('[aria-current="page"]');
 if(current&&(!atHome||project!==lastHomeProject)){
   const left=current.offsetLeft,right=left+current.offsetWidth;
   if(left<rail.scrollLeft)rail.scrollLeft=left;
   else if(right>rail.scrollLeft+rail.clientWidth){
     // Start on a snap point that leaves the newly selected item fully in view.
     const minimum=right-rail.clientWidth;
     const anchor=[...rail.children].find(item=>item.offsetLeft>=minimum);
     rail.scrollLeft=anchor?.offsetLeft??left;
   }
 }
 if(atHome)lastHomeProject=project;
 rail.addEventListener('scroll',update,{passive:true});update();
}
function renderTestPage(kind,id){
 const x=t(id);if(!x)return info('未找到该测量项目。',true);
 const a=state.acq,r=state.results[id];
 if(id==='bp'&&(kind!=='result'||r)){
   return renderBloodPressure(kind==='prepare'&&!state.settings.peripherals.cuff?'disconnected':kind);
 }
 if(BODY&&id==='body'&&(kind!=='result'||r)){
   const stage=showsBodyIntroduction()?'intro':kind;
   return BODY.render(state,stage,{b,n,esc,E,record:r,actions:resultActions,skipAction,heightSummary,hideStop:directBodyCapture(),showMore:!directNavigation});
 }
 if(POSTURE&&id==='posture'&&(kind!=='result'||r))return postureUI(kind,r);
 if(ROPE&&id==='rope'&&(kind!=='result'||r))return ROPE.render(state,kind,{b,esc,E,record:r,resultActions});
 if(ACCESSORY?.uses(id)&&(kind!=='result'||r))return accessoryUI(kind,id,r);
 if(MOTION?.uses(id)&&(kind==='prepare'||kind==='measure'&&a?.motion||kind==='result'&&r))return motionUI(kind,id,r);
 const screenReady=kind==='prepare'||kind==='measure'&&a?.screen||kind==='result'&&r;
 if(SF.uses(id)&&screenReady){
   const skip=()=>E.canSkip(state,id)?b(state.mode==='retest'?'Cancel retest':'Skip','skip'):'';
   return SUI.render(state,kind,id,{b,skipAction:skip,resultActions:screenResultActions});
 }
 if(['prepare','measure'].includes(kind))return GN.task(state,kind,id,{E,b,scene,skipAction,reviewNote});
 if(kind==='result'){
   if(!r)return title(x.name+' · 结果')+`<div class="empty">${esc(status(id))} · 还没有测量结果。</div><div class="wrap section">${b('进入测量','open-test',{id},'primary')}${singleBody()?b('返回本次测量','home'):''}</div>`;
   let content=(id==='body'?heightSummary(r.height):'')+(r.needsReview?info('采用资料已更正。以下为原结果，需重新测量后更新。',true):'')+valuesHTML(r.values.slice(0,id==='body'?11:99),id==='body');
   if(id==='body')content+=`<details class="all-fields"><summary>更多指标</summary>${valuesHTML(r.values.slice(11),true)}${reviewNote('完整字段保留在功能层；设备首屏的内容取舍与概览风格继续独立评审。')}</details><div class="page-toc">${n('健康分析','health')}${n('身体分部数据','segments')}</div>`;
   if(id==='grip')content+=GN.records(state,id);
   if(id==='posture'&&!directNavigation)content+=n('查看体态详情','posture-summary','primary');
   if(id==='scan360')content+=scene('三维模型示意','暂无真实模型')+`<div class="wrap">${b('左视','view',{view:'left'})}${b('正视','view',{view:'front'})}${b('右视','view',{view:'right'})}</div><p>当前视角：${esc(({left:'左侧',front:'正面',right:'右侧',side:'侧面'})[state.selectedView]||'正面')}</p>`;
   if(['shoulder','grip'].includes(id))content+=`<div class="wrap">${(id==='grip'?['left','right']:['lf','rf','la','ra']).map(v=>b('重测 · '+({left:'左手',right:'右手',lf:'左前屈',rf:'右前屈',la:'左外展',ra:'右外展'}[v]),'retest',{id,view:v})).join('')}</div>`;
   if(x.attempts)content+=info('本次已测 '+(state.attempts[id]?.length||0)+' 次，当前显示第 '+r.attempt+' 次结果。')+reviewNote('原型展示最近一次有效尝试；正式采用规则仍待确认。');
   return title(x.name+' · 结果','示例数据 · 记录 '+r.revision)+badge(r.needsReview?'资料已更新，需重测':r.partial?'部分完成':'已完成',r.partial||r.needsReview?'warn':'ok')+content+reviewNote('本版不提供临床判读。评价、参照域和数据精度以确认后的字段合同为准。')+resultActions(id);
 }
}
function bloodPressureActions(kind,stage){
 const skip=E.canSkip(state,'bp')?b(state.mode==='retest'?'Cancel retest':'Skip','skip'):'';
 if(kind==='prepare')return skip+b(state.lastStop?.testId==='bp'?'Try again':'Start','start-measure',{id:'bp'},'primary');
 if(stage==='disconnected')return skip+b('Check connection','check-connection',{},'primary');
 if(stage==='no-reading')return skip+b('Try again','retry',{},'primary');
 if(stage==='save-failed')return b('Retry save','bp-device',{event:'retry-save'},'primary');
 if(stage==='stop-unconfirmed')return b('Retry stop','retry-stop',{},'primary');
 if(stage==='stopping')return b('Stopping','stop',{},'stop-action',true);
 if(['connecting','waiting','measuring'].includes(stage))return b('Stop','stop',{},'stop-action');
 if(kind!=='result')return '';
 if(routeReview)return reviewResultButtons('bp');
 const next=E.next(state),extra=E.suggestedNext(state);
 const optional=extra?`<div class="optional-next"><span><small>Optional</small><strong>${esc(projectName(extra))}</strong></span>${b('Add test','append-next')}</div>`:'';
 const forward=resultBackAction(true)||(!E.mandatoryReady(state)?b('Retest · Body composition','fill-test',{id:'body'},'primary'):
   next&&next!=='bp'?b('Next · '+projectName(next),'continue',{},'primary'):optional);
 return b('Retest','retest',{id:'bp'})+forward;
}
function renderBloodPressure(kind){
 const attempt=state.acq?.bp,record=sessionRecord('bp');
 const stopped=state.lastStop?.testId==='bp'&&kind==='prepare';
 const stage=kind==='prepare'?'ready':kind==='result'?'result':kind==='recovery'?'no-reading':kind==='disconnected'?'disconnected':
   state.stop?(state.stop.status==='unconfirmed'?'stop-unconfirmed':'stopping'):attempt?.phase||'connecting';
 const pair=kind==='result'?Object.fromEntries((record?.values||[]).map(v=>[v.id,v.value])):attempt?.pair;
 const validPair=pair&&[pair.systolic,pair.diastolic].every(Number.isFinite);
 const pressure=attempt?.pressure;
 const showPressure=stage==='measuring'&&Number.isFinite(pressure);
 const field=showPressure?Math.max(0,Math.min(1,(pressure-117)/28)):0;
 const statuses={
   connecting:['','Checking connection…'],waiting:['Stay still. Don’t talk.','Waiting for a reading'],
   measuring:['Stay still. Don’t talk.','Measuring'],locked:['Wait for the monitor.','Reading captured'],
   saving:['You can remove the cuff.','Saving reading…'],result:[GN.resultBrowser?.(state,E)&&reviewResultBack()?'Saved result.':'Measurement complete.','Reading recorded'],
   'save-failed':['Measurement complete.','Reading not saved. You can retry.'],
   disconnected:['Check the cuff and monitor connection.','Monitor not connected'],
   'failed-release':['Keep the cuff on.','Waiting for the monitor to finish'],
   'no-reading':[record?'Your previous reading is still saved.':'You can try again when ready.','No valid reading'],
   stopping:['Keep the cuff on.','Waiting for stop confirmation'],
   'stop-unconfirmed':['Keep the cuff on.','Stop not confirmed']
 };
 const content=stage==='ready'?'<div class="bp-ready-copy"><h2>Fit the cuff.</h2><p>Bare upper arm.<br>Cuff at heart level.</p><p>Sit with back and arm supported. Feet flat.</p></div>'+
   '<img class="bp-seat" src="assets/blood-pressure/seated-s09-a-v02.png" alt="Seated with upper-arm cuff, supported back and arm, and feet resting flat">'+
   '<div class="bp-ready-status"><div class="bp-ready-line"><strong class="bp-connected"><span aria-hidden="true">✓</span> Monitor connected</strong>'+
   '<details class="bp-help"><summary>Help</summary><p>Use the seated position shown. Ask staff for help if the monitor does not connect.</p></details></div>'+
   '<p>'+(stopped?'Measurement stopped. Start again when ready.':'Rest 5 minutes, then tap Start.')+'</p></div>':
   (()=>{
     const [hint,status]=statuses[stage]||statuses.connecting;
     const fieldImage='<img class="bp-field" alt="" aria-hidden="true" src="assets/blood-pressure/pressure-field-v1.png">';
     const readout=showPressure?'<div class="bp-live"><h2>Cuff pressure</h2><p class="bp-number"><strong>'+esc(pressure)+'</strong><span>mmHg</span></p></div>':'';
     const scale=validPair?Math.min(.79,137/Math.max(pair.systolic,pair.diastolic)):0;
     const readings=validPair?'<div class="bp-pair">'+[['Systolic',pair.systolic],['Diastolic',pair.diastolic]].map(([name,value])=>
       '<section><h2>'+name+'</h2><p class="bp-number"><strong>'+esc(value)+'</strong><span>mmHg</span></p><span aria-hidden="true" class="bp-pair-line" style="width:'+Math.round(value*scale)+'px"></span></section>').join('')+'</div>':'';
     const explanation=!showPressure&&!validPair?'<p class="bp-focus" role="status">'+esc(status)+'</p>':'<p class="bp-status" role="status">'+esc(status)+'</p>';
     const last=state.stop&&Number.isFinite(pressure)?'<p class="bp-last">Last cuff pressure <strong>'+esc(pressure)+'</strong> mmHg</p>':'';
     return fieldImage+'<p class="bp-hint">'+esc(hint)+'</p>'+readout+readings+explanation+last;
   })();
 const serial=state.acq?.id||record?.acqId||'';
 return '<div class="bp-container"><section class="bp-screen" lang="en" data-bp-stage="'+stage+'" data-bp-id="'+serial+'" data-bp-pressure="'+(pressure??'')+
   '" style="--bp-tension:'+field+'"'+(validPair?' data-bp-pair':'')+(showPressure?' data-bp-live':'')+
   '><h1 class="bp-title"><strong>Blood</strong> pressure</h1>'+content+'</section></div><div class="wrap task-actions">'+bloodPressureActions(kind,stage)+'</div>';
}
function postureUI(kind,record){
 return POSTURE.render(state,kind,{b,n,esc,E,record,resultContinuation,localDetail:GN.localResultDetail?.(state,E),
   hideImageLayers:directNavigation,pagesRelease,
   reviewResultButtons:routeReview?reviewResultButtons:undefined});
}
function accessoryUI(kind,id,record){
 return ACCESSORY.render(state,kind,id,{b,esc,E,record,resultContinuation,resultBackAction,streamlinedGrip:h10Footer,
   reviewResultButtons:routeReview?reviewResultButtons:undefined});
}
function motionUI(kind,id,record){
 return MOTION.render(state,kind,id,{b,esc,E,record,resultContinuation,resultBackAction,reviewResultButtons:routeReview?reviewResultButtons:undefined});
}
function readBloodPressureMotion(){
 const screen=$('.bp-screen[data-bp-id]:has(.bp-field)'),field=screen?.querySelector('.bp-field');
 if(!field||!screen.dataset.bpId||typeof getComputedStyle!=='function'||window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)return null;
 const {transform,opacity,filter}=getComputedStyle(field);
 return {id:screen.dataset.bpId,stage:screen.dataset.bpStage,pressure:screen.dataset.bpPressure,field:{transform,opacity,filter}};
}
function playBloodPressureMotion(previous){
 const screen=$('.bp-screen'),field=screen?.querySelector('.bp-field');
 if(directNavigation&&window.ANOVATOR_DIRECT_VITALS?.pressure(screen,field,previous))return;
 if(!previous||!field?.animate||screen.dataset.bpId!==previous.id)return;
 const changed=previous.stage!==screen.dataset.bpStage||previous.pressure!==screen.dataset.bpPressure;
 if(!changed)return;
 const lock=screen.dataset.bpStage==='locked';
 const {transform,opacity,filter}=getComputedStyle(field);
 field.animate([previous.field,{transform,opacity,filter}],{duration:lock?560:410,easing:'cubic-bezier(.18,.72,.2,1)'});
 if(lock){
   screen.querySelector('.bp-pair')?.animate([{opacity:0,transform:'translateY(10px)',filter:'blur(3px)'},{opacity:1,transform:'none',filter:'none'}],
     {duration:440,delay:170,fill:'backwards',easing:'cubic-bezier(.2,.73,.22,1)'});
 }else if(screen.hasAttribute('data-bp-live')&&previous.pressure===''){
   screen.querySelector('.bp-live')?.animate([{opacity:0,transform:'translateY(5px)'},{opacity:1,transform:'none'}],{duration:230,easing:'ease-out'});
 }
}
function screenResultActions(id){
 const result=state.results[id];
 if(routeReview){
   const retest=result?.partial&&result.screen?.eyes?{action:'retest',label:'Retest both eyes',payload:{id}}:undefined;
   return '<div class="wrap task-actions">'+reviewResultButtons(id,null,retest)+'</div>';
 }
 if(!result?.partial||!result.screen?.eyes)return resultActions(id);
 const eye=result.screen.eyes.left?'right':'left';
 const back=resultBackAction(true),next=E.next(state);
 return '<div class="wrap task-actions">'+(back||(next&&next!==id?b('Next · '+(projectActionNames[next]||projectName(next)),'continue'):''))+
   b('Test '+eye+' eye','fill-test',{id},back?'':'primary')+'</div>';
}
const projectArtwork='assets/measurement-home/';
const cameraMode=params?.get('camera');
const staticHomeCamera=cameraMode!=='legacy';
const motionHomeCamera=!directNavigation&&staticHomeCamera&&cameraMode!=='static'&&globalThis.location?.protocol!=='file:';
let homeCameraView=null,homeCameraLoad=null,homeCameraFailed=false;
const homeCameraSlot=id=>motionHomeCamera?`<span class="hub-camera-slot" data-home-camera="${esc(id)}" data-camera-state="loading" aria-hidden="true"></span>`:'';
function syncHomeCamera(){
 const slot=$('[data-home-camera]');
 if(homeCameraView){
   homeCameraView.attach(slot,!!projectDirectory);
   return;
 }
 if(!slot)return;
 if(homeCameraFailed){
   slot.dataset.cameraState='fallback';
   return;
 }
 homeCameraLoad??=import('./home-camera-runtime.js').then(module=>{
   homeCameraView=module.createHomeCamera();
 }).catch(()=>{
   homeCameraFailed=true;
 }).then(syncHomeCamera);
}
const directoryGroups=[
 ['Body & vitals',['body','bp','oxygen','lung']],
 ['Body imaging',['posture','scan360','shoulder']],
 ['Strength & movement',['grip','balance','agility','pushups','jump','rope']],
 ['Vision',['vision','color','astigmatism']]
];
const projectDisplay={
 body:['Body composition','MP01-body-composition',[['fat','Body fat'],['weight','Weight'],['muscle','Muscle mass'],['water','Body water']]],
 bp:['Blood pressure','MP02-blood-pressure',[['systolic','Systolic'],['diastolic','Diastolic']]],
 oxygen:['Oxygen & pulse','MP03-blood-oxygen',[['spo2','SpO₂'],['pulse','Pulse rate']]],
 lung:['Vital capacity','MP04-lung-capacity',[['capacity','Vital capacity']]],
 posture:['Posture & dimensions','MP05-posture',[['waist','Waist'],['hip','Hip']]],
 scan360:['360° body scan','MP07-body-scan',[['scan','Scan record'],['model','3D view']]],
 shoulder:['Shoulder mobility','MP08-shoulder-mobility',[['lf','Left forward raise'],['rf','Right forward raise'],['la','Left side raise'],['ra','Right side raise']]],
 balance:['Balance','MP09-balance',[['balance','Balance score'],['holdDuration','Valid hold']]],
 agility:['Reaction time','MP10-reaction',[['reaction','Reaction time'],['count','Responses']]],
 grip:['Grip strength','MP11-grip-strength',[['left','Left hand'],['right','Right hand']]],
 pushups:['Push-ups','MP12-push-up',[['reps','Repetitions']]],
 jump:['Leg power','MP13-leg-power',[['jumpHeight','Jump height']]],
 rope:['Jump rope','MP14-jump-rope',[['ropeCount','Repetitions'],['duration','Duration']]],
 vision:['Visual acuity','MP15-visual-acuity',[['leftEye','Left eye'],['rightEye','Right eye']]],
 color:['Colour vision','MP16-colour-vision',[['colorResult','Test result']]],
 astigmatism:['Astigmatism','MP17-astigmatism',[['leftEye','Left eye'],['rightEye','Right eye']]]
};
const homeProjects=['body','bp','oxygen','posture'];
const projectName=id=>projectDisplay[id]?.[0]||t(id).name;
const projectActionNames={posture:'Posture',shoulder:'Shoulder',scan360:'360° scan',vision:'Acuity'};
const projectIcon=id=>projectDisplay[id]?projectArtwork+projectDisplay[id][1]+'.svg':'assets/chrome-v04/project-'+id+'.svg';
const onHome=()=>['home','results'].includes(state.route)&&GN.hasNavigation(state,E);
function sessionRecord(id){
 const record=state.results[id];
 return state.user&&record?.participantId===state.user.id?record:null;
}
const isRecorded=id=>!!sessionRecord(id)&&E.hasComplete(state,id);
const canReadResult=id=>isRecorded(id)||!!(sessionRecord(id)?.partial&&!sessionRecord(id)?.needsReview);
function projectState(id){
 const record=sessionRecord(id);
 if(isRecorded(id))return 'Recorded';
 if(record?.needsReview)return 'Retest needed';
 if(record?.partial)return 'Partly recorded';
 if(state.skipped.includes(id)||state.status[id]==='skipped')return 'Skipped';
 if(['failed','interrupted'].includes(state.status[id]))return 'Try again';
 return '';
}
function displayFields(id){
 const fields=projectDisplay[id]?.[2]||t(id).outputs.slice(0,2).map(v=>[v.id,v.label]);
 const record=sessionRecord(id);
 return fields.map(([key,label])=>{
   const value=!record?.needsReview&&record?.values?.find(v=>v.id===key&&!v.pending&&v.value!==null&&v.value!==undefined);
   const missing=!value&&record?.partial&&!record.needsReview?'Not tested':'';
   return {label,value:value?value.value:null,unit:value?(key==='pulse'&&value.unit==='次/分'?'bpm':value.unit):'',missing};
 });
}
function projectReadings(fields,compact=false){
 return `<dl class="hub-readings${compact?' hub-readings-compact':''}">${fields.map(row=>`<div><dt>${esc(row.label)}</dt>${row.value===null?(row.missing?`<dd class="hub-missing">${esc(row.missing)}</dd>`:''):`<dd>${esc(row.value)}<small>${esc(row.unit)}</small></dd>`}</div>`).join('')}</dl>`;
}
function homeLeaders(){
 return '<svg class="hub-leaders" viewBox="0 0 360 503" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width=".8"><path d="M24 87 H77 Q128 87 168 118"/><path d="M212 194 Q232 182 249 182 H336"/><path d="M24 345 H69 Q91 344 115 324"/><path d="M214 322 Q223 384 239 384 H336"/></g></svg>';
}
function hubLanding(){
 const next=E.next(state);
 const {chosen,missing}=E.scope(state);
 const ready=E.mandatoryReady(state);
 const done=chosen.filter(isRecorded).length;
 const plannedProgress=chosen.length?(state.scopeMode==='selected'
   ?`<p class="hub-progress">Plan · <strong>${done} of ${chosen.length}</strong> complete</p>`
   :`<p class="hub-progress">Recommended · <strong>${done}/${chosen.length}</strong></p>`):'';
 const firstBody=!sessionRecord('body');
 const optionalTests=firstBody?'<p class="hub-optional">Other tests are optional</p>':'';
 const callouts=homeProjects.filter(id=>E.allowed(state,id)).map(id=>{
   const fields=displayFields(id).slice(0,2);
   const nextLabel=next===id?(id==='body'?'First test':'Up next'):'';
   const scopeLabel=chosen.length&&state.scopeMode==='selected'&&!chosen.includes(id)?'Outside plan':'';
   const label=projectState(id)||nextLabel||scopeLabel;
   const values=fields.some(row=>row.value!==null);
   const name=id==='body'?'Body<br>composition':esc(id==='posture'?'Posture':projectName(id));
   const record=sessionRecord(id);
   const canView=GN.taskLayer&&isRecorded(id);
   const canPrepare=GN.taskLayer&&!record?.needsReview&&(ready?missing.includes(id):id==='body');
   const payload=esc(JSON.stringify({id}));
   const status=`<span class="hub-status">${esc(label)}</span>`;
   let heading=status+`<h2>${name}</h2>`;
   if(canPrepare&&!canView){
     const action=ready?'prepare-planned-test':record?.partial?'fill-test':'open-test';
     const cue=record?.partial?'Finish test':label==='Skipped'?'Make up':'Prepare';
     heading=`<h2><button type="button" class="hub-title-button hub-prepare-title" data-action="${action}"
       data-payload="${payload}" aria-label="${esc(cue+' · '+projectName(id))}">
       <span class="hub-title-meta">${status}<span class="hub-title-cue">${cue}</span></span>
       <span>${name}</span></button></h2>`;
   }
   const pre=id==='posture'?'Alignment · Waist':fields.map(row=>esc(row.label)).join(' · ');
   let readings=`<p class="hub-fields">${pre}</p>`;
   if(values)readings=projectReadings(fields,true);
   else if(id==='body'&&firstBody){
     readings=`<p class="hub-fields hub-first-outcome"><strong>${pre}</strong><span>Starts your report</span></p>`;
   }
   const openResults=canView?`<button type="button" class="hub-callout-open" data-action="preview-project"
     data-payload="${payload}" aria-label="${esc('Open '+projectName(id)+' preview')}"></button>`:'';
   return `<section class="hub-callout hub-callout-${id}">${heading}${readings}${openResults}</section>`;
 }).join('');
 return `<section class="hub-stage" lang="en" aria-label="Measurement home">${homeCameraSlot('overview')}${homeLeaders()}<img class="hub-mo" src="${projectArtwork}MOA07-P02-pose-three-quarter.png" alt=""><h1 class="hub-title">This session</h1><div class="hub-summary"><p class="hub-capacity">${active().length} tests on this device</p>${plannedProgress}${optionalTests}</div>${callouts}</section>`;
}
function hubPreview(id){
 const label=projectState(id)||'Not measured';
 const record=sessionRecord(id);
 const reportFields=id==='body'&&!record;
 const needsBodyFirst=id!=='body'&&!E.mandatoryReady(state)&&!canReadResult(id);
 const resultLink=GN.inlineResultLinks&&canReadResult(id)
   ?`<div class="hub-preview-links">${b('View result','view-completed',{id},'hub-inline')}</div>`:'';
 const nativeView=staticHomeCamera&&Object.hasOwn(projectDisplay,id);
 const originalArtwork=id==='bp'?projectArtwork+'MOBP-01-upper-arm.png':id==='body'?projectArtwork+'MOA07-P02-pose-three-quarter.png':projectIcon(id);
 const artwork=nativeView?`assets/home-camera-static-v01/${id}.png`:originalArtwork;
 return `<section class="hub-stage hub-preview hub-preview-${id}${nativeView?' hub-preview--camera':''}" lang="en" aria-label="Project preview">
   ${homeCameraSlot(id)}
   <img class="hub-preview-art" src="${esc(artwork)}"${nativeView?` data-preview-fallback="${esc(originalArtwork)}" width="720" height="1006"`:''} alt="">
   <h1 class="hub-title">${esc(projectName(id))}</h1><p class="hub-preview-status">${esc(label)}</p>
   <div class="hub-preview-readout">
    ${reportFields?'<p class="hub-preview-label">In your report</p>':''}
    ${projectReadings(displayFields(id))}
    ${needsBodyFirst?'<p class="hub-prerequisite">Your report starts with body composition.</p>':''}
    ${E.mandatoryReady(state)&&!record&&!state.plan.includes(id)&&state.scopeMode==='selected'
      ?'<p class="hub-prerequisite">Preparing this test adds it to your plan.</p>':''}
    ${resultLink}
   </div></section>`;
}
function hubActions(){
 const id=state.homeProject,record=id?sessionRecord(id):null;
 const origin=state.receiptReturn;
 const canResume=id&&origin&&(origin.pendingTest===id||(origin.pendingMode==='group'&&state.group?.members.includes(id)));
 const next=E.next(state);
 const ready=E.mandatoryReady(state);
 const recorded=id&&isRecorded(id);
 const usesInlineResult=GN.inlineResultLinks;
 const recordedPreview=usesInlineResult&&recorded;
 const resumeNext=recordedPreview&&next&&origin?.pendingTest===next;
 const plannedAction=next
   ?b(routeReview?nextProjectControl(next).label:'Next · '+(projectActionNames[next]||projectName(next)),'continue',{},'primary'):'';
 let primary='';
 let secondary='';
 if(recordedPreview)primary=resumeNext?returnPreparation(true):plannedAction;
 else if(canResume||(!id&&origin))primary=returnPreparation(true);
 else if(!usesInlineResult&&id&&(recorded||((origin||state.readingReturn)&&canReadResult(id))))primary=b('View result','view-completed',{id},'primary');
 else if(!ready){
   const body=sessionRecord('body');
   primary=body?.needsReview
     ?b('Retest body','retest',{id:'body',returnRoute:'home'},'primary')
     :b('Prepare · Body composition',body?.partial?'fill-test':'open-test',{id:'body'},'primary hub-prepare-body');
 }
 else if(id){
   if(record?.needsReview)primary=b('Retest','retest',{id,returnRoute:'home'},'primary');
   else {
     const eye=record?.partial&&record.screen?.eyes?(record.screen.eyes.left?'right':'left'):null;
     const gripHand=id==='grip'&&record?.partial?E.gripMissingSide(record):null;
     if(h10Footer&&gripHand&&record.values.some(v=>Number.isFinite(v.value)))
       primary=b('Start '+gripHand+' hand','start-grip-hand',{id,view:gripHand},'primary');
     else{
       const label=eye?'Test '+eye+' eye':gripHand?'Prepare · '+(gripHand==='left'?'Left hand':'Right hand'):
         record?.partial?'Finish test':projectState(id)==='Skipped'?'Make up test':projectState(id)==='Try again'?'Try again':id==='bp'?'Prepare · Blood pressure':'Prepare';
       primary=b(label,'fill-test',{id},'primary');
     }
   }
 }
 else primary=plannedAction;
 if(id&&origin&&!canResume&&!resumeNext)
   secondary=recordedPreview?b('Back to prep','return-to-task'):returnPreparation(true,'');
 else if(id&&state.readingReturn&&(!routeReview||state.readingReturn.route!=='result/'+id))secondary=b('Back to '+readingDestination(true),'return-reading');
 else if(!usesInlineResult&&id&&record?.partial&&canReadResult(id))secondary=b('View result','view-completed',{id});
 else if(id&&ready&&recorded)secondary=b('Retest','retest',{id,returnRoute:'home'});
 else if(!id&&!origin&&!h10Footer)
   secondary=b('Test plan','plan');
 return `<div class="wrap task-actions">${secondary}${primary}</div>`;
}
function directoryRow(id,status,{readings='',current=false,prepare=false}={}){
 return `<button type="button" class="directory-row" data-action="directory-project" data-payload="${esc(JSON.stringify(prepare?{id,prepare}:{id}))}" data-project-id="${esc(id)}" ${current?'aria-current="true"':''}>
   <img src="${esc(projectIcon(id))}" alt="" width="96" height="96">
   <span class="directory-project-name">${esc(projectName(id))}${readings}</span>
   <span class="directory-project-status">${esc(status)}</span><span class="directory-chevron" aria-hidden="true">›</span>
 </button>`;
}
function resultWork(){
 const [,current]=state.route.split('/');
 const eligible=E.scope(state).missing.filter(id=>id!==current&&(id==='body'||E.mandatoryReady(state)));
 const priority=reviewResultControls(current).primary;
 const next=priority?.action==='continue-natural'?priority.payload.id:priority?.action==='continue'?E.next(state):null;
 return {
   pending:E.remaining(state).filter(id=>id!==next&&eligible.includes(id)&&!projectState(id)),
   makeUp:eligible.filter(id=>id!==next&&projectState(id))
 };
}
function canBrowseRecorded(){
 const preparation=GN.taskLayer?.(state)==='prepare'&&(state.route.startsWith('prepare/')||state.route==='prerequisites');
 return GN.canOpenDirectory(state,E)&&(preparation||GN.resultBrowser?.(state,E))&&
   active().some(id=>state.route!=='result/'+id&&canReadResult(id));
}
function resultProgress(preparing=false){
 const reading=!preparing&&!!reviewResultBack();
 const {pending,makeUp}=!preparing&&!reading?resultWork():{pending:[],makeUp:[]};
 const groups=[['Other tests',pending],['Make up',makeUp]].filter(([,ids])=>ids.length);
 const label=groups.map(([name,ids])=>name+' '+ids.map(projectName).join(', ')).join('. ');
 const lines=groups.map(([name,ids])=>{
   const names=ids.slice(0,2).map(id=>projectActionNames[id]||projectName(id)).join(' · ');
   return `<span class="result-progress-line"><span>${name}</span><strong>${esc(names)}</strong>${ids.length>2?`<span>+${ids.length-2}</span>`:''}</span>`;
 }).join('');
 const choices=lines?`<button type="button" class="result-progress-choice" data-result-directory="tasks" data-action="directory-open" data-payload='{"mode":"tasks"}' aria-label="${esc(label)}" aria-haspopup="dialog">
   <span class="result-progress-lines">${lines}</span><span class="result-progress-chevron" aria-hidden="true">›</span>
 </button>`:preparing||reading?'':b('My tests','preview-home',{},'result-progress-home');
 const results=canBrowseRecorded()?'<button type="button" class="result-progress-read" data-result-directory="results" data-action="directory-open" data-payload=\'{"mode":"results"}\' aria-haspopup="dialog">View results</button>':'';
 if(preparing&&!results)return '';
 return `<div class="h10-result-index"><div class="gn-navigation-native">
   <div class="result-progress-actions">${choices}${results}</div>
 </div></div>`;
}
function plannedResultRow(id,makeUp){
 const status=projectState(id);
 const fields=displayFields(id).slice(0,2).map(({label})=>label);
 const description=[status,...fields].filter(Boolean).join(' · ');
 const action=status==='Partly recorded'?'Finish':status==='Retest needed'?'Retest':status==='Try again'?'Try again':makeUp?'Make up':'Prepare';
 return directoryRow(id,action,{readings:`<span class="directory-readings">${esc(description)}</span>`,prepare:true});
}
function directoryRows(filter,chosen){
 const enabled=new Set(active());
 const represented=new Set(directoryGroups.flatMap(([,ids])=>ids));
 const other=[...enabled].filter(id=>!represented.has(id));
 const groups=other.length?[...directoryGroups,['Other tests',other]]:directoryGroups;
 return groups.map(([title,ids])=>{
   const rows=ids.filter(id=>enabled.has(id)&&(filter!=='recorded'||canReadResult(id)));
   if(!rows.length)return '';
   return `<section class="directory-group"><h2>${esc(title)}</h2>${rows.map(id=>directoryRow(id,projectState(id)||(chosen.includes(id)?'In plan':''))).join('')}</section>`;
 }).join('');
}
function renderResultDirectory(){
 const tasks=projectDirectory.mode==='tasks';
 const {pending,makeUp}=tasks?resultWork():{pending:[],makeUp:[]};
 const recorded=tasks?[]:active().filter(canReadResult).map(id=>{
   const current=state.route==='result/'+id;
   const fields=displayFields(id).filter(v=>v.value!==null&&['number','string'].includes(typeof v.value)).slice(0,2);
   const readings=fields.map(v=>`<span>${esc(v.label)} <strong>${esc(v.value)}${v.unit?' '+esc(v.unit):''}</strong></span>`).join('');
   const status=current?'Viewing':sessionRecord(id).partial?'View partial':'View';
   return directoryRow(id,status,{readings:readings?`<span class="directory-readings">${readings}</span>`:'',current});
 });
 const sections=[['Other tests',pending.map(id=>plannedResultRow(id,false))],
   ['Make up',makeUp.map(id=>plannedResultRow(id,true))]];
 const groups=sections.filter(([,items])=>items.length);
 const rows=groups.map(([heading,items])=>
   `<section class="directory-group"><h2>${heading}</h2>${items.join('')}</section>`).join('');
 const count=tasks?pending.length+makeUp.length:recorded.length;
 const height=Math.min(372,Math.max(214,141+52*count+25*groups.length));
 return `<section class="project-directory results-directory" style="--result-sheet-height:${height}px" lang="en" role="dialog" aria-modal="true" aria-labelledby="project-directory-title">
   <h1 id="project-directory-title">${tasks?'Choose a test':'Recorded results'}</h1>
   <div class="results-directory-caption"><span class="directory-scroll-hint" hidden>Swipe to browse</span></div>
   <div class="directory-viewport" role="region" aria-label="${tasks?'Other tests':'Recorded results'}" tabindex="0">${tasks?rows:recorded.join('')}</div>
   <div class="directory-actions">${tasks?b('My tests','directory-session',{},'directory-session'):''}<button type="button" class="directory-close" data-action="directory-close"><span>Close</span></button></div>
 </section>`;
}
function renderDirectory(){
 if(projectDirectory.mode!=='catalog')return renderResultDirectory();
 const {filter}=projectDirectory;
 const scope=E.scope(state),total=scope.chosen.length,done=scope.chosen.filter(isRecorded).length;
 const count=active().filter(canReadResult).length;
 const rangeButton=(value,name)=>`<button type="button" data-action="directory-filter" data-payload="${esc(JSON.stringify({filter:value}))}" aria-pressed="${filter===value}" data-filter="${value}">${esc(name)}</button>`;
 const tickCount=Math.min(total,8);
 const progress=total?`<div class="directory-progress"><p>${state.scopeMode==='selected'?'Session plan':'Recommended plan'}</p><div><strong>${done} / ${total}</strong><span>tests completed</span></div></div>
    <div class="directory-progress-line" aria-hidden="true" style="--progress:${done/total*100}%;--segments:${tickCount}"></div>`
    :'<div class="directory-progress"><p>No results yet</p></div>';
 return `<section class="project-directory" lang="en" role="dialog" aria-modal="true" aria-labelledby="project-directory-title">
   <img class="directory-logo" src="assets/chrome-v04/header-logo.svg" alt="ANOVATOR" width="104" height="12">
   <h1 id="project-directory-title">All tests</h1>${progress}
   <div class="directory-filters" role="group" aria-label="Filter tests">${rangeButton('all','On device · '+active().length)}${rangeButton('recorded','With results · '+count)}</div>
   <div class="directory-viewport" role="region" aria-label="Tests" tabindex="0">${directoryRows(filter,scope.chosen)||'<p class="directory-empty">No records in this session.</p>'}</div>
   <div class="directory-actions"><button type="button" class="directory-close" data-action="directory-close"><span>Close</span></button></div>
 </section>`;
}
function sessionOverview(){
 return (state.homeProject?hubPreview(state.homeProject):hubLanding())+hubActions();
}
function renderProduct(){
 productNotes=[];reviewActions='';
 const route=state.route;
 const detailId={metric:'body',health:'body',segments:'body','posture-summary':'posture'}[route];
 let detailBack='';
 if(detailId&&!state.selectedHistory&&!(BODY&&route==='metric'&&state.results.body)&&!(POSTURE&&route==='posture-summary')){
   if(GN.localResultDetail?.(state,E))detailBack=`<div class="wrap task-actions">${n('Back to overview','result/body','result-return')}</div>`;
   else if(routeReview&&detailId==='body'&&state.results.body)
     detailBack=`<div class="wrap">${n('Back to overview','result/body','is-back')}</div>`+resultActions('body');
   else detailBack=`<div class="wrap task-actions">${n(detailId==='body'?'返回体成分结果':'返回体态结果','result/'+detailId,'primary is-back')}</div>`;
 }
 return (detailId==='body'&&state.results.body?.needsReview?info('资料已修改，请重新测量以更新结果。',true):'')+renderRoute()+(['history','history-record','compare'].includes(route)?'<div class="wrap task-actions">'+b('返回','return-history',{},'primary')+'</div>':'')+detailBack;
 }
function groupSimulator(){
 const g=state.group,acq=state.acq?.kind==='group';
 let html=`<div class="sim-combo"><strong>组合采集：仅流程模拟，P 各款兼容性未确认</strong><p>准备勾选不等于真实传感器就绪；已完成与可放松事件分别发送。</p>`;
 if(!state.acq)html+=['off','parallel','sequential'].map((mode,i)=>b(['关闭组合候选','启用并行模拟','启用顺序模拟'][i],'review-combination',{mode},'small',state.reviewCombination===mode)).join('');
 if(acq&&state.route==='group-measure'&&g.phase==='measure')for(const id of g.members)if(g.states[id]==='collecting')html+=`<div class="wrap">${b(t(id).name+' · 下一阶段','group-event',{id,event:'advance'},'small')}${b(t(id).name+' · 有效完成','group-event',{id,event:'valid'},'small primary')}${b(t(id).name+' · 失败结束','group-event',{id,event:'failed'},'small')}</div>`;
 if(acq&&state.route==='group-measure'&&g.phase==='release')html+=b('收到设备允许放松确认','group-release',{},'small primary');
 if(state.route==='group-prepare')html+=b(state.settings.peripherals.cuff?'模拟袖带断开':'模拟袖带恢复连接','connect',{id:'cuff',value:!state.settings.peripherals.cuff},'small');
 return html+'</div>';
}
function renderPlan(){
 const draft=state.planDraft;
 const selected=draft?.ids||E.scope(state).chosen;
 const needsBody=E.bodyRequired(state);
 const canCombine=E.groupAvailable(state)&&['body','bp'].every(id=>selected.includes(id)&&!E.hasComplete(state,id));
 const combine=canCombine?`<label class="check-row"><input type="checkbox" data-action="choose-combination" data-payload='{"value":${!draft?.useCombination}}' ${draft?.useCombination?'checked':''}><span><strong>体成分与血压</strong><br><small>一起准备，分别查看结果。</small></span></label>`:'';
 return title('本次测量计划',needsBody?'体成分为必测项。其余项目可以调整，也可以在测量时跳过。':'Choose the tests for this session.')+
   b('全选 · '+active().length+' 项','choose-all',{},'small')+
   active().map(id=>`<label class="check-row"><input type="checkbox" data-action="toggle-plan" data-payload="${esc(JSON.stringify({id}))}" ${selected.includes(id)?'checked':''} ${id==='body'&&needsBody?'disabled':''}><span><strong>${esc(t(id).name)}${id==='body'&&needsBody?' · 必测':''}</strong><br><small>${esc(status(id))}</small></span></label>`).join('')+combine+
   `<div class="wrap task-actions">${b('取消',draft?.fromSettings?'cancel-plan':'home')}${b('保存计划 · '+selected.length+' 项','apply-plan',{},'primary',!selected.length)}</div>`;
}
function groupPage(){
 const g=state.group;if(!g)return title('组合测量')+info('还没有开始这两项测量，请先选择项目。');
 if(state.stop)return GN.groupStop(state,{E,b,scene});
 const names={pending:'待准备',queued:'等待测量',collecting:'测量中',done:'已完成',failed:'需要重测',interrupted:'已停止'};
 if(state.route==='group-prepare')return title('体成分与血压','请完成以下准备，再开始测量。')+(state.lastStop?.group?'<div class="inline-stop-status" role="status"><strong>已停止</strong></div>':'')+`<div class="group-prep">${[['cuff','01','佩戴好袖带'],['feet','02','站到测量位置'],['handles','03','握好手柄']].map(([id,num,label])=>`<label class="check-row"><input type="checkbox" data-action="group-ready" data-payload='{"id":"${id}"}' ${g.ready[id]?'checked':''}><span><small>${num}</small><strong>${label}</strong></span></label>`).join('')}</div>`+info(state.settings.peripherals.cuff?'准备好一项，勾选一项。':'请连接袖带，或改为分别测量。',!state.settings.peripherals.cuff)+`<div class="wrap task-actions">${b('开始两项测量','start-group',{},'primary',!Object.values(g.ready).every(Boolean)||!state.settings.peripherals.cuff)}${b('改为分别测量','group-independent')}</div>`;
 const result=state.route==='group-result';
 const bodyReady=E.mandatoryReady(state);
 const retryPair=result&&routeReview&&E.canGroup(state,'body');
 const current=id=>result?E.groupResultState(state,id):g.states[id];
 const waiting=state.bodyDataReady?[!H.usable(state)?'身高':null,!W.usable(state)?'体重':null].filter(Boolean):[];
 const readings=g.members.map(id=>{
   const status=current(id),record=state.results[id],done=status==='done';
   const label=result?(done?'已完成':labels[status]||'未完成'):id==='body'&&status==='collecting'&&waiting.length?'正在获取'+waiting.join('与'):names[status];
   const preview=record&&(id==='body'?record.values.filter(v=>['weight','bmi','fat'].includes(v.id)):record.values);
   const repairAtBottom=result&&!state.receiptReturn&&!state.readingReturn&&
     (!bodyReady?id==='body':!directNavigation&&E.next(state)===id);
   const summary=preview?`<dl class="group-values">${preview.map(v=>`<div><dt>${esc(v.label)}</dt><dd><strong>${esc(v.value)}</strong> <small>${esc(v.unit)}</small></dd></div>`).join('')}</dl>`:'';
   const retry=done||retryPair||repairAtBottom?'':
     id==='bp'&&!bodyReady?`<p class="muted compact">${routeReview?'Complete body composition before taking your blood pressure.':'请先完成体成分，再测血压。'}</p>`:
     b('重新测量','fill-test',{id},'small');
   return `<section class="group-member ${done?'is-done':''}"><div><h2>${esc(t(id).name)}</h2>${done?'':`<p>${esc(label)}</p>`}</div>${done?'<strong class="saved-mark">已完成</strong>':!result&&status==='collecting'&&!(id==='body'&&waiting.length)?`<small>${esc(t(id).stages[g.steps[id]])}</small>`:''}${result?(record?summary+b('查看完整结果','select-project',{id},'small'):'<p class="blank-value">—</p>')+retry:''}</section>`;
 }).join('');
 if(!result)return title('体成分与血压',g.phase==='release'?(g.members.some(id=>E.hasComplete(state,id))?'已有结果已保留，请等待设备确认。':'未取得测量结果，请等待设备确认。'):'请保持姿势，等待两项测量结束。')+`<div class="group-members" aria-live="polite">${readings}</div>`+info(g.phase==='release'?'请保持当前姿势，等待可以放松的提示。':'一项完成后，请继续保持姿势。')+`<div class="wrap task-actions">${b('停止两项测量','stop',{},'stop-action')}</div>`;
 const groupSummary=g.members.every(id=>E.hasComplete(state,id))?'两项测量已完成。':
   retryPair?'Both tests need to be completed. You can try them together again.':
   !bodyReady?(E.hasComplete(state,'bp')?'请重测体成分，血压已完成。':'请先重测体成分，再继续其他项目。'):'已完成的结果会保留，其余项目可单独测量。';
 return title('体成分与血压 · 结果',groupSummary)+`<div class="group-members group-summary">${readings}</div>`+resultActions();
}
function renderRoute(){
 const route=state.route,x=spec(route),id=route.split('/')[1],kind=route.split('/')[0];
 if(id)return renderTestPage(kind,id);
 if(route==='recovery'&&state.acq?.screen)return SUI.render(state,'recovery',state.acq.testId,{b});
 if(route==='recovery'&&state.pendingTest==='bp')return renderBloodPressure('recovery');
 if(POSTURE&&route==='recovery'&&state.pendingTest==='posture')return postureUI('recovery',state.results.posture);
 if(POSTURE&&route==='posture-summary')return postureUI('detail',(E.selectedRecord(state)?.results||state.results).posture);
 if(['recovery','prerequisites'].includes(route)&&ACCESSORY?.uses(state.pendingTest))return accessoryUI('recovery',state.pendingTest,state.results[state.pendingTest]);
 if(route==='recovery'&&MOTION?.uses(state.pendingTest))return motionUI('recovery',state.pendingTest);
 if(route==='prerequisites'&&state.pendingTest==='bp'&&!state.settings.peripherals.cuff)return renderBloodPressure('disconnected');
 switch(route){
 case 'height-record':return heightRecordPage();
 case 'group-prepare':case 'group-measure':case 'group-result':return groupPage();
 case 'standby':return `<div class="splash"><div class="mark">ANOVATOR</div><h1>了解身体，<br>从这里开始。</h1><p class="muted">${singleBody()?'人体成分分析':active().length+' 项身体测量'}</p>${b(singleBody()?'开始测量':'开始体验','start',{},'primary')}</div>`+reviewNote('这是全局功能原型。当前画面用于评审功能与去向，正式视觉和动效沿各工作线继续。');
 case 'home':case 'results':return sessionOverview();
 case 'identity':return (ENTRY?ENTRY.render(state,{b,n,esc,recentAccounts,demo:pagesRelease}):title('登录','登录后，将测量结果保存到你的账号。')+form('identity',field('id','会员编号',state.user?.id||state.reviewIdentity||'DEMO-001','text','autocomplete="off" required')+field('name','姓名',state.user?.name||'演示受测者'),'继续')+recentAccounts()+(state.identityOrigin?b('取消修改','cancel-identity-edit'):!state.user?n('返回待机','standby'):'')+b('扫码登录（演示）','identity',{id:'DEMO-QR-001',name:'扫码演示受测者'}))+(pagesRelease?'':reviewNote('ID长度、是否允许匿名，以及“无匹配→登记”的规则仍待确认；不会假设必须是手机号。'));
 case 'consent':return title('测量与资料使用',singleBody()?'体成分测量需要使用你的基础资料和测量数据。':'测量需要使用你的基础资料，以及本次测量产生的数据或影像。')+list(['用于本次测量、结果分析和生成报告。','测量结果将关联到你的账号。','告知内容为演示稿，正式条款尚未提供。'])+`<div class="wrap">${b('同意并继续','consent',{agree:true},'primary')}${b('暂不同意','consent',{agree:false})}${!valid()?b('修改会员编号','edit-identity'):''}${b('退出本次测量','end')}</div>`;
 case 'profile':return title('确认个人资料','请核对资料，确保测量结果准确。')+form('profile',field('age','年龄',state.basics.age||DEMO.age,'number','min="1" required')+select('sex','性别',[['','请选择'],['female','女'],['male','男']],state.basics.sex||DEMO.sex)+requiredFields(),'确认并继续')+(!valid()?b('修改会员编号','edit-identity'):'');
 case 'clinical':return title('住院信息','请核对本次住院信息。')+form('clinical',field('name','姓名',state.clinical?.name||'')+field('bed','床位号',state.clinical?.bed||'')+field('admission','住院号',state.clinical?.admission||''));
 case 'plan':return renderPlan();
 case 'prerequisites':{const task=t(state.pendingTest),dev=task?.peripheral,fields=requiredFields();return title('测量前准备',task?.name)+(dev&&!state.settings.peripherals[dev]?info('请先连接测量设备，再继续。')+b('检查连接','check-connection'):'')+(task?.needsBasics?heightSummary():'')+(fields?form('basics',fields,'保存并继续'):b('继续','resume-pending',{},'primary'))+`<div class="wrap task-actions">${continuationHint(state.pendingTest)}${skipAction()}</div>`;}
 case 'stop':return state.acq?renderTestPage('measure',state.acq.testId):title('测量已停止')+b('返回测量','open-test',{id:state.pendingTest||'body'},'primary');
 case 'recovery':return recoveryPage();
 case 'unavailable':return title('项目暂不可用',t(state.pendingTest)?.name)+info(profile().pending.includes(state.pendingTest)?'此项目暂未开放，请选择其他项目。':'此项目尚未启用，请联系工作人员。',true)+(singleBody()?b('返回本次测量','home'):'');

 case 'metric':{if(BODY&&state.results.body)return BODY.render(state,'focus',{b,n,esc,E,record:state.results.body,actions:resultActions});const v=state.results.body?.values.find(v=>v.id===state.selectedMetric);return title(v?.label||'指标详情','本次测量 · 示例数据')+(v?`<div class="big-reading">${esc(v.value)} <small>${esc(v.unit)}</small></div>`:'<div class="empty">暂无体成分结果。</div>')+info('未评级 · 暂无指标解读。')+`<div class="wrap">${(state.results.body?.values||[]).map(v=>b(v.label,'metric',{id:v.id},v.id===state.selectedMetric?'small active':'small')).join('')}</div><div class="wrap section">${historyEntry()}${b('重测人体成分','retest',{id:'body',returnRoute:'metric'})}</div>`;}
 case 'health':return title('健康分析','暂无健康分析。')+valuesHTML(['健康评分','身体年龄','体型分类','理想体重','体重控制','脂肪控制','肌肉控制','运动建议','饮食建议'].map(label=>({label,value:'未评级',unit:''})))+info('当前示例不提供健康评分或建议。');
 case 'segments':return title('身体分部数据','查看各部位的肌肉量和脂肪量。')+`<div class="field-summary">${['左上肢','右上肢','躯干','左下肢','右下肢'].map(v=>`<div>${esc(v)}<strong>暂无数据</strong><small>肌肉量 / 脂肪量 · kg</small></div>`).join('')}</div>`+info(profile().advancedBody?'更多分析：细胞内外水分、总水分、分频阻抗、相位角。当前暂无数据。':'本设备暂未提供更多分析。');
 case 'posture-summary':return title('体态与围度','查看不同视角的影像与身体数据。')+`<div class="wrap">${b('正面','view',{view:'front'},state.selectedView==='front'?'active':'')}${b('侧面','view',{view:'side'},state.selectedView==='side'?'active':'')}${b(state.faceHidden?'显示面部':'隐藏面部','privacy')}</div>`+scene((state.selectedView==='side'?'侧面':'正面')+' · '+(state.faceHidden?'遮脸':'显示面部'),'影像示意 · 暂无本人照片')+`<div class="wrap">${[['grid','网格'],['bones','骨点'],['risk','风险'],['dimensions','尺寸']].map(([id,label])=>b(label,'overlay',{id},state.overlays[id]?'active':'')).join('')}</div>`+info('显示：'+Object.keys(state.overlays).filter(k=>state.overlays[k]).map(k=>({grid:'标准网格',bones:'骨点线稿',risk:'风险提示',dimensions:'围度尺寸'}[k])).join(' / '))+valuesHTML((E.selectedRecord(state)?.results.posture||state.results.posture)?.values||[])+`<details><summary>更多尺寸与体态信息</summary><p>其他围度和体态解读暂无数据。</p>${reviewNote('完整围度、风险字段和单位仍按 Q-POSTURE 核对；不补造缺失数值。')}</details><div class="wrap section">${state.selectedHistory?n('返回历史记录详情','history-record'):b('重拍当前视角','retest',{id:'posture',view:state.selectedView,returnRoute:'posture-summary'},'primary')}${singleBody()?b('返回本次测量','home'):''}</div>`;
 case 'history':return title('历史记录','查看以往的测量结果。')+form('history-query',field('id','会员编号',state.historyQuery||state.user?.id||''),'查询')+(records().length?records().map(r=>`<button class="task-card" data-action="record" data-payload="${esc(JSON.stringify({id:r.id}))}"><strong>${esc(r.date.slice(0,10))}</strong> · ${esc(r.name)}<p>${Object.keys(r.results).map(i=>esc(t(i).name)).join(' · ')} / v${r.revision}</p></button>`).join(''):'<div class="empty">还没有找到测量记录，请核对会员编号。</div>')+`<div class="wrap section">${n('历史对比','compare')}</div>`;
 case 'history-record':{const h=E.selectedRecord(state);return title('历史记录详情',h?h.date.slice(0,10)+' · '+h.participantId:'')+(h?Object.entries(h.results).map(([id,r])=>`<h3>${esc(t(id).name)}</h3>${valuesHTML(r.values)}`).join(''):'<div class="empty">请先选择一条记录。</div>')+`<div class="wrap">${h?.results.posture?n('查看体态影像','posture-summary'):''}${b('查看报告','report',{},'primary',!h)}${n('历史对比','compare')}${b('返回历史记录','history')}</div>`;}
 case 'compare':{const rows=records();if(state.results.body&&state.user?.id===(state.historyQuery||state.user?.id))rows.unshift({id:'CURRENT',participantId:state.user.id,name:state.user.name,date:new Date().toISOString(),method:'prototype-v01',unit:'metric',results:state.results});const choice=state.comparison||{},from=rows.find(r=>r.id===choice.from)||rows[0],to=rows.find(r=>r.id===choice.to)||rows[1],key=choice.metric||'weight';const options=rows.map(r=>[r.id,(r.id==='CURRENT'?'本次 · ':'')+r.date.slice(0,10)]);const comparable=from&&to&&from.id!==to.id&&from.participantId===to.participantId&&from.method===to.method&&from.unit===to.unit;const value=r=>r?.results.body?.values.find(v=>v.id===key);return title('历史对比','选择两次测量，查看数据变化。')+(rows.length<2?'<div class="empty">还没有足够的记录，至少需要两次测量才能对比。</div>':form('compare-options',select('from','记录一',options,from?.id)+select('to','记录二',options,to?.id)+select('metric','比较指标',C.bodyMetrics.map(v=>[v.id,v.label]),key),'查看对比')+(comparable?`<div class="table-wrap"><table><tr><th>记录</th><th>${esc(C.bodyMetrics.find(v=>v.id===key)?.label)}</th><th>数据</th></tr>${[from,to].map(r=>`<tr><td>${r.id==='CURRENT'?'本次':esc(r.date.slice(0,10))}</td><td>${esc(value(r)?.value??'未测')} ${esc(value(r)?.unit||'')}</td><td>示例数据</td></tr>`).join('')}</table></div>`:info('这两条记录无法对比，请选择同一人的两次同类测量。',true)))+reviewNote('比较原始记录，尚未计算评级变化；真实方法版本可比规则另行确认。')+`<div class="wrap">${b('返回历史记录','history')}</div>`;}
 case 'report':return renderReport();
 case 'report-preview':return renderReportPreview();
 case 'delivery':return renderDelivery();
 case 'end':return renderExit();
 case 'settings':{
   const testPlan=h10Footer&&state.user&&state.consent&&!singleBody()&&!state.selectedHistory&&!state.privacyLocked
     ?b('本次测量计划','plan'):'';
   return title('设置','')+`<div class="page-toc">${testPlan}${[['network','网络'],['language','语言与单位'],['help','帮助']].map(([p,l])=>n(l,p)).join('')}${profile().referenceOnly&&state.user&&state.consent?n('住院信息','clinical'):''}</div><h3 class="section">管理功能 ${badge(state.admin?'演示授权':'需授权',state.admin?'ok':'warn')}</h3><div class="stack">${[['projects','可用测量项目'],['peripherals','配件连接'],['calibration','设备校准'],['account','账号与机构'],['update','软件更新'],['sync','数据同步'],['lock','锁屏设置'],['mirror','屏幕共享'],['activation','设备激活'],['advanced','高级设置'],['reset','恢复出厂设置']].map(([page,label])=>b(label,'manager-page',{page})).join('')}</div><div class="section">${b('返回','manager-back')}</div>`;
 }
 case 'setup':return title('欢迎使用',`步骤 ${state.setupStep+1} / 3`) + (state.setupStep===0?(routeReview?info('English · Metric readings'):select('setup-language','语言',[['zh-CN','简体中文'],['en','English']],'zh-CN')+info('稍后可在设置中更改语言和单位。')):state.setupStep===1?info('网络：'+(state.settings.network==='online'?'已连接':'离线'))+n('网络设置','network'):info('账号授权、机构和设备绑定。'))+`<div class="wrap section">${state.setupStep<2?b('下一步','setup-next',{},'primary'):n('进入激活','activation','primary')}</div>`;
 case 'activation':return title('设备激活','请使用手机扫码，按提示激活设备。')+`<div class="empty">设备编号：DEMO-P-001<br>激活码示意 · 暂不支持扫码</div><div class="wrap section">${n('手机端演示','mobile-activation')}${b('完成激活（演示）','activate',{},'primary')}</div>`+reviewNote('真实注册字段、凭据与绑定协议未接入。');
 case 'mobile-activation':return title('绑定设备','请确认要绑定的设备和机构。')+list(['确认设备编号与机构。','登录或注册账号。','确认绑定信息。','绑定成功后，设备将完成激活。'])+form('mobile-form',field('organization','机构名称','演示机构'),'提交（演示）')+info(state.service.mobile||'等待提交')+n('返回设备激活','activation');
 case 'network':return title('网络','网络断开时，在线服务暂不可用。')+info(state.settings.network==='online'?'已连接网络':'网络未连接',state.settings.network!=='online')+`<div class="wrap">${b('连接网络（演示）','network',{value:'online'},'primary')}${b('断开网络','network',{value:'offline'})}${b(state.networkOrigin==='setup'?'返回首次设置':state.networkOrigin==='help'?'返回帮助':'返回设置','network-back')}</div>`;
 case 'language':return title('语言与单位','')+(routeReview?info('English · Metric readings'):form('language',select('language','界面语言',[['zh-CN','简体中文'],['en','English']],state.settings.language)+select('unit','计量单位',[['metric','公制'],['imperial','英制']],state.settings.unit),'保存设置')+info(state.service.language||'本演示暂不切换界面语言或换算单位。'))+n('返回设置','settings');
 case 'peripherals':return renderConnection();
 case 'calibration':return title('设备校准','请在本次测量结束后调整校准设置。')+form('calibration',field('tare','体重去皮值 · kg',state.settings.calibration.tare,'number','step="0.1"')+select('height','身高获取方式',[['auto','自动获取'],['manual-review','手动输入']],state.settings.height),'保存设置（演示）')+info(state.service.calibration||'此处仅演示设置，不会校准真实设备。')+n('返回设置','settings');
 case 'projects':return title('可用测量项目','选择此设备开放的测量项目。')+profile().tests.map(id=>`<label class="check-row"><input type="checkbox" data-action="toggle-service" data-payload="${esc(JSON.stringify({id}))}" ${state.settings.enabled.includes(id)?'checked':''}><span>${esc(t(id).name)}</span></label>`).join('')+reviewNote('成人／儿童与机构套餐的适用矩阵待核；不由年龄字段擅自禁用或增加测项。')+n('返回设置','settings');
 case 'account':return title('账号、机构与设备','查看账号与设备的绑定信息。')+valuesHTML([{label:'账号',value:'演示管理账号',unit:''},{label:'机构',value:state.service.organization||'演示机构',unit:''},{label:'设备',value:'DEMO-P-001',unit:''}])+form('organization',field('organization','机构名称',state.service.organization||'演示机构'),'保存（演示）')+reviewNote('真实账号认证、编辑权限与机构字段待核。')+n('返回设置','settings');
 case 'update':return renderService('版本与更新','update',[['检查更新','available'],['下载更新','downloading'],['模拟下载失败','download-failed'],['安装更新（演示）','ready'],['模拟安装失败','install-failed'],['恢复原版本（演示）','rolled-back']],'检查、下载、安装、失败与回退均保留。会话期间不执行安装；此处只模拟阶段，未改动本机任何软件。');
 case 'sync':return renderService('记录同步','sync',[['开始同步','syncing'],['模拟同步成功','synced'],['模拟断网','offline'],['模拟冲突','conflict'],['重试','syncing']],'本地保存、云同步与报告领取是独立状态；冲突不能静默覆盖另一份记录。');
 case 'lock':return title('锁屏设置','选择锁屏方式。')+`<div class="wrap">${b('数字锁','service',{key:'lockType',value:'数字锁'})}${b('手势锁','service',{key:'lockType',value:'手势锁'})}${b('现在锁屏','lock-now')}</div>`+info('当前选择：'+(state.service.lockType||'未设置'))+n('返回设置','settings');
 case 'locked':return title('设备已锁定','个人资料和测量结果已隐藏。')+`<div class="wrap">${b('解锁（演示）','unlock',{},'primary')}${b('退出本次测量','end')}</div>`+reviewNote('本版不处理真实密码或手势。无操作超时长度与身份恢复方式需正式确认。');
 case 'mirror':return renderService('屏幕共享','mirror',[['开启共享（演示）','on'],['关闭共享','off']],'屏幕共享是设备向目标端展示内容的能力，不等同于手机访问当前 Web 原型；传播哪些身份与结果、谁可连接仍待核。');
 case 'advanced':return title('高级设置','')+info('此功能暂未开放。',true)+`<div class="section">${n('返回设置','settings')}</div>`;
 case 'reset':return title('恢复出厂设置','清除范围尚未确认，本演示不会清除设备数据。')+reviewNote('保留／清除哪些本地记录、机构绑定、校准、日志与软件版本尚待产品签认。演示会保留历史，不冒充正式清除策略。')+b('重置演示设置','reset-device',{confirmed:true},'danger')+`<div class="section">${n('取消','settings')}</div>`;
 case 'help':return title('帮助与支持','遇到问题时，可请工作人员协助。')+list(['测量前，请按画面示范做好准备。','测量未完成时，已有结果会保留。检查姿势或连接后可重新测量。','如需中途停止，请点击“停止本项”，等待设备确认后再调整姿势。','结束本次测量后，可查看和领取报告。'])+`<div class="wrap">${n('检查网络','network')}${b('检查配件','manager-page',{page:'peripherals'})}${historyEntry()}</div>`+n('返回设置','settings');
 default:return title(x?.name||'暂不可用')+info('此功能暂未开放，请返回。',true);
 }
}
function recoveryPage(){
 const note=state.failure?.reason||'未能完成测量，请检查后重试。';
 if(state.acq&&state.failure?.confirmed===false){
   const action=state.stop?.status==='unconfirmed'?b('重试停止','retry-stop',{},'primary'):
     b(state.stop?'正在停止':'停止测量','stop',{},'stop-action',!!state.stop);
   return title('等待设备确认',note)+info('设备确认停止后，可以重新准备或跳过。',true)+`<div class="wrap task-actions">${action}</div>`;
 }
 return title('测量未完成',note)+info('已有结果会保留，请检查后重试。',true)+`<div class="wrap task-actions">${b('重新准备','retry',{},'primary')}${skipAction()}</div>`;
}
function renderConnection(){
 const devices={cuff:'血压袖带',oximeter:'血氧仪',spirometer:'肺活量计',dynamometer:'握力计'};
 if(state.connectionTask){
   const {device}=state.connectionTask,connected=state.settings.peripherals[device];
   return title(devices[device]+'连接',connected?'配件已连接，可以返回当前测量。':'请检查本项配件连接。')+
     `<div class="wrap task-actions">${b('返回条件检查','back-to-connection-task')}${connected?b('返回测量','resume-pending',{},'primary'):b('重新连接（演示）','connect',{id:device,value:true},'primary')}</div>`;
 }
 return title('配件连接','选择需要连接的测量配件。')+Object.entries(devices).map(([id,label])=>
   `<div class="metric"><div>${label}<small>DEMO-${id.toUpperCase()} · ${state.settings.peripherals[id]?'已连接':'未连接'}</small></div>
   ${b(state.settings.peripherals[id]?'断开':'连接','connect',{id,value:!state.settings.peripherals[id]},'small')}</div>`).join('')+
   `<div class="wrap section">${n('返回设置','settings')}</div>`+
   reviewNote('这里只改变演示就绪状态；扫描、配对、更换及失败原因需真实外设协议验证。');
}
function renderService(name,key,actions,note){const simulated=actions.filter(([label])=>label.startsWith('模拟'));reviewActions=simulated.map(([label,value])=>b(label,'service',{key,value},'small')).join('');actions=actions.filter(([label])=>!label.startsWith('模拟'));const names={available:'有可用更新',downloading:'正在下载','download-failed':'下载失败',ready:'可以安装','install-failed':'安装失败','rolled-back':'已恢复原版本',syncing:'正在同步',synced:'同步完成',offline:'网络未连接',conflict:'记录有冲突，请联系管理员',on:'已开启',off:'已关闭'};return title(name,names[state.service[key]]||'尚未开始')+reviewNote(note)+`<div class="wrap">${actions.map(([label,value])=>b(label,'service',{key,value})).join('')}</div><div class="section">${n('返回设置','settings')}</div>`;}
function renderReport(){
 const r=state.report,ctx=E.currentReportContext(state),names={generating:'正在生成报告',generated:'正在保存报告',saved:'报告已保存','generation-failed':'报告生成失败','save-failed':'报告保存失败'},busy=r&&['generating','generated'].includes(r.stage);
 const records=Object.entries(r?.fields||ctx.results).filter(([id])=>C.isTestVisible(id)).map(([,record])=>record);
 const partial=records.filter(row=>row.partial).length;
 const completed=records.length-partial;
 const omissions=(r?.omissions||[]).filter(({id})=>C.isTestVisible(id));
 const templates=select('template','报告类型',[['standard','标准报告'],['composition','人体成分'],['water','水分'],['child','儿童'],['nutrition','营养 / 运动处方']],r?.template||'standard');
 return title(ctx.historyId?'历史报告':'本次报告',ctx.historyId?'查看这次测量的报告。':r?.stale?'结果已更新，请重新生成报告。':r&&/failed/.test(r.stage)?'测量结果已保留，请重试。':r?.saved?'报告已准备好。':'正在整理测量结果。')
 +info(`已完成 ${completed} 项。${partial?'部分完成 '+partial+' 项。':''}${omissions.length?'未取得结果 '+omissions.length+' 项。':''}${state.settings.network==='offline'?'当前离线。':''}`)
 +(r?`<div class="review-status" role="status"><strong>${esc(names[r.stage]||r.stage)}</strong> · v${r.revision}${r.stale?badge('结果已更新，请重新生成','warn'):''}<p class="muted">领取状态：${esc(deliveryLabel(r.delivery))}</p></div>`:'')
 +(busy?info(r.stage==='generated'?'正在保存，完成后即可领取。':'请稍候，报告准备好后即可查看。'):ctx.historyId&&!r?form('generate-report',templates,'生成报告'):`<details class="section"><summary>报告类型</summary>${form('generate-report',templates,'更新报告')}</details>`)
 +`<div class="wrap">${b('预览','navigate',{page:'report-preview'},'',!r||!['generated','saved'].includes(r.stage))}${b('领取报告','delivery',{},'primary',!r?.saved||r?.stale)}${r&&/failed/.test(r.stage)?b('重试','report-retry'):''}</div>`
 +reviewNote('本原型演示生成、保存与领取状态；正式版式及服务另行接入。');
}
function renderExit(){
 if(state.privacyLocked)return title('退出本次测量','个人资料保持隐藏。')+info('退出后将隐藏个人资料，已有测量记录会保留。')+`<div class="wrap">${b('确认退出','confirm-end',{},'primary')}${b('返回锁屏','navigate',{page:'locked'})}</div>`;
 if(!state.consent&&!valid())return title('退出本次测量','本次尚未开始测量。')+`<div class="wrap">${b('确认退出','confirm-end',{},'primary')}${n('返回确认','consent')}</div>`;
 if(!E.bodyRequired(state)&&!valid())return title('Exit session','No readings have been recorded.')+`<div class="wrap">${b('Exit','confirm-end',{},'primary')}${b('Keep testing','home')}</div>`;
 if(!E.mandatoryReady(state))return title('体成分尚未完成','请先完成体成分测量，再生成报告。')+info(valid()?'已有结果会保留。可继续测量，或退出本次测量。':'继续测量，或退出本次测量。')+`<div class="wrap">${b('继续测量','fill-test',{id:'body'},'primary')}${b('退出','confirm-end',{},'quiet')}</div>`;
 return title('退出本次测量','退出后将隐藏个人资料，已有测量记录会保留。')+info(state.report?.saved?'报告已保存。':'报告尚未保存，请返回报告页重试。')+`<div class="wrap">${b('返回报告','end',{},'primary')}${b('退出','confirm-end',{},'quiet')}</div>`;
}
function renderSessionFooter(){
 if(!state.user||state.acq||['identity','consent','plan','end','locked','stop'].includes(state.route))return '';
 if(spec(state.route)?.group==='manage'||state.route==='help')return '';
 if(GN.localResultDetail?.(state,E))return '';
 const layer=GN.taskLayer?.(state);
 if(layer==='measure')return '';
 if(directNavigation){
   if(state.route.startsWith('result/')||state.route==='group-result'){
     if(singleBody()||!canEndFromResult())return '';
     const emphasize=resultEndEmphasized()&&!(h10Footer&&state.route==='result/posture');
     const classes='quiet session-end recorded-session-end'+(emphasize?' close-out-end':'');
     return b('End','end',{},classes);
   }
   if(layer==='prepare'||state.route.startsWith('prepare/')||state.route==='group-prepare'){
     if(state.mode==='retest')return '';
     return (E.bodyRequired(state)?E.mandatoryReady(state):valid())?'':b('Exit session','end',{},'quiet session-end');
   }
 }
 if(layer==='prepare'&&!singleBody()){
   if(state.mode==='retest')return '';
   return b('Back to My tests','preview-home',{},'result-return');
 }
 if(GN.hasNavigation(state,E)){
   const back=resultFooterBack();
   if(back)return b(back.label,back.action,back.payload,'result-return');
   if(directNavigation)return '';
   const english=onHome()||state.pendingTest==='bp'&&['recovery','prerequisites'].includes(state.route)||/^(prepare|result)\/bp$/.test(state.route);
   const text=english?(E.mandatoryReady(state)?'End session':'Exit session'):(E.mandatoryReady(state)?'结束本次测量':'退出本次测量');
   return b(text,'end',{},'quiet session-end');
 }
 const handoff=['report','report-preview','delivery'].includes(state.route);
 if(handoff&&state.selectedHistory)return b('返回记录','navigate',{page:'history-record'});
 if(handoff&&state.assessmentClosing){
   const received=state.report?.delivery==='received';
   const exit=state.report?.saved&&!state.report.stale
     ?b(received?'完成并退出':'暂不领取并退出','finish-session',{},received||!GN.taskLayer?'primary':'quiet')
     :b('退出','exit-session',{},'quiet');
   return b(singleBody()?'返回结果':'继续测量','resume-assessment')+'<span class="spacer"></span>'+exit;
 }
 if(singleBody()){
   const route=state.route,isResult=route==='result/body',isPreparing=route==='prepare/body';
   return (isPreparing&&!state.acq?historyEntry():'')+'<span class="spacer"></span>'+(!isResult&&route!=='consent'?b(E.mandatoryReady(state)?'结束本次测量':'退出本次测量','end'):'');
 }
 if(['home','results'].includes(state.route))return E.scope(state).complete?'':b(E.mandatoryReady(state)?'结束本次测量':'退出本次测量','end',{},'quiet session-end');
 return (state.route!=='standby'?b('测量首页','home'):'')+`<span class="session-count">${E.scope(state).chosen.length?'已完成 '+E.scope(state).done.length+'/'+E.scope(state).chosen.length:'尚未选择项目'}</span><span class="spacer"></span>`+b(E.mandatoryReady(state)?'结束本次测量':'退出本次测量','end',{},'quiet session-end');
}
function reportPreviewRecords(r){
 const resultRows=Object.entries(r.fields).filter(([id])=>C.isTestVisible(id)).map(([id,record])=>{
   const eyes=record.screen?.eyes;
   const eye=record.partial&&eyes?(eyes.left?' · 待补右眼':' · 待补左眼'):'';
   const hand=record.partial&&id==='grip'&&record.values.length===1?(record.values[0].id==='left'?' · 待补右手':' · 待补左手'):'';
   const shoulder=record.partial&&id==='shoulder'?' · 待补'+t(id).outputs.filter(field=>!record.values.some(v=>v.id===field.id&&!v.pending)).map(field=>field.label).join('、'):'';
   return `<p>${esc(t(id).name)} · ${record.partial?'部分完成':'已完成'}${esc(eye+hand+shoulder)}</p>`;
 });
 const missing=(r.omissions||[]).filter(({id})=>C.isTestVisible(id))
  .map(({id,state:status})=>`<p>${esc(t(id).name)} · ${esc(labels[status]||'未取得结果')}</p>`);
 return [...resultRows,...missing].join('');
}
function renderReportPreview(){const r=state.report;if(!r||!['generated','saved'].includes(r.stage))return title('报告预览')+info('报告尚未生成，请稍候。')+b('返回报告','report');return title('报告预览','第 '+(state.reportPage+1)+' / 3 页 · 示例')+`<div class="report-scroll"><div class="report-sheet" style="width:${state.reportZoom*100}%"><small>ANOVATOR / DEMO REPORT</small><h2>演示报告 · ${state.reportPage+1}</h2><p>${esc(r.participantId)} / v${r.revision}</p>${state.reportPage===0?reportPreviewRecords(r):state.reportPage===1?'<p>详细指标与参照解释由正式模板承载。</p>':'<p>历史与建议根据适用数据、算法与权限呈现。</p>'}<small>非正式报告模板 · 不用于健康判断</small></div></div><div class="wrap">${b('上一页','report-page',{delta:-1},'',state.reportPage===0)}${b('下一页','report-page',{delta:1},'',state.reportPage===2)}${b('缩放预览','report-zoom')}${b('返回报告','report')}</div>`;}
function deliveryLabel(v){return ({pending:'未领取',printing:'正在打印','code-ready':'领取码已展示',received:'已确认领取','print-failed':'打印失败','code-expired':'领取码已过期'})[v]||v;}
function renderDelivery(){const r=state.report;return title('领取报告','选择领取方式。')+info(!r?.saved?'报告还未保存，请稍候。':r.stale?'结果已更新，请重新生成报告。':'当前报告 v'+r.revision+' · '+deliveryLabel(r.delivery),!r?.saved||r.stale)+`<div class="wrap">${b('扫码领取','deliver',{kind:'qr'},'primary',!r?.saved||r?.stale)}${b('打印报告','deliver',{kind:'print'},'',!r?.saved||r?.stale)}</div>`+(r?.delivery==='code-ready'?'<div class="empty section">领取码示意 · 暂不支持扫码<br><small></small></div>':'')+info('领取码过期或打印失败时，可重新领取。')+`<div class="wrap">${b('返回报告','report')}</div>`;}
const criteria={I1:'能否独立或在适当协助下正确完成？',I2:'是否增加无意义的操作、走动、等待或姿势重置？',I3:'误触、返回、失败和重测后，数据及所在步骤是否正确？',C1:'能否说清本页得到什么信息，哪些仍未获得？',C2:'是否误把示意、缺测、未评级当成真实结果或正常？',C3:'关键发现与完整证据的关系是否清楚？',G1:'是否知道该做什么身体动作，提示在站位处可达？',G2:'能否区分准备、采集、调整和真正结束？',G3:'失败后知道由谁、如何恢复吗？',L1:'能否带走正确记录及报告版本？',L2:'是否能正确查询和比较同一人的记录？',L3:'是否支持机构服务衔接？',E1:'身体与风险表达是否尊重受测者？',E2:'是否理解系统能做与不能做的事？',E3:'换人、退出与报告领取是否保护个人资料？',VIS1:'能否找到正确操作、读数与部位？',VIS2:'字体与目标在实际设备距离是否可辨？本版待实机。',VIS3:'语义、单位、多语言与跨型号是否一致？',B1:'是否形成可记住的独特体验？高保真阶段验证。',B2:'是否传达约定的气质？高保真阶段验证。',M1:'状态与对象关系是否连续？本版仅验证逻辑。',M2:'反馈是否及时、是否混淆等待与进度？',M3:'运动与身体舒适度待实际速度和设备验证。'};
function roleQuestion(){return ({self:'首次受测：我能知道从哪里开始、现在做什么、何时结束吗？',repeat:'复测会员：能查看本次结果、补测或重测，并保留已有记录吗？',operator:'操作者：能在合适的位置协助开始、停止和恢复，而不打断身体任务吗？',professional:'解读者：数据来源、单位、缺项与解释依据是否能正确对应？',admin:'管理者：配置、权限、外设、记录及维护边界是否清楚？'})[state.role];}
function effectiveSpec(id){const base=spec(id);return base&&singleBody()&&base.singleBody?{...base,...base.singleBody}:base;}
function inspector(id){const x=effectiveSpec(id);if(!x)return '';const q=C.issues.find(q=>q.id===x.issue);return (reviewActions?`<section><h3>服务状态模拟</h3><div class="wrap">${reviewActions}</div></section>`:'')+(productNotes.length?`<section><h3>原型范围与待确认项</h3>${list([...new Set(productNotes)])}</section>`:'')+`<section><div class="eyebrow">PAGE CONTRACT</div><h3>${esc(x.name)}</h3><p class="code">${esc(x.id)}</p><p class="info"><strong>本版实现范围</strong><br>${esc(x.prototypeScope)}</p><p><strong>本页核心价值</strong><br>${esc(x.value)}</p><h4>必须存在的信息与功能</h4>${list(x.fields)}<h4>可执行动作</h4>${list(x.actions)}<h4>应覆盖的状态</h4>${list(x.states)}<h4>入口与出口</h4><p>${esc(x.entry)}<br>${esc(x.exit)}</p><h4>相对旧方案的改进</h4><p>${esc(x.improve)}</p><p>${x.legacy.map(v=>badge(v)).join(' ')}</p></section><section><h3>角色价值核查</h3><p class="info">${esc(roleQuestion())}</p><p>${esc(x.roles.join(' / '))}</p>${x.criteria.map(k=>`<div class="criteria-item"><strong>${esc(k)}</strong> ${esc(criteria[k]||'见角色价值标准')}</div>`).join('')}${refs(['value'])}</section>${q?`<section><h3>仍待确认 · ${esc(q.id)}</h3><p>${esc(q.detail)}</p><p><strong>收口条件：</strong>${esc(q.close)}</p></section>`:''}<section><h3>依据与回看</h3>${refs(x.refs)}</section><section><h3>给这一页反馈</h3><form data-form="feedback"><label>记录功能遗漏、去向或理解问题<textarea name="note" placeholder="例如：从部分结果返回 Home 后，我期待……" required></textarea></label><input type="hidden" name="page" value="${esc(id)}"><button type="submit" class="primary" style="margin-top:10px">保存本机反馈</button></form><small>保存在当前浏览器，可从“待核与评审”导出。</small></section>`;}
function bloodPressureReview(){
 if(!E.allowed(state,'bp')||(state.pendingTest!=='bp'&&!state.route.endsWith('/bp')))return '';
 const phase=state.acq?.bp?.phase;
 return `<fieldset class="bp-review"><legend>血压设备事件（演示）</legend><div class="wrap">
   ${!state.acq?b(state.bpTelemetry===false?'仅设备状态':'过程压力可用','bp-telemetry',{},'small'):''}
   ${!state.acq&&['prepare/bp','prerequisites'].includes(state.route)?b(state.settings.peripherals.cuff?'模拟袖带断开':'模拟袖带连接','connect',{id:'cuff',value:!state.settings.peripherals.cuff},'small'):''}
   ${['connecting','waiting','measuring'].includes(phase)&&!state.stop?b('未取得有效读数','bp-device',{event:'no-reading'},'small'):''}
   ${phase==='saving'?b('模拟保存失败','bp-device',{event:'save-failed'},'small'):''}</div></fieldset>`;
}
function motionReview(){
 const active=state.acq;
 if(active?.pose?.detecting&&!state.stop&&state.route==='measure/posture'){
   return '<fieldset class="motion-review"><legend>人体识别事件（模拟）</legend>'+
     b('确认识别到人体','posture-detected',{acqId:active.id,participantId:state.user.id,view:active.pose.view},'small')+'</fieldset>';
 }
 const q=state.acq?.motion;
 if(!q||state.stop||state.route==='recovery')return '';
 const choices=[];
 if((!automaticDemo||!routeReview)&&MOTION_FLOW.demoNext(q))choices.push(['下一步设备事件','next']);
 if(q.id==='balance'&&q.phase==='holding')choices.push(['提前落脚','foot-down'],['追踪丢失','tracking-lost']);
 if(q.id==='shoulder'&&q.phase==='raising'||q.id==='pushups'&&q.phase==='repeating')choices.push(['追踪丢失','tracking-lost']);
 if(q.id==='jump'&&q.phase==='landing')choices.push(['本次落地无效','landing-invalid']);
 if(q.id==='scan360'&&q.phase==='release')choices.push(['影像无效','image-invalid']);
 return choices.length?'<fieldset class="motion-review"><legend>动作设备事件（模拟）</legend><div class="wrap">'+
   choices.map(([label,event])=>b(label,'motion-sim',{event},'small')).join('')+'</div></fieldset>':'';
}
function simulator(){
 const a=oxygenPage()?null:state.acq,r=state.report;
 const inCapture=a&&a.kind!=='group'&&!state.stop&&state.route!=='recovery';
 const manual=!automaticDemo||!routeReview;
 const manualAccessory=inCapture&&manual&&a.accessory?E.accessoryDemoEvent(state):null;
 const nextDevice=inCapture&&manual&&!a.screen&&!a.motion&&!a.accessory&&!a.ropeStartedAt&&!a.pose?.detecting&&!a.pose?.waiting&&(!a.bp||E.bpDemoEvent(state));
 const atReport=state.route==='report',atDelivery=state.route==='delivery';
 const printing=atDelivery&&r?.delivery==='printing',codeReady=atDelivery&&r?.delivery==='code-ready';
 const scenarios=routeReview?[
   b('首次测量','home-scenario',{kind:'first'},'small'),
   b('部分已测与补测','home-scenario',{kind:'mixed'},'small'),
   b('全部已测与报告','home-scenario',{kind:'complete'},'small'),
 ].join(''):[
   b('载入部分完成首页','seed-scenario',{kind:'partial'},'small'),
   b('载入全部已测首页','seed-scenario',{kind:'complete'},'small'),
   b('载入补测接续样例','walk-scenario',{},'small'),
   b('必测前置 · 点选末项','mandatory-scenario',{},'small'),
   b('末项完成 · 回查未测','wrap-scenario',{},'small'),
   b('载入三项目计划','scope-scenario',{},'small'),
   b('组合测量 · 并行模拟','group-scenario',{mode:'parallel'},'small'),
   b('组合测量 · 顺序模拟','group-scenario',{mode:'sequential'},'small'),
 ].join('');
 const pair=b('载入体成分与血压双项样例','group-scenario',{mode:'parallel',scope:'pair'},'small');
 const group=E.allowed(state,'body')&&E.allowed(state,'bp')&&(!state.acq||state.acq.kind==='group')?
   (routeReview?`<details class="review-extra" ${state.route.startsWith('group-')?'open':''}><summary>组合测量试验</summary>${groupSimulator()}${!state.acq?pair:''}</details>`:groupSimulator()+pair):'';
 return `<details id="demo-controls" class="review-panel" lang="zh-CN" open>
 <summary>演示控制</summary>
 <p class="compact">用虚构数据检验流程与异常状态。</p>
 <label class="demo-mode"><input type="checkbox" data-action="auto-demo" ${automaticDemo?'checked':''}>自动模拟设备回执</label>
 ${oxygenPage()&&oxygenHost?oxygenHost.controls(state):''}${bloodPressureReview()}${motionReview()}
 <div class="wrap">
 ${nextDevice?b('发送下一条设备回执','advance',{},'small primary'):''}
 ${manualAccessory?b(({sample:'发送下一条采样读数',released:'确认采集结束',saved:'确认结果保存'})[manualAccessory.event],
   'accessory-event',{event:manualAccessory.event,value:manualAccessory.value,acqId:a.id,participantId:state.user.id},'small primary'):''}
 ${inCapture&&!a.bp?b('模拟采集失败','fail',{reason:'未检测到稳定信号，请检查姿势与设备连接。'},'small'):''}
 ${a&&state.stop?.requested?b('确认停止与解除','stopped',{released:true},'small primary')+b('模拟停止确认超时','stop-timeout',{},'small'):''}
 ${['history','compare'].includes(state.route)?b('载入两条虚构历史','seed-history',{},'small'):''}
 ${atReport&&r?.stage==='generating'?(manual?b('确认报告生成','report-generated',{},'small primary'):'')+b('模拟报告生成失败','report-fail',{stage:'generation-failed'},'small'):''}
 ${atReport&&r?.stage==='generated'?(manual?b('确认报告保存','report-save',{},'small primary'):'')+b('模拟报告保存失败','report-fail',{stage:'save-failed'},'small'):''}
 ${printing||codeReady?b('确认报告已领取','delivered',{},'small primary'):''}
 ${printing?b('模拟打印失败','delivery-fail',{kind:'print'},'small'):''}
 ${codeReady?b('模拟领取码过期','delivery-fail',{kind:'qr'},'small'):''}
 ${!state.acq?b(state.admin?'管理权限已模拟':'模拟管理授权','admin',{},'small',state.admin):''}
 ${!state.acq&&!state.privacyLocked&&state.route!=='standby'?b('模拟无人操作超时','timeout',{},'small'):''}
 </div>
 <div class="wrap">${scenarios}${b('重置当前演示','reset-demo',{},'small')}</div>
 ${group}
 <details class="review-extra"><summary>最近状态事件 · ${state.events.length} 条</summary>
 <pre class="scroll-pre">${esc(state.events.slice(-10).map(e=>e.at.slice(11,19)+' '+e.event+' '+e.detail).join('\n'))}</pre></details>
 </details>`;
}
function sidebar(){return `<nav class="sidebar" aria-label="页面结构">${P.groups.map(([g,label])=>`<details ${['entry','session','read'].includes(g)?'open':''}><summary>${label}</summary>${P.pages.filter(p=>p.group===g&&!p.id.includes('/')&&!p.reviewOnly).map(p=>b(p.name,'inspect',{id:p.id},'nav-item '+(inspect===p.id?'active':''))).join('')}${g==='test'?C.visibleTests.map(t=>b(t.name,'inspect',{id:'prepare/'+t.id},'nav-item')).join(''):''}</details>`).join('')}<p class="muted compact" style="font-size:11px">侧栏查看页面说明，不改变当前测量。</p></nav>`;}
function shell(){return `<header class="topbar"><div><div class="wordmark">ANOVATOR <small>G01 / v06</small></div><small class="brand-sub">全局功能与流程 · 可评审原型</small></div><div class="top-controls"><label>设备条件<select id="profile-select">${C.profiles.map(p=>`<option value="${p.id}" ${p.id===state.profileId?'selected':''}>${esc(p.name)}</option>`).join('')}</select></label><label>本次评审视角<select id="role-select">${C.roles.map(p=>`<option value="${p.id}" ${p.id===state.role?'selected':''}>${p.name}</option>`).join('')}</select></label></div></header><nav class="tabs" aria-label="原型查看方式">${[['experience','体验原型'],['map','全局地图'],['spec','页面说明'],['coverage','功能去向'],['issues','待核与评审']].map(([id,label])=>b(label,'tab',{id},tab===id?'active':'')).join('')}</nav><div class="context-strip"><span class="profile-note">${esc(profile().note)}</span><span>${C.visibleTests.length} 类任务 · ${P.pages.length} 个页面定义 · 真实设备验证待做</span></div>`;}
function renderDevice(){
 if(oxygenPage())return oxygenScreen();
 const hub=onHome(),overview=['home','results'].includes(state.route);
 const capture=directBodyCapture();
 const preparation=GN.taskLayer?.(state)==='prepare';
 const navigation=capture?'':directNavigation?GN.navigation(state,E,b,null,true):
   GN.resultBrowser?.(state,E)||preparation?resultProgress(preparation):GN.navigation(state,E,b,state.homeProject);
 const identity=!hub&&state.user&&!state.privacyLocked?`<div class="screen-identity${overview?' overview-identity':''}">${overview?'':'<span>本次测量</span>'}<span>${esc(state.user.name||state.user.id)}</span></div>`:'';
 const bodyPreparation=directNavigation&&state.route==='prepare/body';
 const notice=state.message?`<div class="message${bodyPreparation?' direct-body-notice':''}" role="status">${esc(state.message)}</div>`:'';
 const deviceClass=capture?' direct-body-capture':usesRecordedResultFooter()?' recorded-footer':'';
 return `<div class="device${deviceClass}">${GN.header(state,b)}<article class="device-main${hub?' hub-main':''}" aria-label="设备画面内容">${identity}${notice}${renderProduct()}</article><div class="device-bottom">${navigation}<div class="device-actions" aria-label="本项操作"></div><footer class="device-footer">${renderSessionFooter()}</footer></div>${projectDirectory?renderDirectory():''}</div>`;
}
function reviewVersionControl(){
 if(!routeReview||!h10Footer||!params)return '';
 const current=directNavigation?'direct':'mo';
 const options=[['mo','MO 人体导航'],['direct','层级压缩']].map(([version,label])=>{
   const url=new URL(location.href);
   if(version==='direct')url.searchParams.set('navigation','direct');
   else url.searchParams.delete('navigation');
   const href=esc(url.pathname+url.search+url.hash);
   return `<a href="${href}" data-review-version="${version}"${version===current?' aria-current="page"':''}>${label}</a>`;
 });
 return '<div class="review-versions" role="group" aria-label="导航版本">'+options.join('')+'</div>';
}
function renderExperience(){
 inspect=state.route;
 const versions=reviewVersionControl();
 return `<div class="workspace">${sidebar()}<main>${reviewNotice()}
 <div class="scenario-launcher"><p>流程体验 · 载入虚构样例</p><div class="wrap">${b('首页 · 首次','home-scenario',{kind:'first'})}${b('首页 · 部分已测','home-scenario',{kind:'mixed'})}${b('血压 · 光膜 v1','bp-scenario')}${b('血氧与脉率 · E02','oxygen-scenario')}${b('普通停止','stop-scenario',{kind:'ordinary'})}${b('设备收尾','stop-scenario',{kind:'wind-down'})}${b('多次测量','stop-scenario',{kind:'repeated'})}</div>${screenTestReview()}</div>
 <div class="screen-caption"><span>9:16 · 27寸以上触控大屏</span><div class="screen-caption-actions">${versions}<a href="${typeof location!=='undefined'&&location.protocol==='file:'?'../global-experience-v04/index.html':'/baseline/'}" target="_blank" rel="noopener" id="baseline-link">v04.11 对照 ↗</a><button type="button" data-screen-action="enter">全屏体验</button></div></div>
 <div class="fullscreen-tools" aria-label="触控体验工具"><span id="screen-mode-label">触控体验</span>${versions}<button type="button" data-screen-action="controls" lang="zh-CN" aria-controls="demo-controls" aria-expanded="false">演示控制</button><button type="button" data-screen-action="exit">退出全屏</button></div>
 <div class="device-stage"><div class="device-viewport">${renderDevice()}</div></div>
 <p class="screen-note">模拟测量与停止响应，不连接真实设备。数值为样例；资料已预填，自动测高与称重随体成分完成。</p>${simulator()}</main><aside class="aside">${inspector(inspect)}</aside></div>`;
}
function renderPagesDemo(){
 const fast=state.settings.demoBodySpeed===4;
 return `<div class="workspace"><main class="pages-layout">
 <div class="screen-caption"><span>ANOVATOR P Series · Interactive demo</span></div>
 <button type="button" class="pages-fullscreen-button" data-screen-action="enter">Full screen</button>
 <div class="fullscreen-tools" aria-label="Display controls"><button type="button" data-screen-action="controls" lang="zh-CN" aria-controls="demo-controls" aria-expanded="false">演示控制</button><button type="button" data-screen-action="exit">Exit full screen</button></div>
 <div class="device-stage"><div class="device-viewport">${renderDevice()}</div></div>
 <p class="screen-note">${['standby','identity'].includes(state.route)?'Enter any number to try the demo. ':''}Simulated measurements only.</p>
 <section id="demo-controls" class="review-panel pages-demo-controls" lang="zh-CN" aria-labelledby="pages-demo-heading">
 <h2 id="pages-demo-heading">演示控制</h2>
 <div class="pages-demo-options">
 <label><input type="checkbox" data-action="demo-body-required" ${E.bodyRequired(state)?'checked':''} ${demoRequirementLocked()?'disabled':''}>体成分必测</label>
 <label>体成分进度 <select data-demo-body-speed><option value="1">原速</option><option value="4" ${fast?'selected':''}>4× 加速</option></select></label>
 ${canFinishDemoCapture()?b('跳过等待，查看结果','demo-finish-body',{},'small'):''}
 </div></section>
 </main></div>`;
}
function scaleDevice(){const viewport=$('.device-viewport'),device=$('.device');if(!viewport||!device)return;device.style.transform='scale('+(viewport.getBoundingClientRect().width/540)+')';const link=$('#baseline-link');if(link&&typeof location!=='undefined')link.href=location.protocol==='file:'?'../global-experience-v04/index.html':location.protocol+'//'+location.host+'/baseline/';}
window.addEventListener('resize',scaleDevice);

function renderMap(){return `<main class="full"><div class="eyebrow">EXPERIENCE ARCHITECTURE</div><h1>同一套体验，按能力生长</h1><p class="lead">型号决定可用能力，已选项目决定测哪些，结果与报告保留真实完成状态。这里把配置、会话、采集和解读放在同一张图上审视。</p><div class="flow-band">${[['01','进入与确认','用途、身份、资料与同意'],...(singleBody()?[]:[['02','本次评估','能力可见 · 单测 / 全测 / 续测']]),['03','身体任务','准备 → 采集 → 质量 / 恢复'],['04','结果阅读','已完成、缺项与重测'],['05','结束本次测量与报告','结束本次测量 → 生成 → 保存 → 领取 → 换人']].map(([num,name,desc],i)=>`<div class="flow-step"><div class="num">${String(i+1).padStart(2,'0')}</div><h3>${name}</h3><p>${desc}</p></div>`).join('')}</div>${info(singleBody()?'本机只启用体成分：确认身份与必要资料后直达准备，无Home或项目安排。有效完成停留结果，结束本次测量才生成报告。':'多功能设备用Home安排范围；组合仍是两个项目、一次身体任务。准备与结果均可从项目导航跳转；有效完成停留结果，结束本次测量才生成报告。')}<div class="map-grid">${P.groups.map(([g,label])=>`<section class="map-group"><h3>${label}</h3>${P.pages.filter(p=>p.group===g&&!p.id.includes('/')&&!p.reviewOnly).map(p=>`<div class="row"><span>${esc(p.name)}<small>${esc(p.id)}</small></span>${b('查看','inspect',{id:p.id},'small')}</div>`).join('')}</section>`).join('')}</div><section class="section"><h2>采集任务 · 共享框架，各有专属条件</h2><div class="map-grid">${C.visibleTests.map(x=>`<section class="map-group"><div class="wrap">${badge(active().includes(x.id)?'本配置启用':profile().pending.includes(x.id)?'配置待核':'参考库保留',active().includes(x.id)?'ok':'warn')}</div><h3 style="margin-top:12px">${esc(x.name)}</h3><p class="muted" style="font-size:13px">${esc(x.value)}</p><div class="wrap">${['prepare','measure','result'].map((a,i)=>b(['准备','采集','结果'][i],'inspect',{id:a+'/'+x.id},'small')).join('')}</div></section>`).join('')}</div></section></main>`;}
function renderSpec(){const x=effectiveSpec(inspect)||P.pages[0];return `<main class="inspector-only"><div><div class="eyebrow">PAGE ${esc(x.id)}</div><h1>${esc(x.name)}</h1><p class="lead">${esc(x.value)}</p><div class="review-status"><strong>页面定义与可执行范围</strong><p>下方可装载虚构场景检查功能位置。此操作会重置当前演示会话；功能协议与未知字段仍按待核清单处理。</p>${b('装载这一页的演示','preview-page',{id:x.id},'primary')}</div><div class="map-group"><h3>相关页面</h3><div class="wrap">${P.pages.filter(p=>p.group===x.group&&p.id!==x.id&&!p.reviewOnly).map(p=>b(p.name,'inspect',{id:p.id},'small')).join('')}</div></div></div><aside class="aside">${inspector(x.id)}</aside></main>`;}
function renderCoverage(){const rows=(ANOVATOR_COVERAGE||[]).filter(x=>(x.id+' '+x.title+' '+x.unknown).toLowerCase().includes(search.toLowerCase()));return `<main class="full"><div class="eyebrow">SOURCE → FUNCTION → PAGE</div><h1>既有功能在哪里继续</h1><p class="lead">35 组最新功能底账，加 14 组异常与扩展线索。每组列出原始证据、新去向和未闭合规则。“已映射”只表示没有默默丢弃，不表示真实功能已实现。</p><label style="max-width:450px;margin:20px 0">查找功能 / 原编号<input id="coverage-search" value="${esc(search)}" placeholder="例如 F03、报告、肩关节"></label><p>${rows.length} / ${ANOVATOR_COVERAGE.length} 条 · 原录屏 26 组、61 个已见状态，45 张截图；这些数量不等于最终页面数。</p><div class="table-wrap"><table><thead><tr><th>原功能与证据</th><th>新原型去向</th><th>保留价值 / 改进</th><th>仍需核实</th></tr></thead><tbody>${rows.map(r=>`<tr><td style="min-width:220px"><strong>${esc(r.id)} · ${esc(r.title)}</strong><p class="code">${esc(r.images||'扩展资料线索')}<br>${esc(r.video||'')}</p><details><summary>原始状态摘要</summary><div class="scroll-pre">${esc(r.states||r.evidence_limit||'')}</div></details></td><td style="min-width:230px">${r.destinations.filter(C.isRouteVisible).map(id=>b(spec(id)?.name||id,'inspect',{id},'small')).join('')}<p>${badge(r.destinations.length?'已映射；含待核':'尚未映射',r.destinations.length?'ok':'alert')}</p></td><td style="min-width:250px">${esc(r.improvement)}</td><td style="min-width:260px">${esc(r.unknown)}<p>${refs(r.refs)}</p></td></tr>`).join('')}</tbody></table></div></main>`;}
function renderIssues(){return `<main class="full"><div class="eyebrow">REVIEW & DECISIONS</div><h1>先验证全局成立，再逐页精修</h1><p class="lead">本轮判断功能是否齐、路径是否完整、数据归属是否可信。品牌气质、视觉密度、动效和实机表现继续由各专项验证，不能从这个骨架得出通过结论。</p><div class="flow-band">${[['首次自助','从待机完成一项，理解结果与结束'],['连续评估','体成分先完成；之后自由选项，接续回查未测项'],['复测 / 解读','查看本次结果，重测保留已有记录'],['管理 / 交接','配置差异、离线、报告失败与换人']].map(([a,b])=>`<div class="flow-step"><h3>${a}</h3><p>${b}</p></div>`).join('')}</div><div class="wrap">${b('导出本机评审记录','export-feedback',{},'primary')}${b('导出演示状态与事件','export-state')}</div><section class="section"><h2>已记录的反馈 · ${feedback.length}</h2><div class="notes-list">${feedback.map(f=>`<article><strong>${esc(spec(f.page)?.name||f.page)}</strong> · ${esc(f.profile)} · ${esc(f.role)}<p>${esc(f.note)}</p><small>${esc(f.at)}</small></article>`).join('')||'<p class="muted">从页面右侧或手机页面下方填写反馈；数据保存在当前浏览器。</p>'}</div></section><section class="section"><h2>16 组产品待核问题</h2><div class="issue-grid">${C.issues.map(q=>`<article class="issue-card"><div class="code">${esc(q.id)} / ${esc(q.area)}</div><h3>${esc(q.title)}</h3><p>${esc(q.detail)}</p><p><strong>收口条件</strong> ${esc(q.close)}</p>${refs(q.refs)}</article>`).join('')}</div></section></main>`;}
function persist(){
 try{
   sessionStorage.setItem(K,JSON.stringify(pagesRelease?{...state,identityDraft:undefined}:state));
   if(!pagesRelease){
     localStorage.setItem(FEEDBACK_K,JSON.stringify(feedback));
     localStorage.setItem(ACCOUNT_K,JSON.stringify(state.accounts||{}));
   }
 }catch{storageWarning='浏览器未允许保存，来自账号资料仅在当前会话可演示。';}
}
function enterDirectTask(){
 if(!directNavigation||!onHome()||state.acq)return;
 if(E.allowed(state,state.receiptReturn?.pendingTest)){
   run('return-to-task',{});
   return;
 }
 const next=E.next(state);
 if(next&&!canReadResult(next)){
   run('continue',{});
   return;
 }
 const recorded=next||active().filter(canReadResult).sort((a,b)=>state.results[b].revision-state.results[a].revision)[0];
 if(recorded)run('open-direct-project',{id:recorded});
 else run('open-test',{id:'body'});
}
function updateAroundOxygen(app,html,live){
 const template=document.createElement('template');
 template.innerHTML=html;
 let incoming=template.content.querySelector('[data-oxygen-mount]');
 while(live!==app){
   const parent=live.parentNode;
   if(live.classList?.contains('oxygen-screen'))live.className=incoming.className;
   while(live.previousSibling)live.previousSibling.remove();
   while(incoming.previousSibling)live.before(incoming.parentNode.firstChild);
   while(live.nextSibling)live.nextSibling.remove();
   while(incoming.nextSibling)parent.append(incoming.nextSibling);
   live=parent;
   incoming=incoming.parentNode;
 }
}
let lastRenderedRoute=null;
function render(){
 enterDirectTask();
 if(state.homeProject&&!E.allowed(state,state.homeProject))state.homeProject=null;
 if(projectDirectory&&(!GN.canOpenDirectory(state,E)||projectDirectory.route!==state.route||projectDirectory.user!==state.user?.id||tab!=='experience'))projectDirectory=null;
 oxygenHost?.beforeRender();
 const previousMotion=directMotion?.snapshot($('.device'));
 const bodyVideo=BODY?.video();
 const pressureMotion=readBloodPressureMotion();
 const readingPosition=restoredReading;
 const previousScroll=readingPosition?.scrollTop??(lastRenderedRoute===state.route?($('.device-main')?.scrollTop||0):0);
 restoredReading=null;
 persist();
 const app=$('#app'),oxygenMount=$('[data-oxygen-mount]');
 const html=pagesRelease?renderPagesDemo():shell()+({experience:renderExperience,map:renderMap,spec:renderSpec,coverage:renderCoverage,issues:renderIssues}[tab]||renderExperience)()+`<footer class="footnote">${C.version} · ${C.date} · 本地运行，无外部脚本依赖。请仅输入虚构资料。功能映射／模拟链路与真实设备、算法、合规及用户验收分别记录。刷新保留本标签页演示状态；体成分有效完成后，结束本次测量进入报告生成；完成交接后清除本次资料，手填身高仍保存在本浏览器虚构账号中。</footer>`;
 if(tab==='experience'&&oxygenHost?.canRetain(oxygenMount)){
   for(const [element,inert] of projectDirectory?.masked||[])element.inert=inert;
   updateAroundOxygen(app,html,oxygenMount);
 }else app.innerHTML=html;
 const actions=$('.device-main .task-actions'),slot=$('.device-actions');
 if(slot){slot.hidden=!actions;if(actions)slot.append(actions);}
 scaleDevice();
 setupReceiptRail();
 GN.mount(state,E);
 const cameraArt=$('[data-preview-fallback]');
 if(cameraArt)cameraArt.addEventListener('error',()=>{
   cameraArt.closest('.hub-preview').classList.remove('hub-preview--camera');
   cameraArt.src=cameraArt.dataset.previewFallback;
 },{once:true});
 oxygenHost?.sync($('[data-oxygen-mount]'));
 BODY?.sync(state,act,bodyVideo);
 POSTURE?.sync();
 ROPE?.sync(state,act,automaticDemo);
 MOTION_RUNTIME?.sync(state);
 playBloodPressureMotion(pressureMotion);
 const content=$('.device-main');
 if(content){
   if(readingPosition?.details)content.querySelectorAll('details').forEach((el,i)=>{el.open=!!readingPosition.details[i];});
   content.scrollTop=previousScroll;
 }
 if(readingPosition)$(directNavigation?'.receipt-item[aria-current="page"]':'[data-result-directory="results"]')?.focus({preventScroll:true});
 if(restorePreviewFocus){$(restorePreviewFocus)?.focus({preventScroll:true});restorePreviewFocus=null;}
 mountProjectDirectory();
 syncHomeCamera();
 lastRenderedRoute=state.route;
 window.ANOVATOR_SCREEN?.sync();
 demoDriver?.sync();
 globalThis.ANOVATOR_SCREEN_TEST_RUNTIME?.sync(state,act);
 directMotion?.sync($('.device'),state,previousMotion);
}
function run(action,payload){
 if(pagesRelease&&action==='identity'){
   if(!/^[0-9]+$/.test(String(payload?.id??''))){state.message='Enter any digits to continue.';return;}
   payload={id:'DEMO-PARTICIPANT',name:'Demo participant'};
 }
 if(pagesRelease&&action==='profile'){
   payload={age:DEMO.age,sex:DEMO.sex,...(!H.automatic(state)?{height:DEMO.height}:{})};
 }
 if(pagesRelease&&action==='basics')payload={height:DEMO.height};
 if(directNavigation&&action==='start-measure'&&(payload?.id||state.pendingTest)==='posture'){
   payload={...payload,postureDetection:true};
 }
 if(directNavigation&&(['skip','skip-stopped'].includes(action)||action==='screen-input'&&payload?.op==='skip-attempt')){
   payload={...payload,natural:true};
 }
 if(directNavigation&&action==='open-direct-project'&&!onHome()&&canReadResult(payload.id)){
   if(state.readingReturn?.route==='result/'+payload.id)action='return-reading';
   else payload={...payload,resultViewport:{scrollTop:$('.device-main')?.scrollTop||0,
     details:Array.from(document.querySelectorAll('.device-main details'),el=>el.open)}};
 }
 const origin=action==='return-reading'?state.readingReturn:null;
 const resumedFromRail=directNavigation&&action==='open-direct-project'&&payload.id===state.receiptReturn?.pendingTest&&!canReadResult(payload.id);
 const task=action==='return-to-task'||resumedFromRail?state.receiptReturn:null;
 const returningToPreview=action==='return-to-preview'&&E.viewedFromPreview(state);
 if(directNavigation&&action==='fill-test'&&state.route==='result/'+payload.id&&sessionRecord(payload.id)?.partial){
   action='prepare-planned-test';payload={...payload,direct:true};
 }
 if(action==='preview-project'&&state.route==='result/'+payload.id)lastHomeProject=null;
 E.dispatch(state,action,payload);
 if(returningToPreview&&onHome())restorePreviewFocus='.hub-preview .hub-inline';
 if(origin?.resultBrowser&&state.route===origin.route&&state.readingReturn!==origin)
   restoredReading=origin.resultBrowser;
 if(task?.viewport&&state.route===task.route&&state.receiptReturn!==task)
   restoredReading=task.viewport;
 if(action==='identity'&&state.route==='consent')delete state.identityDraft;
 if(action==='cancel-identity-edit'||state.route==='standby')delete state.identityDraft;
 // The demo supplies measurements for this attempt; no separate reviewer clicks.
 // Completion still requires the body-composition completion event.
 if(['start-measure','start-group'].includes(action)&&state.acq&&['measure/body','group-measure'].includes(state.route)){
   if(H.automatic(state)&&state.height.status==='acquiring')E.dispatch(state,'height-event',{event:'valid',value:DEMO.height,attempt:state.height.attempt});
   if(W.init(state).status==='acquiring')E.dispatch(state,'weight-event',{event:'valid',value:DEMO.weight,attempt:state.weight.attempt});
 }
}
function screenTestReview(){
 const entries=SF.ids.map(id=>b(t(id).name,'screen-preview',{id},'small')).join('')+b('路由评审 · 单眼已测','home-scenario',{kind:'routing'},'small');
 const setting=state.profileId==='all'&&!state.acq
   ?'<label class="demo-mode"><input type="checkbox" data-action="screen-adjustment" '+(state.reviewAstigmatismAdjustment?'checked':'')+'>散光调节状态（模拟）</label>':'';
 const examiner=state.profileId==='all'&&state.role==='operator'&&!state.acq
   ?'<label class="demo-mode"><input type="checkbox" data-action="examiner-vision" '+(state.reviewExaminerVision?'checked':'')+'>视力 C／P／E 工作人员判分（模拟）</label>':'';
 const direction=state.stop||state.route!=='measure/vision'?'':SUI.directionControl(state.acq,b);
 return '<details class="review-panel"><summary>四项屏幕测量 · 全能力评审入口</summary><div class="wrap">'+entries+'</div>'+setting+examiner+'</details>'+direction;
}
function seedResult(id){
 if(!E.allowed(state,id))return;
 if(id!=='body'&&!E.mandatoryReady(state))seedResult('body');
 run('open-test',{id});if(state.route==='profile')run('profile',{age:30,sex:'female'});if(state.route==='prerequisites')run('basics',{height:174});
 run('start-measure',{id});
 if(id==='oxygen'&&state.acq?.testId==='oxygen'){
   const receipt={acqId:state.acq.id,participantId:state.user.id};
   run('oxygen-release',{...receipt,pair:{oxygen:98,pulse:72}});run('oxygen-record',receipt);
 }else{
   if(id==='body')run('weight-event',{event:'valid',value:68.4,attempt:state.weight.attempt});
   if(id==='body'&&H.automatic(state))run('height-event',{event:'valid',value:174,attempt:state.height.attempt});
   let limit=20;
   while(state.acq&&limit-->0){
     const {id:acqId,pose}=state.acq;
     if(pose?.detecting)run('posture-detected',{acqId,participantId:state.user.id,view:pose.view});
     else if(pose?.requiresDetection&&pose.waiting)run('posture-start-view',{});
     else run('advance',{});
   }
 }
 state.completedResultRevision=null;
}
function baseSeed(){resetReview();run('identity',{id:'DEMO-001',name:'演示受测者'});state.consent=true;state.basics={age:30,sex:'female',height:null,weight:null};if(!H.automatic(state))H.manual(state,174);state.mode='single';}
function loadHomeScenario(kind){
 resetReview('all');
 baseSeed();
 state.scopeMode=kind==='first'?'free':'selected';
 state.plan=kind==='first'?[]:kind==='routing'?['body','bp','vision']:['body','bp','oxygen','posture'];
 if(kind==='complete'){
   state.plan=active();
   state.plan.forEach(seedResult);
 }else if(['mixed','routing','recorded'].includes(kind)){
   seedResult('body');
   seedResult('bp');
 }
 if(kind==='recorded'){
   seedResult('oxygen');
 }else if(kind==='mixed'){
   run('open-test',{id:'oxygen'});
   run('skip');
 }else if(kind==='routing'){
   run('fill-test',{id:'vision'});
   run('screen-position',{id:'vision'});
   run('start-measure',{id:'vision'});
   run('advance');
   run('advance');
   const a=state.acq;
   if(a?.screen?.phase==='switch')run('screen-input',{op:'skip-eye',acqId:a.id,seq:a.screen.seq});
   state.completedResultRevision=null;
 }
 run('navigate',{page:'home'});
 tab='experience';
}
function loadThreeTestSession(kind){
 resetReview('all');baseSeed();
 state.scopeMode='selected';
 state.plan=['body','bp','posture'];
 if(kind==='title-review'||kind==='session-progress')seedResult('body');
 if(kind==='session-progress'){
   run('continue');
   run('skip');
   run('navigate',{page:'result/body'});
 }else run('home');
}
function loadScreenShowcase(id,{examiner=false}={}){
 resetReview('all');baseSeed();
 state.plan=['body',...SF.ids];state.scopeMode='selected';
 if(examiner){state.role='operator';state.reviewExaminerVision=true;}
 seedResult('body');
 if(SF.uses(id))run('open-test',{id});else run('home');
 tab='experience';state.message='';
}
function loadPreview(id){
 baseSeed();const [kind,taskId]=id.split('/');
 if(taskId){if(!E.allowed(state,taskId)){state.pendingTest=taskId;state.route='unavailable';}else if(kind==='result'){seedResult(taskId);state.route=id;}else{if(taskId!=='body')seedResult('body');run('open-test',{id:taskId});if(kind!=='prepare'){run('start-measure',{id:taskId});}}}
 else{
  if(['results','metric','health','segments','report','report-preview','delivery','end','posture-summary'].includes(id)){if(id==='posture-summary'&&E.allowed(state,'posture'))seedResult('posture');else seedResult('body');}
  if(['history','history-record','compare'].includes(id)){run('seed-history');if(id==='history-record')run('record',{id:state.history[0].id});}
  if(['report','report-preview','delivery'].includes(id)){run('end');if(id!=='report'){run('generate-report',{template:'standard'});run('report-generated');if(id==='delivery')run('report-save');}}
  if(['stop','recovery','prerequisites'].includes(id)){state.plan=active();run('open-test',{id:'body'});if(id==='prerequisites'){state.basics.height=null;state.height.record=null;state.basics.weight=null;state.settings.height='manual-review';state.settings.weight='auto';run('open-test',{id:'body'});}else{run('start-measure',{id:'body'});if(id==='stop')run('stop');if(id==='recovery')run('fail',{reason:'接触不良，请检查电极接触'});}}
  if(id==='plan')run('plan');
  if(['group-prepare','group-measure','group-result'].includes(id)){resetReview('p3');baseSeed();state.plan=active();run('review-combination',{mode:'parallel'});run('start-plan');if(id!=='group-prepare'){for(const key of ['cuff','feet','handles'])run('group-ready',{id:key});run('start-group');if(id==='group-result'){run('weight-event',{event:'valid',value:68.4,attempt:state.weight.attempt});for(const key of ['body','bp'])run('group-event',{id:key,event:'valid'});run('group-release');}}}
  if(spec(id)?.group==='manage')state.admin=true;if(id==='locked'){state.admin=false;state.privacyLocked=true;}
  if(id==='standby'){resetReview();}
  else if(['home','results'].includes(id))run('navigate',{page:id});
  else if(!['plan','stop'].includes(id))state.route=id;
 }
 tab='experience';state.message='';
}
function loadBloodPressureScenario(){
 resetReview('p3');baseSeed();seedResult('body');run('open-test',{id:'bp'});tab='experience';state.message='';
}
function loadOxygenScenario(){
 resetReview('p3');baseSeed();seedResult('body');run('open-test',{id:'oxygen'});tab='experience';state.message='';
}
function loadStopScenario(kind){
 resetReview(kind==='repeated'?'p5cn':'p3');baseSeed();state.plan=active();
 if(kind==='ordinary')run('open-test',{id:'body'});
 else {seedResult('body');if(kind==='repeated'){seedResult('grip');run('retest',{id:'grip',view:'right',returnRoute:'result/grip'});}else run('open-test',{id:'bp'});}
 tab='experience';state.message='';
}
function download(name,data){const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function mountProjectDirectory(){
 const device=$('.device'),directory=projectDirectory;
 if(!device||!directory)return;
 if(!$('.project-directory'))device.insertAdjacentHTML('beforeend',renderDirectory());
 if(!device.classList.contains('has-project-directory')){
   directory.masked=Array.from(device.children)
     .filter(el=>!el.classList.contains('project-directory'))
     .map(el=>[el,el.inert]);
   for(const [el] of directory.masked)el.inert=true;
   device.classList.add('has-project-directory');
 }
 const list=$('.directory-viewport'),filter=directory.filter;
 list.scrollTop=directory.scroll[filter];
 list.addEventListener('scroll',()=>{directory.scroll[filter]=list.scrollTop;});
 const hint=$('.directory-scroll-hint');
 if(hint)hint.hidden=list.scrollHeight<=list.clientHeight;
 homeCameraView?.cover(true);
}
function unmountProjectDirectory(){
 const directory=projectDirectory;
 projectDirectory=null;
 if(!directory)return;
 $('.project-directory')?.remove();
 $('.device')?.classList.remove('has-project-directory');
 for(const [element,inert] of directory.masked||[])element.inert=inert;
 homeCameraView?.cover(false);
}
function openProjectDirectory(mode='catalog'){
 if(projectDirectory||!GN.canOpenDirectory(state,E))return;
 if(mode==='results'&&!canBrowseRecorded())return;
 if(mode==='tasks'&&(!GN.resultBrowser?.(state,E)||reviewResultBack()))return;
 if(!['catalog','results','tasks'].includes(mode))return;
 projectDirectory={
   route:state.route,user:state.user.id,mode,filter:'all',scroll:{all:0,recorded:0},
   contentTop:$('.device-main')?.scrollTop||0,railLeft:$('.receipt-list')?.scrollLeft||0
 };
 if(mode==='results')projectDirectory.details=Array.from(document.querySelectorAll('.device-main details'),el=>el.open);
 if($('.device'))mountProjectDirectory();else render();
 directMotion?.openOverlay($('.project-directory'));
 $('.directory-close')?.focus({preventScroll:true});
}
function closeProjectDirectory(){
 if(!projectDirectory)return;
 const {contentTop,railLeft,mode}=projectDirectory;
 unmountProjectDirectory();
 if(!$('.device'))render();
 const main=$('.device-main'),rail=$('.receipt-list');
 if(main)main.scrollTop=contentTop;
 if(rail)rail.scrollLeft=railLeft;
 $(mode==='catalog'?'.device .all-projects':`[data-result-directory="${mode}"]`)?.focus({preventScroll:true});
}
function changeDirectoryFilter(filter){
 if(projectDirectory?.mode!=='catalog'||!['all','recorded'].includes(filter)||filter===projectDirectory.filter)return;
 projectDirectory.scroll[projectDirectory.filter]=$('.directory-viewport')?.scrollTop||0;
 projectDirectory.filter=filter;
 const overlay=$('.project-directory');
 if(overlay){
   overlay.outerHTML=renderDirectory();
   mountProjectDirectory();
 }else render();
 $(`.directory-filters [data-filter="${filter}"]`)?.focus({preventScroll:true});
}
function chooseDirectoryProject(id,prepare=false){
 if(!projectDirectory||!GN.canOpenDirectory(state,E)||!E.allowed(state,id))return;
 const {mode,contentTop,details}=projectDirectory;
 if(mode==='tasks'){
   const {pending,makeUp}=resultWork();
   if(!prepare||(!pending.includes(id)&&!makeUp.includes(id)))return;
   unmountProjectDirectory();
   act('prepare-planned-test',{id});
   return;
 }
 if(mode==='results'){
   if(!canReadResult(id))return;
   if(state.route==='result/'+id){closeProjectDirectory();return;}
   unmountProjectDirectory();
   if(state.readingReturn?.resultBrowser&&state.readingReturn.route==='result/'+id){act('return-reading');return;}
   run('view-completed',{id,resultViewport:{scrollTop:contentTop,details}});
   render();
   $('.device-bottom .result-return')?.focus({preventScroll:true});
   return;
 }
 unmountProjectDirectory();
 if(directNavigation){act('open-direct-project',{id});return;}
 run('preview-project',{id});
 render();
}
function act(action,payload={},source){
 if(['inspect','preview-page'].includes(action)&&!C.isRouteVisible(payload.id))return;
 if(pagesRelease&&action==='demo-body-required'){
   if(demoRequirementLocked())return;
   const required=!E.bodyRequired(state);
   state.settings.demoBodyRequired=required;
   if(required){
     if(state.plan.length)state.plan=active().filter(id=>id==='body'||state.plan.includes(id));
     if(state.planDraft&&!state.planDraft.ids.includes('body'))state.planDraft.ids.unshift('body');
     if(!E.mandatoryReady(state)&&state.route.startsWith('prepare/')&&state.pendingTest!=='body')
       run('open-direct-project',{id:'body'});
   }
   render();
   $('#demo-controls [data-action="demo-body-required"]')?.focus({preventScroll:true});
   return;
 }
 if(pagesRelease&&action==='demo-finish-body'){
   if(!canFinishDemoCapture())return;
   const attempt=state.acq;
   demoDriver?.clear();
   const remaining=attempt.sequence.length-attempt.sequence.indexOf(attempt.step);
   for(let index=0;index<remaining&&state.acq===attempt;index++){
     run('advance',{acqId:attempt.id});
   }
   render();
   return;
 }
 if(action==='end'&&canEndFromResult()){openDirectEnd(source);return;}
 if(action==='start-measure')MOTION_RUNTIME?.armSound(payload.id||state.pendingTest);
 if(action==='motion-sim'){
   const a=state.acq,q=a?.motion;
   if(!q||state.stop)return;
   const packet=payload.event==='next'?MOTION_FLOW.demoNext(q):payload;
   if(packet)run('motion-event',{...packet,acqId:a.id,participantId:state.user.id,version:q.version});
   render();return;
 }
 const oldRoute=state.route;
 const returnToTitle=!directNavigation&&['home','preview-home'].includes(action)&&state.walk?.homePreparation?state.walk.directTest:null;
 if(onHome())homeRailScroll=$('.gn-project-navigation .receipt-list')?.scrollLeft??homeRailScroll;
 switch(action){
   case 'directory-open':openProjectDirectory(payload.mode);return;
   case 'directory-close':closeProjectDirectory();return;
   case 'directory-session':
     if(projectDirectory?.mode==='tasks'){
       unmountProjectDirectory();
       act('preview-home');
       $('.device .gn-overview-entry')?.focus({preventScroll:true});
     }
     return;
   case 'directory-filter':changeDirectoryFilter(payload.filter);return;
   case 'directory-project':chooseDirectoryProject(payload.id,payload.prepare===true);return;
 }
 const replaces=['home-scenario','bp-scenario','oxygen-scenario','stop-scenario','preview-page','screen-preview','seed-scenario','scope-scenario','group-scenario','walk-scenario','wrap-scenario','mandatory-scenario','reset-demo','switch-profile'];
 if(action==='cancel-review'){reviewConfirm=null;render();return;}
 if(action==='confirm-review'){const next=reviewConfirm;reviewConfirm=null;if(next)act(next.action,{...next.payload,confirmed:true});return;}
 if(replaces.includes(action)&&!payload.confirmed&&(state.user||state.acq||valid())){reviewConfirm={action,payload};tab='experience';render();window.scrollTo(0,0);return;}
 if(action==='auto-demo'){
   automaticDemo=!automaticDemo;render();
   $('#demo-controls [data-action="auto-demo"]')?.focus({preventScroll:true});
   return;
 }
 if(action==='body-get-ready'){
    if(showsBodyIntroduction()){
      (state.localTasks??={}).bodyIntroReady=true;
      state.message='';
      render();
    }
    return;
 }
  if(action==='body-guide'){
    if(state.route==='prepare/body'&&BODY?.chooseGuide(state,payload))render();
    return;
  }
 if(action==='screen-adjustment'){if(state.profileId==='all'&&!state.acq)state.reviewAstigmatismAdjustment=!state.reviewAstigmatismAdjustment;render();return;}
 if(action==='examiner-vision'){if(state.profileId==='all'&&state.role==='operator'&&!state.acq)state.reviewExaminerVision=!state.reviewExaminerVision;render();return;}
 if(action==='switch-profile'){resetReview(payload.id);inspect='standby';render();return;}
 if(action==='scroll-completed'){const rail=$('.receipt-list');if(rail)rail.scrollBy({left:payload.direction*rail.clientWidth*.8,behavior:'auto'});return;}
 if(action==='tab')tab=payload.id;
 else if(action==='inspect'){inspect=payload.id;tab='spec';}
 else if(action==='preview-page'){loadPreview(payload.id);}
 else if(action==='home-scenario'){
   loadHomeScenario(payload.kind);
   if(directNavigation)run('open-direct-project',{id:'body'});
 }
 else if(action==='screen-preview'){loadScreenShowcase(payload.id);}
 else if(action==='bp-scenario'){loadBloodPressureScenario();}
 else if(action==='oxygen-scenario'){loadOxygenScenario();}
 else if(action==='bp-telemetry'){if(!state.acq)state.bpTelemetry=state.bpTelemetry===false;}
 else if(action==='bp-device'){if(state.acq?.bp)run('bp-event',{...payload,acqId:state.acq.id,participantId:state.user.id});}
 else if(action==='stop-scenario'){loadStopScenario(payload.kind);}
 else if(action==='seed-scenario'){baseSeed();state.plan=active();(payload.kind==='partial'?active().slice(0,1):active()).forEach(seedResult);run('home');tab='experience';}
 else if(action==='scope-scenario'){resetReview('p3');baseSeed();seedResult('body');state.plan=['body','bp','oxygen'];run('start-plan');tab='experience';}
 else if(action==='group-scenario'){resetReview('p3');baseSeed();state.plan=payload.scope==='pair'?['body','bp']:active();run('review-combination',{mode:payload.mode});run('start-plan');tab='experience';}
 else if(action==='walk-scenario'){resetReview('p3');baseSeed();['bp','oxygen'].forEach(seedResult);state.walk=null;state.plan=active();state.route='results';tab='experience';}
 else if(action==='mandatory-scenario'){resetReview('p3');baseSeed();run('open-test',{id:'agility'});tab='experience';}
 else if(action==='wrap-scenario'){resetReview('p3');baseSeed();seedResult('body');run('open-test',{id:'agility'});tab='experience';}
 else if(action==='reset-demo'){resetReview();}
 else if(action==='export-feedback')download('anovator-global-review.json',{version:C.version,at:new Date().toISOString(),feedback});
 else if(action==='export-state')download('anovator-global-simulation.json',{version:C.version,warning:'虚构场景；非真实设备数据',state});
 else if(action==='resume-pending')run('resume-task');
 else run(action,payload);
 render();
 if(directNavigation&&action==='open-direct-project')$('.receipt-item[aria-current="page"]')?.focus({preventScroll:true});
 if(returnToTitle&&onHome())$('.hub-callout-'+returnToTitle+' .hub-prepare-title')?.focus({preventScroll:true});
 if(action==='grip-result-side')$('.grip-result-options [aria-pressed="true"]')?.focus({preventScroll:true});
 if(oldRoute!==state.route||['tab','inspect','preview-page'].includes(action))window.scrollTo(0,0);
}
document.addEventListener('click',event=>{
 if(event.target.hasAttribute?.('data-oxygen-step')){oxygenHost?.step();return;}
 const key=event.target.closest('[data-member-key]');
 if(key&&ENTRY&&state.route==='identity'){ENTRY.key(state,key.dataset.memberKey);persist();return;}
 const el=event.target.closest('[data-action]');if(!el||el.type==='checkbox')return;
 event.preventDefault();act(el.dataset.action,JSON.parse(el.dataset.payload||'{}'),el);
});
document.addEventListener('keydown',event=>{
 const directory=$('.project-directory');
 if(!directory)return;
 if(event.key==='Escape'){
   event.preventDefault();
   event.stopImmediatePropagation();
   closeProjectDirectory();
 }else if(event.key==='Tab'){
   const controls=directory.querySelectorAll('button:not(:disabled),[tabindex="0"]');
   const current=document.activeElement;
   if(!directory.contains(current)||(event.shiftKey?current===controls[0]:current===controls[controls.length-1])){
     event.preventDefault();
     (event.shiftKey?controls[controls.length-1]:controls[0])?.focus();
   }
 }
});
document.addEventListener('change',event=>{
 const el=event.target;
 if(pagesRelease&&el.hasAttribute('data-demo-body-speed')){
   state.settings.demoBodySpeed=el.value==='4'?4:1;
   demoDriver?.retimeBody?.();
   persist();
   return;
 }
 if(el.dataset?.oxygenControl){oxygenHost?.change(el);return;}
 if(el.id==='profile-select'){act('switch-profile',{id:el.value});}
 else if(el.id==='role-select'){state.role=el.value;render();}
 else if(el.matches('[data-action]'))act(el.dataset.action,JSON.parse(el.dataset.payload||'{}'));
});
document.addEventListener('input',event=>{if(event.target.id==='member-id'){state.identityDraft=event.target.value;persist();}else if(event.target.id==='coverage-search'){const pos=event.target.selectionStart;search=event.target.value;render();$('#coverage-search').focus();$('#coverage-search').setSelectionRange(pos,pos);}});
document.addEventListener('submit',event=>{
 const form=event.target.closest('[data-form]');if(!form)return;event.preventDefault();const data=Object.fromEntries(new FormData(form));const action=form.dataset.form;
 if(action==='feedback'){feedback.push({page:data.page,profile:profile().name,role:C.roles.find(r=>r.id===state.role).name,note:data.note,at:new Date().toISOString()});tab='issues';render();return;}
 if(action==='compare-options'){state.comparison=data;render();return;}
 if(action==='mobile-form'){state.service.mobile='演示注册信息已提交；等待绑定确认。';render();return;}
 if(action==='organization'){act('service',{key:'organization',value:data.organization});return;}
 act(action,data);
});
if(['home','results','plan'].includes(state.route)){
 if(!state.user||!state.consent||singleBody())run('navigate',{page:state.route});
 else if(state.route==='plan'&&!state.planDraft)run('plan');
}
const resumedScreen=E.restoreScreen(state);
if(state.acq?.testId==='posture'&&!state.acq.pose){
 const side=[2,3].includes(state.acq.step)||state.acq.view==='side';
 state.acq.pose={view:side?'side':'front',started:Date.now(),waiting:false};
}
E.restoreBloodPressure(state);
if(resumedScreen?.id==='agility'&&resumedScreen.phase==='lit'){
 resumedScreen.phase='waiting';resumedScreen.target=null;resumedScreen.seq++;
}
window.ANOVATOR_REVIEW={getState:()=>E.copy(state),getPage:()=>state.route,getHomeCamera:()=>homeCameraView?.snapshot()??null,version:C.version,build:'route-bp-20261123'};
demoDriver=ANOVATOR_DEMO_DRIVER.create({getState:()=>state,send:run,render,enabled:()=>automaticDemo,reportReceipts:!!GN.taskLayer});
if(params&&!pagesRelease){
 const requested=params.get('scenario');
 if(['session-progress','layers-review','title-review'].includes(requested)&&GN.taskLayer&&!state.user&&!state.acq)
   loadThreeTestSession(requested);
 if(['home-first','home-review'].includes(requested)&&!state.user&&!state.acq)
   loadHomeScenario(requested==='home-first'?'first':'mixed');
 if(requested==='recorded-review'&&GN.taskLayer&&!state.user&&!state.acq)loadHomeScenario('recorded');
 if(requested==='all-results'&&GN.inlineResultLinks&&!state.user&&!state.acq)loadHomeScenario('complete');
 if(requested==='route-review'&&!state.user&&!state.acq)loadHomeScenario('routing');
 if(requested==='bp-review'&&!state.user&&!state.acq)loadBloodPressureScenario();
 if(requested==='screen-tests'&&!state.user&&!state.acq)loadScreenShowcase(params.get('test'));
 if(requested==='examiner-vision'&&!state.user&&!state.acq)loadScreenShowcase('vision',{examiner:true});
 if(requested==='grip-ready'&&!state.user&&!state.acq){
   resetReview('all');
   loadPreview('prepare/grip');
 }
 if(['posture-result','shoulder-icon'].includes(requested)&&!state.user&&!state.acq){
   resetReview('all');
   loadPreview(requested==='posture-result'?'result/posture':'prepare/shoulder');
   state.plan=['body','posture','shoulder'];
   state.scopeMode='selected';
 }
 if(requested==='oxygen'&&!state.user&&state.route==='standby'){
   loadOxygenScenario();
   if(window.history?.replaceState&&location.protocol!=='file:'){const entry=new URL(location.href);entry.searchParams.delete('scenario');window.history.replaceState(null,'',entry.href);}
 }else if(['ordinary','wind-down','repeated'].includes(requested))loadStopScenario(requested);
}
window.addEventListener('error',event=>{const el=document.createElement('div');el.className='message';el.textContent='原型运行出错：'+event.message;document.body.prepend(el);});
render();
})();
