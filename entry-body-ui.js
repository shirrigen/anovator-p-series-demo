(function(root){
 'use strict';

 const bodyPath='assets/body-ui/';
 const guides=[
   {name:'Thumbs',title:'Thumbs on round contacts.',detail:'Rest both thumbs on the round contacts.',art:'guide-thumb.png',duration:6000},
   {name:'Fingers',title:'Four fingers around the long contact.',detail:'Hold both handles.',art:'guide-fingers.png',duration:6000},
   {name:'Arms',title:'Keep your arms clear.',detail:'Leave a gap between your arms and torso.',art:'guide-arms.png',duration:8000},
   {name:'Feet',title:'Feet flat on all four contacts.',detail:'Both forefeet and heels touch the electrodes.',art:'guide-feet.png',duration:8000}
 ];
 const metrics=[
   ['fat','Body fat','body-fat'],['musclePercent','Muscle','muscle'],['water','Total body water','water'],
   ['visceral','Visceral fat','visceral-fat'],['subfat','Subcutaneous fat','subcutaneous-fat'],
   ['height','Height','height'],['weight','Weight','weight'],['bmi','BMI','bmi'],
   ['bone','Bone mass','bone'],['protein','Protein','protein'],['bmr','Basal metabolic rate','bmr']
 ];
 const metricIndex=new Map(metrics.map(([id],i)=>[id,i]));
 const motion=root.matchMedia?.('(prefers-reduced-motion: reduce)');
 let guideTimer=null,guideKey=null,videoAvailable=null;

 function stage(kind,content,actions=''){
   return '<div class="body-wrap"><section class="body-screen" lang="en" data-body-stage="'+kind+'">'+content+'</section></div>'+actions;
 }

 function taskRow(html){
   return '<div class="wrap task-actions">'+html+'</div>';
 }

 function guideIndex(s){
   const i=s.localTasks?.bodyGuide;
   return Number.isInteger(i)&&guides[i]?i:0;
 }

 function renderIntroduction(s,{b,E}){
   const source=bodyPath+'intro/';
   const topics=[['Body fat','body-fat'],['Muscle','muscle'],['Body water','body-water']];
   const rows=topics.map(([label,image])=>`<li><img src="${source}${image}.svg" alt="" width="24" height="24"><span>${label}</span></li>`).join('');
   return stage('intro',
     `<div class="body-intro-media" aria-hidden="true">
       <img src="${source}mo.png" alt="" width="360" height="640">
       <img src="${source}fade.svg" alt="" width="360" height="640">
     </div>
     <h1 class="body-intro-title">Body<br>composition</h1>
     <p class="body-intro-report">${metrics.length} results in your report</p>
     <ul class="body-intro-metrics">${rows}</ul>`,
     taskRow((E.canSkip(s,'body')?b('Skip','skip'):'')+b('Get ready','body-get-ready',{},'primary')));
 }

 function renderGuide(s,{b,esc,E}){
   const index=guideIndex(s),step=guides[index];
   const conditions=[
     ['Hold both handles','Thumbs on round contacts. Four fingers around long contacts.'],
     ['Arms off your body','Leave a gap between your arms and torso.'],
     ['Heels and forefeet','On all four contacts.']
   ];
   const controls=guides.map(({name},i)=>'<button type="button" aria-label="'+name+'" aria-pressed="'+(i===index)+'" data-action="body-guide" data-payload="'+
      esc(JSON.stringify({index:i}))+'"><span></span></button>').join('');
   const returnLabel=s.mode==='retest'?'Cancel retest':'Skip';
   return stage('guide','<h1 class="body-title"><strong>Body</strong> composition</h1>'+
     '<h2 class="body-guide-title">Get into position.</h2>'+
     '<div class="body-position"><img src="'+bodyPath+'guide-body.png" alt="Standing position with both handles and foot contacts"><ul>'+
     conditions.map(([name,detail])=>'<li><strong>'+name+'</strong><span>'+detail+'</span></li>').join('')+'</ul></div>'+
     '<section class="body-chapter" aria-label="Position guide"><div class="body-chapter-copy"><p class="body-guide-index">Guide '+(index+1)+' / 4</p>'+
     '<h3>'+step.title+'</h3><p>'+step.detail+'</p></div><img src="'+bodyPath+step.art+'" alt=""></section>'+
     '<div class="body-guide-tabs" role="group" aria-label="Choose a guide step">'+controls+'</div>'+
     (s.lastStop?.testId==='body'?'<p class="body-resume-note" role="status">Stopped. Start again when ready.</p>':''),
     taskRow((E.canSkip(s,'body')?b(returnLabel,'skip'):'')+b('Start','start-measure',{id:'body'},'primary')));
 }

 function renderMeasure(s,{b,hideStop}){
   const a=s.acq,stop=s.stop;
   if(a?.testId!=='body')return '';
   const awaiting=s.bodyDataReady;
   const status=stop?(stop.status==='unconfirmed'?'Stop not confirmed':'Stopping…'):awaiting?'Checking measurements…':a.step>=2?'Checking data…':'Measuring';
   const hint=stop?'Keep your position until stopping is confirmed.':'Hold both handles. Stay still.';
   const action=stop?.status==='unconfirmed'?b('Retry stop','retry-stop',{},'primary'):
     hideStop?'':b(stop?'Stopping':'Stop','stop',{},'stop-action',!!stop);
   return stage('measure','<div class="body-measure-media" data-attempt="'+a.id+'"><img src="'+bodyPath+'mo-measuring-poster.png" alt=""></div>'+
     '<h1 class="body-title"><strong>Body</strong> composition</h1><div class="body-measure-copy"><h2 role="status">'+status+'</h2><p>'+hint+'</p></div>'+
     (!stop?'<span class="body-capture-cue" aria-hidden="true"></span>':''),action?taskRow(action):'');
 }

 function icon(id){
   const index=metricIndex.get(id);
   return index===undefined?'':'<img src="'+bodyPath+'overview-imgGroup'+(index||'')+'.svg" alt="" width="24" height="24">';
 }

 function artwork(id){
   const index=metricIndex.get(id);
   const filename=index===undefined?'MOA07-B00-v02-overview.png':'MOA07-B'+String(index+1).padStart(2,'0')+'-v02-'+metrics[index][2]+'.png';
   return bodyPath+filename;
 }

 function amount(value,esc){
   return !value||value.pending?'<span class="body-no-value">Unavailable</span>':
     '<strong>'+esc(value.value)+'</strong><small>'+esc(value.unit==='kcal/日'?'kcal/day':value.unit==='等级'?'':value.unit)+'</small>';
 }

 function metricBar(value){
   // Only use a quantitative track where the unit defines its scale.
   if(!value||value.pending||value.unit!=='%'||!Number.isFinite(value.value)||value.value<0||value.value>100)return '';
   return '<span class="body-result-track" aria-hidden="true"><i style="width:'+value.value+'%"></i></span>';
 }

 function tabs(b,n,focus,selected){
   return '<nav class="body-tabs" aria-label="Result view">'+
     (focus?n('Overview','result/body'):'<span aria-current="page">Overview</span>')+
     (focus?'<span aria-current="page">Focus</span>':b('Focus','metric',{id:selected}))+'</nav>';
 }

 function overview(s,{b,n,esc,record,actions,heightSummary,showMore=true}){
   const values=new Map(record.values.map(v=>[v.id,v]));
   const list=metrics.map(([id,name])=>{
     const value=values.get(id);
     return '<li><button type="button" class="body-metric-row" data-action="metric" data-payload="'+esc(JSON.stringify({id}))+'">'+
       icon(id)+'<span>'+ name+'</span><span class="body-metric-value">'+amount(value,esc)+'</span>'+metricBar(value)+'</button></li>';
   }).join('');
   const more=showMore?'<details class="body-more"><summary>More results &amp; sources</summary><div class="body-more-content">'+
     heightSummary(record.height)+record.values.filter(v=>!metricIndex.has(v.id)).map(v=>b(v.label,'metric',{id:v.id})).join('')+
     n('Health analysis','health')+n('Body segments','segments')+'</div></details>':'';
   return stage('overview','<img class="body-overview-art" src="'+artwork()+'" alt="">'+
     '<h1 class="body-title"><strong>Body</strong> composition</h1>'+tabs(b,n,false,s.selectedMetric||'fat')+
     '<p class="body-results-meta">'+(record.needsReview?'Profile changed · retest to update':(record.sample?'Demo · ':'')+metrics.length+' results')+'</p>'+
     '<ul class="body-metric-list">'+list+'</ul>'+more,actions('body'));
 }

 function focus(s,{b,n,esc,record}){
   const id=s.selectedMetric,meta=metrics[metricIndex.get(id)];
   const value=record.values.find(v=>v.id===id),name=meta?.[1]||value?.label||'Metric';
   const bar=metricBar(value);
   const rail=metrics.map(([key,label])=>'<li><button type="button" aria-label="'+label+'" aria-pressed="'+(id===key)+'" data-action="metric" data-payload="'+
     esc(JSON.stringify({id:key}))+'">'+icon(key)+'</button></li>').join('');
   return stage('focus','<img class="body-focus-art" src="'+artwork(id)+'" alt="">'+
     '<h1 class="body-title"><strong>Body</strong> composition</h1>'+tabs(b,n,true)+
     '<section class="body-focus-value">'+icon(id)+'<h2>'+esc(name)+'</h2><p class="body-reading">'+amount(value,esc)+'</p>'+
     '<p class="body-focus-source">'+(record.needsReview?'Profile changed · retest to update':record.sample?'Current session · demo reading':'Current session')+'</p>'+
     (bar?'<div class="body-focus-scale">'+bar+'<div><span>0%</span><span>100%</span></div></div>':'')+'</section>'+
     '<ul class="body-focus-rail" aria-label="Switch metric">'+rail+'</ul>',
     taskRow(n('Back to overview','result/body','primary is-back')));
 }

 function chooseGuide(s,{index,automatic}){
   if(!Number.isInteger(index)||!guides[index])return false;
   s.localTasks??={};
   s.localTasks.bodyGuide=index;
   if(!automatic)s.localTasks.bodyGuideManual=true;
   return true;
 }

 function sync(s,act,previousVideo){
   const screen=document.querySelector('[data-body-stage]');
   const step=guideIndex(s);
   const key=screen?.dataset.bodyStage==='guide'&&!s.localTasks?.bodyGuideManual&&!motion?.matches&&!document.hidden?
     [s.user?.id,s.lastStop?.acqId,step].join(':'):null;
   if(key!==guideKey){
     clearTimeout(guideTimer);
     guideKey=key;
     if(key)guideTimer=setTimeout(()=>{
       guideKey=null;
       if(!motion?.matches&&!document.hidden)act('body-guide',{index:(step+1)%guides.length,automatic:true});
     },guides[step].duration);
   }

   const media=screen?.querySelector('.body-measure-media');
   if(!media||motion?.matches||s.stop)return;
   videoAvailable??=location.protocol==='file:'?Promise.resolve(true):
     fetch('./health').then(r=>r.json()).then(r=>!!r.video).catch(()=>false);
   videoAvailable.then(available=>{
     if(!available||!media.isConnected||motion?.matches)return;
     let video=previousVideo;
     if(video?.dataset.attempt!==media.dataset.attempt){
       video=document.createElement('video');
       video.dataset.attempt=media.dataset.attempt;
       video.src=bodyPath+'mo-measuring.mp4';
       video.muted=true;
       video.loop=true;
       video.playsInline=true;
       video.setAttribute('aria-hidden','true');
       video.addEventListener('error',()=>video.remove(),{once:true});
     }
     if(root.ANOVATOR_PAGES_RELEASE)video.playbackRate=s.settings.demoBodySpeed===4?4:1;
     media.append(video);
     video.play().catch(()=>video.remove());
   });
 }

 root.ANOVATOR_BODY_UI={
   render(s,kind,c){
     if(kind==='intro')return renderIntroduction(s,c);
     if(kind==='prepare')return renderGuide(s,c);
     if(kind==='measure')return renderMeasure(s,c);
     if(kind==='result')return overview(s,c);
     return focus(s,c);
   },
   chooseGuide,sync,video:()=>document.querySelector('.body-measure-media video')
 };

 function renderIdentity(s,{b,n,esc,recentAccounts,demo=false}){
   const initial=demo?'':s.user?.id||s.reviewIdentity||'DEMO-001';
   const id=s.identityDraft??initial;
   const keys=['1','2','3','4','5','6','7','8','9','backspace','0'].map(key=>
     '<button type="button" data-member-key="'+key+'" aria-label="'+(key==='backspace'?'Delete digit':key)+'">'+
       (key==='backspace'?'⌫':key)+'</button>').join('');
   const back=s.identityOrigin?b('Back','cancel-identity-edit'):n('Back','standby');
   return '<section class="entry-screen" lang="en" aria-label="Member ID entry">'+
     '<img class="entry-mo" src="assets/entry-ui/member-id-mo.png" alt="">'+
     '<div class="entry-intro"><p>BEFORE WE BEGIN</p><h1>'+(demo?'Enter any<br>number.':'Enter your<br>member ID.')+'</h1></div>'+
     '<form data-form="identity" class="entry-form"><label class="entry-field" for="member-id">Member ID'+
     '<input id="member-id" name="id" type="text" value="'+esc(id)+'" inputmode="numeric" autocomplete="off" spellcheck="false" required'+
     (demo?' pattern="[0-9]+" title="Enter any digits to continue."':'')+'></label>'+
     '<input type="hidden" name="name" value="'+esc(s.user?.name||'演示受测者')+'">'+
     '<div class="entry-keypad" role="group" aria-label="Number keypad">'+keys+'</div>'+
     '<div class="entry-actions">'+back+'<button type="submit" class="primary">Continue</button></div></form>'+
     (demo?'':'<details class="entry-options"><summary>More login options</summary>'+recentAccounts()+
     b('Scan to sign in (demo)','identity',{id:'DEMO-QR-001',name:'扫码演示受测者'})+'</details>')+'</section>';
 }

 function memberKey(s,key){
   const input=document.getElementById('member-id');
   if(!input)return;
   const isUntouched=s.identityDraft===undefined&&!s.user&&!s.reviewIdentity;
   const current=isUntouched&&/^\d$/.test(key)?'':input.value;
   const focused=document.activeElement===input;
   const from=focused?input.selectionStart:current.length;
   const to=focused?input.selectionEnd:current.length;
   const start=key==='backspace'&&from===to?Math.max(0,from-1):from;
   const inserted=/^\d$/.test(key)?key:'';
   const next=current.slice(0,start)+inserted+current.slice(to);
   input.value=next;
   if(focused)input.setSelectionRange(start+inserted.length,start+inserted.length);
   s.identityDraft=next;
 }

 root.ANOVATOR_ENTRY_UI={render:renderIdentity,key:memberKey};
})(globalThis);
