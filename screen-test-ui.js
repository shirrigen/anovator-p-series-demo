(function(root){
  'use strict';

  const flow = root.ANOVATOR_SCREEN_TEST_FLOW;
  const titles = {vision:'Visual acuity', color:'Color vision', astigmatism:'Astigmatism', agility:'Reaction test'};
  const artwork = 'assets/screen-tests/';
  const eyeName = side => side === 'right' ? 'Right eye' : 'Left eye';
  const other = side => side === 'right' ? 'left' : 'right';
  const cover = side => 'Cover your ' + other(side) + ' eye.';
  const escape = value => String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const image = (file, className, alt='') => '<img class="st-image '+className+'" src="'+artwork+file+'" alt="'+alt+'" draggable="false">';
  const text = (className, copy) => '<p class="st-copy '+className+'">'+copy+'</p>';
  const header = id => '<h1 class="st-title">'+(id==='vision'?'<strong>Visual</strong> acuity':titles[id])+'</h1>';
  const footer = (...controls) => '<div class="wrap task-actions">'+controls.join('')+'</div>';
  const headline = (className, copy) => '<h2 class="st-copy st-headline '+className+'">'+copy+'</h2>';
  const rule = className => '<div class="st-rule '+className+'" aria-hidden="true"></div>';
  const directView = () => root.document?.documentElement?.classList?.contains('direct-navigation');
  const optotype = () => directView()?
    '<svg class="st-image st-optotype" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 18 18" role="img" aria-label="Directional E">'+
    '<path d="M0 0V18H18V14.4036H3.6V10.8036H18V7.2036H3.6V3.6036H18V0H0Z" fill="black"/></svg>':
    image('va-optotype.svg','st-optotype','Directional E');

  const preparations = {
    vision:{headline:'One eye<br>at a time.', image:'va-prep.jpg', instruction:'Face the screen.', detail:'Cover your left eye when prompted.'},
    color:{headline:'Read what<br>you see.', image:'cv-prep.jpg', instruction:'Look at each dot pattern.', detail:'Choose the number you see.'},
    astigmatism:{headline:'Compare the<br>lines.', image:'as-prep.svg', instruction:'Look at the line chart.', detail:'Choose the lines that look clearest.'},
    agility:{headline:'Wait for<br>the light.', image:'rt-prep.jpg', instruction:'Tap the lit square.', detail:'Stand where you can reach the grid.'},
  };

  function prepare(state, id, {b,skipAction}){
    const {headline:lead,image:standardFile,instruction,detail}=preparations[id];
    const file=id==='vision'&&directView()?'va-prep-native.png':standardFile;
    const stance = state.localTasks.screenPosition === id;
    const isOneEye = flow.needsPosition(id);
    const prior = state.mode!=='retest'&&state.results[id]?.partial ? state.results[id].screen?.eyes : null;
    const eye = (id==='vision'?['right','left']:['left','right']).find(side=>!prior?.[side]);
    const primary = stance || !isOneEye ? b(stance?'Ready':'Start','start-measure',{id},'primary')
      : b('Get ready','screen-position',{id},'primary');
    const note = state.lastStop?.testId===id ? text('st-stop-note','Test stopped. You can start again.') : '';
    const contents = stance
      ? header(id)+text('st-subtitle',eyeName(eye))+headline('st-position-head','Move to the<br>test position.')+
        image(file,'st-position-image')+text('st-position-instruction',cover(eye))+
        text('st-position-hint',id==='vision'&&state.profileId==='all'&&state.role==='operator'&&state.reviewExaminerVision?
          'The examiner will record your response.':id==='vision'?'Use the direction control to choose Ready.':'Use the test control to choose Ready.')
      : '<h1 class="st-copy st-prep-label">'+titles[id]+'</h1>'+headline('st-prep-head',lead)+image(file,'st-prep-image')+
        text('st-prep-instruction',instruction)+text('st-prep-detail',isOneEye&&prior?'Continue with your '+eye+' eye.':detail);
    return contents + note + footer(skipAction(id),primary);
  }

  function command(a,b,op,label,value,style='',disabled=false){
    return b(label,'screen-input',{op,value,acqId:a.id,seq:a.screen.seq},style,disabled);
  }
  function eyePrompt(q){
    return text('st-eye',eyeName(q.eye))+text('st-cover',cover(q.eye));
  }
  function swapEye(a,b,sessionExit){
    const q=a.screen;
    const visual = q.id==='vision'?'va-switch.svg':'as-switch.svg';
    const eyeLabel = q.eye==='right'?'Right eye next.':'Left eye next.';
    const status = ['left','right'].map(side=>'<div'+(side===q.eye?' class="st-switch-next"':'')+'><span>'+
      eyeName(side)+'</span><strong>'+(q.eyes[side]?'Complete':'Next')+'</strong></div>').join('');
    return header(q.id)+headline('st-switch-head',eyeLabel)+text('st-switch-cover',cover(q.eye))+
      image(visual,'st-switch-image')+rule('st-switch-rule')+'<div class="st-switch-status">'+status+'</div>'+
      text('st-switch-note','Continue when you’re ready.')+
      footer(sessionExit,command(a,b,'skip-eye','Skip eye',null),
        command(a,b,'continue-eye','Continue',null,'primary'));
  }

  function measureVision(a,b){
    if(a.screen.examiner)return measureExaminerVision(a,b);
    const q=a.screen, receipt = q.phase==='receipt';
    const orientation = {up:-90, right:0, down:90, left:180}[flow.directionFor(q.eye)];
    const guide = receipt?'Response received.':'Which way does it open?';
    const hint = receipt?'Keep looking at the screen.':'Use the direction control to answer.';
    const symbol = receipt?'':optotype();
    return header(q.id)+eyePrompt(q)+'<div class="st-optical-field'+(receipt?' st-optical-receipt':'')+
      '" style="--st-rotation:'+orientation+'deg">'+symbol+'</div><div role="status">'+
      text('st-va-instruction',guide)+text('st-va-hint',hint)+'</div>'+footer(b('Stop','stop',{},'stop-action'));
  }

  function measureExaminerVision(a,b){
    const q=a.screen,receipt=q.phase==='receipt';
    const chart=q.chart||'E';
    const tabs=flow.charts.map(value=>command(a,b,'chart',value,value,value===chart?'selected':'',receipt)).join('');
    const controls=[['incorrect','×  Incorrect'],['correct','✓  Correct']].map(([id,label])=>
      command(a,b,'grade',label,id,q.answer===id?'recorded':'',receipt)).join('');
    const orientation=flow.directionFor(q.eye)==='left'?180:0;
    const symbol=chart==='E'?optotype():
      '<span class="st-alt-optotype st-optotype-'+chart.toLowerCase()+'">'+chart+'</span>';
    return header(q.id)+eyePrompt(q)+'<div class="st-examiner-chart"><span>Chart</span><div role="group" aria-label="Optotype chart">'+
      tabs+'</div></div><div class="st-optical-field'+(receipt?' st-optical-receipt':'')+
      '" style="--st-rotation:'+orientation+'deg">'+(receipt?'':symbol)+'</div>'+
      '<div role="status">'+text('st-va-instruction',receipt?'Response recorded.':chart==='P'?'Read the letter aloud.':'Which way does it open?')+'</div>'+
      '<section class="st-examiner-controls" aria-label="Examiner response"><div>'+controls+'</div></section>'+
      footer(b('Stop','stop',{},'stop-action'));
  }

  function measureColor(a,b){
    const q=a.screen,receipt=q.phase==='receipt';
    const numbers=flow.plate.options.map(value=>command(a,b,'answer',value,value,
      'st-local-button'+(q.answer===value?' is-selected':''),receipt)).join('');
    const none=command(a,b,'answer','No number visible','none','st-local-button st-color-none',receipt);
    return header(q.id)+text('st-subtitle','Sample plate 1 of 1')+image('cv-plate.jpg','st-plate','Sample dot plate')+
      text('st-cv-instruction','What number do you see?')+'<div class="st-color-options">'+numbers+'</div>'+
      (receipt?'<p class="st-copy st-cv-receipt" role="status">Response recorded.</p>':none)+footer(b('Stop','stop',{},'stop-action'));
  }

  function dial(step){
    const labels=Array.from({length:12},(_,i)=>{
      const n=i+1, angle=n*Math.PI/6;
      const x=114+96*Math.sin(angle), y=115.5-98*Math.cos(angle);
      return '<text x="'+x+'" y="'+y+'">'+n+'</text>';
    }).join('');
    const cue=step===null?'':'<g class="st-line-mark" transform="rotate('+step*15+' 114 115.5)">'+
      '<path d="M114 98V40 M114 133v58"/><circle cx="114" cy="36" r="2.2"/></g>';
    return '<div class="st-dial">'+image('as-dial.svg','st-dial-image','Astigmatism line chart')+
      '<svg class="st-clock" viewBox="0 0 228 231" aria-hidden="true">'+labels+cue+'</svg></div>';
  }

  function measureAstigmatism(a,b){
    const q=a.screen;
    const step=q.phase==='direction'?q.lineStep:null;
    const prompts={compare:'Which lines look clearest?',direction:'Set the line direction.',equal:'All lines look the same.',adjustment:'Choose the clearest setting.'};
    let options;
    if(q.phase==='compare'){
      options=command(a,b,'choose-line','Choose line direction',null,'st-local-button st-line-choice')+
        command(a,b,'choose-equal','All lines look the same',null,'st-local-button st-equal-choice');
    }else{
      const confirm=command(a,b,'confirm','Confirm',null,'st-local-button st-confirm');
      if(q.phase==='equal'){
        options=command(a,b,'change','Change answer',null,'st-change')+confirm;
      }else{
        const setting=q.phase==='adjustment';
        const value=setting?(q.settingStep*.25).toFixed(2)+' D':String(flow.lineNumber(q.lineStep));
        const minus=command(a,b,'step','−',-1,'st-local-button',setting&&q.settingStep===0);
        const plus=command(a,b,'step','+',1,'st-local-button',setting&&q.settingStep===8);
        options='<div class="st-stepper">'+minus+'<output class="st-step-value" aria-live="polite">'+value+'</output>'+plus+'</div>'+confirm;
      }
    }
    return header(q.id)+eyePrompt(q)+dial(step)+text('st-as-instruction',prompts[q.phase])+options+
      footer(b('Stop','stop',{},'stop-action'));
  }

  const reactionIssues = {
    early:['Too soon.','Wait for the square to light up,<br>then tap it.'],
    miss:['Wrong square.','Tap only the square that lights up.'],
    'no-tap':['No tap<br>recorded.','Try this round again.'],
  };
  function issueContent(id,meta,heading,detail){
    return header(id)+text('st-subtitle',meta)+rule('st-issue-rule')+
      '<div role="status">'+headline('st-issue-heading',heading)+text('st-issue-detail',detail)+'</div>';
  }

  function measureReaction(a,b,sessionExit){
    const q=a.screen, isReceipt=q.phase==='receipt';
    const number=isReceipt?q.times.length:q.times.length+1;
    const meta='Trial '+number+' of '+flow.rounds;
    if(reactionIssues[q.phase]){
      const [title,detail]=reactionIssues[q.phase];
      return issueContent(q.id,meta,title,detail)+footer(
        sessionExit,command(a,b,'skip-attempt','Skip',null),
        command(a,b,'retry-round','Retry',null,'primary'));
    }
    const keys=Array.from({length:9},(_,index)=>{
      const active=q.phase==='lit'&&index===q.target, recorded=isReceipt&&index===q.target;
      return '<button class="st-react-button" type="button" data-square="'+index+
        '" data-lit="'+active+'" data-recorded="'+recorded+'" aria-label="Square '+(index+1)+
        (active?', lit':'')+'" '+(isReceipt?'disabled':'')+'><i aria-hidden="true"></i></button>';
    }).join('');
    return header(q.id)+text('st-trial',meta)+text('st-rt-instruction','Tap the lit square.')+
      '<div class="st-react-grid" data-renderer="css" role="group" aria-label="Reaction test grid"><div class="st-react-surface" aria-hidden="true"></div>'+
      '<div class="st-react-inputs">'+keys+'</div></div><p class="st-react-receipt" role="status">'+(isReceipt?'Tap recorded.':'')+'</p>'+
      footer(b('Stop','stop',{},'stop-action'));
  }

  function recovery(state,a,b,sessionExit){
    const q=a.screen, id=q.id;
    const copy={
      vision:[eyeName(q.eye),'Response<br>interrupted.','Check the response control,<br>then retry.'],
      color:['Sample plate','Test<br>interrupted.','Retry to continue the assessment.'],
      astigmatism:[eyeName(q.eye),'Test<br>interrupted.','Set up again to continue.'],
      agility:['No average available','Test<br>incomplete.','Restart to get an average time.'],
    }[id];
    return issueContent(id,...copy)+footer(
      sessionExit,command(a,b,'skip-attempt','Skip',null),
      b(id==='agility'?'Restart':'Retry','retry',{},'primary'));
  }

  function measure(state, a,b,sessionExit){
    const q=a.screen;
    if(state.stop){
      const unconfirmed=state.stop.status==='unconfirmed';
      return issueContent(q.id,'',unconfirmed?'Stop<br>unconfirmed.':'Stopping…',
        unconfirmed?'Retry to confirm the test has stopped.':'Please wait for stop confirmation.')+
        footer(unconfirmed?b('Retry stop','retry-stop',{},'primary'):b('Stopping','stop',{},'stop-action',true));
    }
    if(q.phase==='switch')return swapEye(a,b,sessionExit);
    const renderer={vision:measureVision,color:measureColor,astigmatism:measureAstigmatism,agility:measureReaction}[q.id];
    return renderer(a,b,sessionExit);
  }

  function resultVision(r){
    const eyes=r.screen.eyes;
    const judged=Object.values(eyes).some(eye=>eye.judgement);
    const fields=['left','right'].map(side=>{
      const e=eyes[side];
      const value=e?.judgement?(e.judgement==='correct'?'Correct':'Incorrect'):(e?.reading|| (e?'Response recorded':'Not tested'));
      return '<div><span>'+eyeName(side)+'</span><strong class="'+(e?.reading?'':'st-value-description')+'">'+
        value+'</strong>'+(e?.judgement?'<small>'+e.chart+' chart</small>':'')+'</div>';
    }).join('');
    return text('st-subtitle',r.partial?'Result · One eye tested':'Result · Both eyes tested')+image('va-result.svg','st-va-result-image')+
      '<div class="st-va-results">'+fields+'</div>'+rule('st-va-rule')+
      text('st-va-scale',judged?'Examiner record · Demo responses':'E chart · Five-point notation · Example')+
      text('st-result-saved',r.partial?'Your '+(eyes.right?'right':'left')+'-eye response is saved.':'Saved to your assessment.');
  }
  function resultColor(r){
    const same=r.screen.answer===flow.plate.answer;
    return text('st-subtitle','Example result')+image('cv-result.svg','st-cv-result-image')+
      headline('st-cv-result-head',same?'No difficulty<br>flagged.':'Review<br>suggested.')+
      rule('st-cv-rule')+text('st-cv-count','1 sample plate answered')+
      text('st-cv-result-detail', 'This example does not provide a screening outcome.')+
      text('st-result-saved','Saved to your assessment.');
  }
  function resultAstigmatism(r){
    const eyes=r.screen.eyes;
    const rows=['left','right'].map(side=>{
      const eye=eyes[side];
      const value=eye?.kind==='line'?'<strong class="st-axis-value">'+escape(eye.angle)+'°</strong><span class="st-axis-detail">Example line angle</span>'
        :'<strong>'+ (eye?'Lines looked equal':'Not tested') +'</strong>';
      return '<div class="st-as-eye st-as-'+side+'"><span>'+eyeName(side)+'</span><div>'+value+'</div></div>';
    }).join('');
    return text('st-subtitle',r.partial?'One eye checked':'Both eyes checked')+image('as-result.svg','st-as-result-image')+
      rows+rule('st-as-rule')+text('st-result-saved',r.partial?'Your '+(eyes.left?'left':'right')+'-eye response is saved.':'Line comparison recorded.');
  }
  function resultReaction(r){
    const timing=r.values.find(row=>row.id==='reaction');
    const dots=r.screen.times.map(()=>image('rt-dot.svg','st-result-dot')).join('');
    return text('st-subtitle','Test complete · Demo timing')+image('rt-result.svg','st-rt-result-image')+
      '<div class="st-rt-result"><strong>'+escape(timing?.value)+'</strong><span>ms</span></div>'+
      text('st-rt-result-label','Average reaction time')+rule('st-rt-rule')+
      text('st-rt-count',r.screen.times.length+' valid responses')+'<div class="st-rt-dots">'+dots+'</div>'+
      text('st-result-saved','Saved to your assessment.');
  }
  function result(state,id,actions){
    const value=state.results[id];
    const renderer={vision:resultVision,color:resultColor,astigmatism:resultAstigmatism,agility:resultReaction}[id];
    const body=value.screen?renderer(value):text('st-subtitle','Earlier demo record')+
      headline('st-issue-heading','Result<br>recorded.')+text('st-issue-detail','Retest to see the updated demo.');
    return header(id)+body+actions(id);
  }

  function render(state,kind,id,helpers){
    const a=state.acq;
    const sessionExit=a?.screen&&!root.ANOVATOR_GLOBAL_CHROME?.taskLayer?.(state)
      ?command(a,helpers.b,'end-attempt','Exit session',null,'st-session'):'';
    const phase=kind==='prepare'?(state.localTasks.screenPosition===id?'position':'prepare'):
      kind==='measure'?(state.stop?'stopping':a.screen.phase):kind;
    const body=kind==='prepare'?prepare(state,id,helpers):kind==='measure'?measure(state,a,helpers.b,sessionExit):
      kind==='recovery'?recovery(state,a,helpers.b,sessionExit):result(state,id,helpers.resultActions);
    return '<section class="st-screen" lang="en" data-test="'+id+'" data-phase="'+phase+'">'+body+'</section>';
  }

  function directionControl(a,b){
    if(!a?.screen||a.testId!=='vision'||a.screen.phase!=='prompt'||a.screen.examiner)return '';
    const keys=[['↑','up'],['←','left'],['↓','down'],['→','right'],['看不清','none']];
    return '<div class="st-review-input"><span>模拟视力方向控制器</span><div class="wrap">'+
      keys.map(([label,value])=>command(a,b,'answer',label,value,'small')).join('')+'</div></div>';
  }

  root.ANOVATOR_SCREEN_TEST_UI={render,directionControl};
})(globalThis);
