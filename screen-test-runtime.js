(function(root){
  'use strict';
  let session = null;
  let key = '';
  let clock = null;
  let phaseSince = 0;
  let reaction = null;
  let prepareReaction = null;
  let lastTarget = null;
  let presentedStage = '';
  let reactionAttempt = null;
  const warmed = new Map();
  const nextImages = {
    vision:['va-switch.svg','va-result.svg'],
    color:['cv-plate.jpg','cv-result.svg'],
    astigmatism:['as-dial.svg','as-switch.svg','as-result.svg'],
    agility:['rt-result.svg','rt-dot.svg'],
  };

  function warmImages(id){
    for(const file of nextImages[id]||[]){
      if(warmed.has(file))continue;
      const img=new Image();
      warmed.set(file,img);
      img.addEventListener('error',()=>warmed.delete(file),{once:true});
      img.src='assets/screen-tests/'+file;
      img.decode().catch(()=>{});
    }
  }

  function prepareFirstPaint(screen){
    const critical = screen.querySelector('.st-plate, .st-dial-image');
    if(critical && (!critical.complete || !critical.naturalWidth)){
      const prompt = screen.querySelector('.st-cv-instruction, .st-as-instruction');
      const original = prompt?.textContent;
      screen.setAttribute('data-stimulus-loading','');
      if(prompt)prompt.textContent='Preparing the test image…';
      critical.decode().then(()=>{
        if(!screen.isConnected)return;
        if(prompt)prompt.textContent=original;
        screen.removeAttribute('data-stimulus-loading');
      },()=>{
        if(screen.isConnected&&prompt)prompt.textContent='Test image unavailable. Stop to retry.';
      });
    }
    for(const img of screen.querySelectorAll('img.st-image')){
      if (img===critical || img.complete && img.naturalWidth) continue;
      img.setAttribute('data-art-loading','');
      img.decode().then(()=>{
        if(img.isConnected)img.removeAttribute('data-art-loading');
      },()=>{});
    }
  }

  function cueStageEntry(screen){
    const stage = screen ? screen.dataset.test+':'+screen.dataset.phase : '';
    if(screen && stage!==presentedStage)screen.setAttribute('data-stage-entry','');
    presentedStage=stage;
  }

  function cancelClock(){
    if(clock!==null)clearTimeout(clock);
    clock=null;
  }
  function issue(op,value,expectedKey=key){
    const a = session?.state.acq;
    if(!a?.screen||session.state.stop||expectedKey!==key)return;
    session.act('screen-input',{op,value,acqId:a.id,seq:a.screen.seq});
  }
  function schedule(op,delay,value){
    const current = key;
    clock=setTimeout(()=>{
      clock=null;
      issue(op,value,current);
    },delay);
  }

  function sync(state,act){
    const screen = document.querySelector('.st-screen');
    const direct=document.documentElement.classList.contains('direct-navigation');
    if(direct){
      if(screen){
        if(['prepare','position'].includes(screen.dataset.phase))warmImages(screen.dataset.test);
        prepareFirstPaint(screen);
      }
      cueStageEntry(screen);
    }
    const a = state.acq;
    const q = a?.screen;
    const active = !!(screen&&q&&state.route==='measure/'+a.testId&&!state.stop);
    const updated = active?a.id+':'+q.seq:'';
    const switched = state!==session?.state||key!==updated;
    const previousState=session?.state;
    session={state,act,screen};
    if(screen?.dataset.test==='agility'&&!prepareReaction){
      prepareReaction=root.ANOVATOR_REACTION_RENDERER.create().then(renderer=>{
        reaction=renderer;
        const current=session?.state.acq?.screen;
        const grid=session?.screen?.querySelector('.st-react-grid');
        if(!direct&&grid&&current?.phase==='waiting')reaction?.mount(grid,current,phaseSince);
      }).catch(error=>console.warn('Reaction tile renderer switched to CSS.',error));
    }
    const grid=screen?.querySelector('.st-react-grid');
    if(switched){
      cancelClock();
      key=updated;
      phaseSince=performance.now();
      if(previousState!==state)lastTarget=null;
    }
    if(!active||q.id!=='agility')reactionAttempt=null;
    else if(direct&&(state!==previousState||reactionAttempt?.id!==a.id))reactionAttempt={id:a.id,renderer:reaction};
    const activeRenderer=direct?reactionAttempt?.renderer:reaction;
    if(active&&grid&&activeRenderer)activeRenderer.mount(grid,q,phaseSince);
    else reaction?.stop();
    if(!active||!switched)return;
    if(q.id==='agility'&&q.phase==='waiting'){
      const next=Math.floor(Math.random()*9);
      const target=next===lastTarget?(next+1)%9:next;
      lastTarget=target;
      schedule('cue',1250+Math.random()*480,target);
    }else if(q.id==='agility'&&q.phase==='lit'){
      phaseSince=performance.now();
      schedule('no-tap',4200);
    }else if(q.phase==='receipt'){
      schedule('settle',q.examiner?1000:q.id==='color'?660:q.id==='vision'?560:440);
    }
  }

  function tap(event){
    const tile=event.target.closest('[data-square]');
    const q=session?.state.acq?.screen;
    if(!tile||q?.id!=='agility'||!['waiting','lit'].includes(q.phase))return;
    issue('tap',{index:Number(tile.dataset.square),ms:Math.max(0,performance.now()-phaseSince)});
  }

  document.addEventListener('pointerdown', event=>{
    if(event.isPrimary&&event.button===0)tap(event);
  });
  document.addEventListener('click', event=>{
    if(event.detail===0)tap(event);
  });
  document.addEventListener('keydown', event=>{
    if(!session?.screen||event.repeat||event.altKey||event.ctrlKey||event.metaKey||event.target.closest('input,select,textarea,[contenteditable]'))return;
    const {state,screen,act}=session;
    const q=state.acq?.screen;
    if(q?.id==='vision'&&!q.examiner&&q.phase==='prompt'&&!state.stop&&state.route==='measure/vision'){
      const direction={ArrowUp:'up',ArrowDown:'down',ArrowLeft:'left',ArrowRight:'right'}[event.key];
      if(direction){event.preventDefault();issue('answer',direction);}
    }else if(screen.dataset.phase==='position'&&event.key==='Enter'&&!event.target.closest('button')){
      event.preventDefault();
      act('start-measure',{id:screen.dataset.test});
    }
  });

  root.ANOVATOR_SCREEN_TEST_RUNTIME={sync};
})(globalThis);
