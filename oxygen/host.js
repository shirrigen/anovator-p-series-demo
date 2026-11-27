// The instrument emits peripheral events. The global engine alone selects projects,
// adopts both readings, increments revisions and builds reports.
window.ANOVATOR_OXYGEN_HOST = function createOxygenHost({
  getState,E,run,persist,render,automatic,resultControls,resultBack,resultEndGlyph,
  directEnd=false,requestEnd,resultEndEmphasized
}) {
  let current=null, loading=null, queued=false;
  const oxygenPage=s=>/^(prepare|measure|result)\/oxygen$/.test(s.route)&&!!s.user&&!s.privacyLocked&&!s.selectedHistory&&E.allowed(s,'oxygen');
  const key=s=>[s.user?.id,s.route,s.acq?.id,s.results.oxygen?.revision,s.mode,s.lastStop?.acqId].join('|');
  const english={body:'Body composition',bp:'Blood pressure',oxygen:'Oxygen & pulse',posture:'Posture',shoulder:'Shoulder mobility',lung:'Vital capacity',balance:'Balance',agility:'Reaction time',grip:'Grip strength',jump:'Vertical jump',pushups:'Push-ups',rope:'Jump rope',vision:'Visual acuity',color:'Colour vision',astigmatism:'Astigmatism',scan360:'Body scan'};
  const faults={normal:'正常采集',connect:'无法连接指夹',start:'指夹启动未响应',silent:'没有有效信号',pulse:'只有血氧',oxygen:'只有脉率',hold:'延迟解除回执',save:'保存失败一次',unknown:'保存回执丢失一次'};
  const stageLabel=stage=>({
    ready:'待准备',starting:'正在启动',acquiring:'等待有效信号',measuring:'测量中',
    interrupted:'信号中断',releasing:'等待解除确认',recording:'保存读数中',result:'已取得结果',
    stopping:'等待停止确认',stopped:'已停止',failed:'采集失败',returning:'返回准备',
    saveFailed:'保存失败',saveUnknown:'等待保存确认',
  })[stage]||'待准备';
  function load(){
    if(!loading)loading=Promise.all(['template','artwork','three','material','device'].map(name=>new Promise((resolve,reject)=>{
      const script=document.createElement('script');script.src='oxygen/'+name+'.js';
      script.onload=resolve;script.onerror=()=>{script.remove();reject(new Error(name));};document.head.append(script);
    }))).catch(e=>{loading=null;throw e;});
    return loading;
  }
  function repaint(){
    if(queued)return;queued=true;
    queueMicrotask(()=>{queued=false;render();});
  }
  function destination(s){
    if(resultControls){
      const primary=resultControls().primary;
      return primary?{action:primary.action,caption:primary.caption,label:primary.target||primary.label,
        payload:primary.payload}:null;
    }
    if(s.receiptReturn){const r=s.receiptReturn;return {action:'return-to-task',caption:'Return to',label:r.pendingMode==='group'?'Body & BP':english[r.pendingTest]||'Measurement'};}
    if(s.readingReturn)return {action:'return-reading',caption:'Back to',label:'Results'};
    if(E.viewedFromPreview(s))return {action:'return-to-preview',caption:'Back to',label:'Preview'};
    const next=E.next(s);
    if(next&&next!=='oxygen')return {action:'continue',caption:'Next',label:english[next]||E.test(next).name};
    const extra=E.suggestedNext(s);
    return !next&&extra?{action:'append-next',caption:'Optional',label:english[extra]||E.test(extra).name}:null;
  }
  function snapshot(s){
    const result=s.results.oxygen;
    const values=result?.participantId===s.user?.id?result.values:[];
    const oxygen=values?.find(v=>v.id==='spo2')?.value,pulse=values?.find(v=>v.id==='pulse')?.value;
    return {result:Number.isFinite(oxygen)&&Number.isFinite(pulse)?{oxygen,pulse}:null,
      savedId:result?.acqId??null, acq:s.acq?.testId==='oxygen'?s.acq:null, stopping:!!s.stop,
      stopped:s.lastStop?.testId==='oxygen'?s.lastStop.acqId:null, resultView:s.route==='result/oxygen',
      connected:!!s.settings.peripherals.oximeter,retest:s.mode==='retest',
      cache:s.oxygenFlow?.participantId===s.user?.id?s.oxygenFlow:null};
  }
  function adapter(view,s){
    const owner=s.user.id;
    const valid=()=>current===view&&getState()===s&&s.user?.id===owner&&oxygenPage(s);
    function command(action,payload={}){
      if(!valid())return false;
      run(action,payload);view.key=key(s);persist();repaint();return true;
    }
    function packet(acqId){return {acqId,participantId:owner};}
    const active=id=>valid()&&s.acq?.testId==='oxygen'&&s.acq.id===id;
    return {
      automatic, snapshot:()=>snapshot(s),next:()=>destination(s),canMakeReport:()=>E.canMakeCurrentReport(s),
      resultBack,resultEndGlyph,resultEndEmphasized,directEnd,
      retryView(){if(valid()){view.instrument?.dispose();current=null;repaint();}},
      begin(){if(!valid()||s.route!=='prepare/oxygen'||s.acq)return null;command('start-measure',{id:'oxygen'});return s.acq?.testId==='oxygen'?s.acq.id:null;},
      retest(){return command('retest',{id:'oxygen',returnRoute:'result/oxygen'})&&s.route==='prepare/oxygen';},
      stop(id){if(!active(id))return false;command('request-stop');return !!s.stop;},
      stopped(id){return active(id)&&command('stopped',{...packet(id),released:true})&&!s.acq;},
      release(id,pair){if(!active(id))return false;run('oxygen-release',{...packet(id),pair});persist();return !!s.acq?.oxygenPair;},
      record(id,pair){
        if(!active(id)||s.acq.oxygenPair?.oxygen!==pair.oxygen||s.acq.oxygenPair?.pulse!==pair.pulse)return false;
        return command('oxygen-record',packet(id))&&s.results.oxygen?.acqId===id;
      },
      leave(kind,source){
        if(!valid()||s.acq)return;
        if(kind==='end'&&directEnd){
          if(s.route==='result/oxygen'&&E.canMakeCurrentReport(s))requestEnd?.(source);
          return;
        }
        if(kind==='back'){
          const back=resultBack?.();
          if(back)command(back.action,back.payload);
          return;
        }
        if(kind==='next'&&resultControls){
          const n=destination(s);
          if(n)command(n.action,n.payload);
          return;
        }
        const action=kind==='next'?destination(s)?.action:kind==='previous'?'skip':kind;
        if(action){command(action);if(action==='skip'&&s.route==='result/oxygen')view.key='';}
      },
      connected(value){
        if(!valid())return;
        s.settings.peripherals.oximeter=value;
        const control=document.querySelector('[data-oxygen-control="connected"]');
        if(control)control.checked=value;
        persist();
      },
      modal(open){if(valid()){view.dialog=open;chrome(view);}},
      checkpoint(data){
        if(!valid())return;
        s.oxygenFlow={...data,participantId:owner};persist();chrome(view);
        const panel=document.querySelector('[data-oxygen-review]');
        if(panel){const notice=panel.querySelector('output');if(notice)notice.value=stageLabel(data.stage);}
      }
    };
  }
  function chrome(view){
    const device=view.node?.closest('.oxygen-screen');if(!device)return;
    if(view.dialog){device.setAttribute('data-dialog','');}else device.removeAttribute('data-dialog');
    const stage=view.node?.shadowRoot?.getElementById('screen')?.dataset.stage;
    device.dataset.oxygenStage=stage||'ready';
    for(const el of device.querySelectorAll('.gn-header,.device-bottom'))el.inert=!!view.dialog;
  }
  function sync(slot){
    const s=getState();
    if(current&&(!slot||current.session!==s||current.key!==key(s))){
      current.instrument?.dispose();current=null;
    }
    if(!slot)return;
    if(current){
      if(slot!==current.node)slot.replaceWith(current.node);
      chrome(current);
      const focus=current.focus;current.focus=null;
      if(focus?.isConnected&&!focus.closest('[hidden],[inert]')&&!focus.disabled)focus.focus({preventScroll:true});
      return;
    }
    const view=current={session:s,key:key(s),node:slot,dialog:false,instrument:null};
    const attach=()=>{
      if(current!==view||getState()!==s||!slot.isConnected)return;
      slot.textContent='';view.instrument=window.ANOVATOR_OXYGEN_MOUNT(slot,adapter(view,s));
      window.ANOVATOR_REVIEW_EN?.surface(slot.shadowRoot);chrome(view);
    };
    if(window.ANOVATOR_OXYGEN_MOUNT&&window.ANOVATOR_OXYGEN_THREE&&window.ANOVATOR_OXYGEN_MATERIAL&&window.ANOVATOR_OXYGEN_TEMPLATE&&window.ANOVATOR_OXYGEN_ART)attach();
    else load().then(attach).catch(error=>{
      if(current!==view)return;slot.textContent=resultControls?'The test screen could not load.':'血氧画面未能加载。';
      const retry=document.createElement('button');retry.textContent=resultControls?'Try again':'重试';retry.onclick=()=>{current=null;repaint();};slot.append(retry);console.error(error);
    });
  }
  function controls(s){
    const c=s.oxygenFlow?.participantId===s.user?.id?s.oxygenFlow:{};
    const systemReduce=typeof matchMedia!=='undefined'&&matchMedia('(prefers-reduced-motion: reduce)').matches;
    return '<fieldset data-oxygen-review><legend>指夹与读数模拟</legend>'+
      '<label>外设事件<select data-oxygen-control="fault">'+Object.entries(faults).map(([id,text])=>'<option value="'+id+'" '+(id===(c.fault||'normal')?'selected':'')+'>'+text+'</option>').join('')+'</select></label>'+
      [['oxygen','血氧 %',90,100,98],['pulse','脉率 bpm',54,108,72]].map(([id,label,min,max,initial])=>'<label>'+label+'<input type="number" data-oxygen-control="'+id+'" min="'+min+'" max="'+max+'" value="'+(c.settings?.[id]??initial)+'"></label>').join('')+
      [['connected','指夹已连接',s.settings.peripherals.oximeter],['contact','手指接触有效',c.contact!==false],['reduced','减少动效',(directEnd&&systemReduce)||(c.reduced??systemReduce)],['slow','半速回看',c.slow]].map(([id,label,checked])=>'<label><input type="checkbox" data-oxygen-control="'+id+'" '+(checked?'checked':'')+'>'+label+'</label>').join('')+
      (automatic()?'':'<button type="button" data-oxygen-step>前进 0.5 秒</button>')+'<output aria-label="血氧流程状态">'+stageLabel(c.stage)+'</output></fieldset>';
  }
  return {isPage:oxygenPage,sync,controls,
    canRetain(slot){
      const s=getState();
      return !!current&&current.node===slot&&current.session===s&&oxygenPage(s)&&current.key===key(s);
    },
    beforeRender(){if(current)current.focus=current.node.shadowRoot?.activeElement;},
    change(el){if(el.type==='number'&&(!el.value||!el.checkValidity()))return;current?.instrument?.configure(el.dataset.oxygenControl,el.type==='checkbox'?el.checked:el.value);},
    step(){current?.instrument?.step();}};
};
