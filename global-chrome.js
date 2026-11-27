(function(root){
  'use strict';
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const names={body:'体成分',bp:'血压',oxygen:'血氧',posture:'体态',shoulder:'肩活动度',lung:'肺活量',balance:'平衡',agility:'反应',grip:'握力',jump:'纵跳',pushups:'俯卧撑',rope:'跳绳',vision:'视力',color:'色觉',astigmatism:'散光',scan360:'三维体型'};
  const sideName=side=>side==='right'?'右手':'左手';
  const asset='assets/chrome-v04/';
  const icon=(name,size=18,sourceSize=48)=>`<span class="gn-utility" aria-hidden="true" style="--gn-icon:${size}px;--gn-icon-source:${sourceSize}px;--gn-icon-scale:${size/sourceSize}"><img src="${asset+name}.svg" alt="" width="${sourceSize}" height="${sourceSize}"></span>`;
  function currentIds(s){
    if(['group-prepare','group-measure','group-result'].includes(s.route))return s.group?.members||[];
    if(/^(prepare|measure|result)\//.test(s.route))return [s.route.split('/')[1]];
    if(['metric','health','segments'].includes(s.route))return ['body'];
    if(s.route==='posture-summary')return ['posture'];
    if(['prerequisites','recovery'].includes(s.route))return [s.pendingTest];
    return [];
  }
  const overview=s=>s.route==='home'||s.route==='results';
  const switchingLocked=s=>!!s.acq||(s.mode==='retest'&&(s.route.startsWith('prepare/')||['prerequisites','recovery'].includes(s.route)));
  function hasNavigation(s,E){return !E.singleBodyOnly(s)&&!!s.user&&s.consent&&!s.selectedHistory&&!s.privacyLocked&&(overview(s)||currentIds(s).length>0);}
  function canOpenDirectory(s,E){return hasNavigation(s,E)&&!switchingLocked(s);}
  function header(s,b){
    const busy=!!s.acq||s.privacyLocked||s.route==='settings',settings=busy?' chrome-service-hidden':'';
    return `<div class="device-top gn-header" data-design-node="678:6260" aria-label="品牌与设备服务"><div class="gn-header-native"><button class="gn-service gn-settings${settings}" data-action="settings" aria-label="设置" ${busy?'disabled aria-hidden="true" tabindex="-1"':''}><img src="${asset}header-settings.svg" alt=""></button><div class="gn-logo"><img src="${asset}header-logo.svg" alt="ANOVATOR"></div><div class="gn-service gn-wifi ${s.settings.network==='online'?'':'is-offline'}" role="img" aria-label="${s.settings.network==='online'?'网络已连接':'网络离线'}"><img src="${asset}header-wifi.svg" alt="">${s.settings.network==='online'?'':'<span class="gn-offline-label">Offline</span>'}</div></div></div>`;
  }
  function navigation(s,E,b,previewId=null,direct=false){
    if(!hasNavigation(s,E))return '';
    const atHome=overview(s),ids=atHome?(previewId?[previewId]:[]):currentIds(s),busy=!!s.acq;
    const english=atHome||s.route.endsWith('/bp')||s.route.endsWith('/oxygen');
    const directoryLabel=english?'All tests':'全部项目';
    const homeLabel=english?'This session':'本次测量';
    const home=direct?'':b(homeLabel,'preview-home',{},'gn-overview-entry',switchingLocked(s));
    const status={unmeasured:'未测',interrupted:'未完成',partial:'部分完成',failed:'需重测',skipped:'已跳过','needs-review':'需重测'};
    return `<section class="completion-receipt gn-project-navigation ${E.activeIds(s).length<=4?'receipt-compact':'receipt-many'}" data-design-node="747:12085" aria-label="项目导航"><div class="receipt-heading gn-sr-only"><span>可测项目</span>${busy?'<span class="navigation-readonly">测量中</span>':''}<div class="receipt-controls" hidden><button data-action="scroll-completed" data-payload='{"direction":-1}' aria-label="查看前面的项目">‹</button><button data-action="scroll-completed" data-payload='{"direction":1}' aria-label="查看后面的项目">›</button></div></div><div class="gn-navigation-native"><div class="gn-navigation-row">${home}<nav class="receipt-list" aria-label="设备项目导航">${E.activeIds(s).map(id=>{
      const current=ids.includes(id),done=E.hasComplete(s,id),record=s.results[id];
      const partial=!!record?.partial;
      const readable=record&&record.participantId===s.user.id&&!record.needsReview;
      const blocked=(!atHome||direct)&&id!=='body'&&!E.mandatoryReady(s)&&!(direct?readable:record);
      const label=current&&busy?(s.stop?'正在停止':s.group?.states[id]==='done'?'已完成':'测量中'):done?'已完成':current&&s.route.startsWith('prepare/')?(s.lastStop?.testId===id?'未完成':'准备中'):blocked?'需先测体成分':status[s.status[id]]||'未测';
      const destination=direct?(blocked?'':readable?' · View result':' · Prepare'):' · 速览';
      return `<button class="receipt-item ${done?'is-complete':partial?'is-partial':'not-complete'} ${current?'is-current':''}" aria-label="${esc((names[id]||E.test(id).name)+' · '+label+destination)}" data-action="${direct?'open-direct-project':'preview-project'}" data-project-id="${esc(id)}" data-payload="${esc(JSON.stringify({id}))}" ${current?'aria-current="page"':''} ${switchingLocked(s)?'disabled':''}><span class="gn-nav-art" aria-hidden="true"><img src="${asset}project-${id}.svg" alt="" width="32" height="32"></span><span class="receipt-light" aria-hidden="true"></span><span class="gn-current-line" aria-hidden="true"></span><span class="gn-sr-only">${esc(names[id]||E.test(id).name)}<small>${esc(label)}</small></span></button>`;
    }).join('')}</nav>${b(directoryLabel,'directory-open',{},'all-projects',!canOpenDirectory(s,E))}</div></div><div class="gn-nav-divider" aria-hidden="true"></div></section>`;
  }
  function bindProjectDrag(rail){
    if(!rail||rail.scrollWidth<=rail.clientWidth+1)return;
    let gesture=null,suppressClick=false;
    rail.classList.add('is-scrollable');
    rail.addEventListener('pointerdown',event=>{
      suppressClick=false;
      if(event.pointerType==='touch'||event.button!==0||event.isPrimary===false)return;
      const width=rail.getBoundingClientRect().width;
      gesture={id:event.pointerId,x:event.clientX,y:event.clientY,left:rail.scrollLeft,scale:width/rail.clientWidth||1,dragging:false};
    });
    rail.addEventListener('pointermove',event=>{
      if(!gesture||event.pointerId!==gesture.id)return;
      const dx=event.clientX-gesture.x,dy=event.clientY-gesture.y;
      if(!gesture.dragging){
        if(Math.max(Math.abs(dx),Math.abs(dy))<6)return;
        if(Math.abs(dy)>Math.abs(dx)){gesture=null;return;}
        gesture.dragging=true;
        rail.classList.add('is-dragging');
        rail.setPointerCapture(event.pointerId);
      }
      event.preventDefault();
      rail.scrollLeft=Math.max(0,Math.min(rail.scrollWidth-rail.clientWidth,gesture.left-dx/gesture.scale));
    });
    const finish=event=>{
      if(!gesture||event.pointerId!==gesture.id)return;
      const dragged=gesture.dragging;gesture=null;
      rail.classList.remove('is-dragging');
      if(dragged)suppressClick=true;
      if(rail.hasPointerCapture(event.pointerId))rail.releasePointerCapture(event.pointerId);
    };
    rail.addEventListener('pointerup',finish);
    rail.addEventListener('pointercancel',finish);
    rail.addEventListener('lostpointercapture',finish);
    rail.addEventListener('click',event=>{
      if(!suppressClick||event.detail===0)return;
      suppressClick=false;event.preventDefault();event.stopPropagation();
    },true);
    rail.addEventListener('dragstart',event=>event.preventDefault());
  }
  // Progressive chrome presentation only. Existing buttons, payloads and engine decisions are reused.
  function mount(s,E){
    if(typeof document==='undefined')return;
    const bottom=document.querySelector('.device-bottom');if(!bottom)return;
    const slot=bottom.querySelector('.device-actions'),footer=bottom.querySelector('.device-footer');
    const navigation=bottom.querySelector('.gn-project-navigation');
    if(navigation){
      const index=navigation.querySelector('[data-action="directory-open"]');
      const label=index.textContent.trim();
      index.setAttribute('aria-label',label);
      index.setAttribute('aria-haspopup','dialog');
      index.innerHTML=icon('projects',16)+`<span class="gn-index-label">${esc(label)}</span>`;
      const home=navigation.querySelector('.gn-overview-entry');
      if(home){
        const label=home.textContent.trim();
        home.setAttribute('aria-label',label);
        if(overview(s)&&!s.homeProject)home.setAttribute('aria-current','page');
        home.innerHTML=icon('back',16)+`<span class="gn-index-label">${esc(label)}</span>`;
      }
      bindProjectDrag(navigation.querySelector('.receipt-list'));
    }
    let row=slot?.querySelector('.task-actions');
    if(row&&footer){
      for(const button of [...footer.querySelectorAll('button')])row.append(button);
      footer.replaceChildren();footer.hidden=true;
    }
    if(!row&&footer&&footer.querySelector('button')){
      row=document.createElement('div');row.className='wrap task-actions';
      row.append(...footer.childNodes);footer.append(row);footer.hidden=false;
    }
    if(!row){if(slot)slot.hidden=true;bottom.classList.toggle('gn-has-navigation',!!navigation);return;}
    const buttons=[...row.querySelectorAll('button')];
    const primary=buttons.find(el=>el.classList.contains('primary'));
    const session=buttons.find(el=>(el.dataset.action==='end'||el.matches('.st-session,.result-return'))&&el!==primary);
    const optional=buttons.find(el=>el.dataset.action==='append-next');
    const optionalTarget=optional?.closest('.optional-next')?.querySelector('strong')?.textContent||'';
    const optionalCaption=optional?.closest('.optional-next')?.querySelector('small')?.textContent||'可选测量';
    const secondary=buttons.filter(el=>el!==primary&&el!==session&&el!==optional);
    for(const el of [...row.children])if(el.tagName!=='BUTTON')el.remove();
    row.replaceChildren(...[session,...secondary,primary||optional].filter(Boolean));
    if(primary&&optional)row.append(optional);
    for(const button of [...row.querySelectorAll('button')]){
      const label=button.textContent.trim(),action=button.dataset.action;
      const resume=action==='return-to-task'?label.match(/^Back to (.+) prep$/):null;
      const readBack=action==='return-reading'?label.match(/^Back to (.+)$/):null;
      const match=label.match(/^(下一项|Next|Prepare)\s*·\s*(.+)$/);
      button.setAttribute('aria-label',label);button.classList.add('gn-action');
      if(button===session){
        const back=button.classList.contains('result-return');
        button.classList.add('gn-session');
        const recorded=button.classList.contains('recorded-session-end');
        const glyph=recorded?icon('end-h08-14',14,14):icon(back?'back':'end',14);
        button.innerHTML=glyph+`<span>${esc(back?'Back':label)}</span>`;
      }
      else if(action==='stop'){
        button.classList.add('gn-stop');button.innerHTML=`<span class="gn-action-visual">${icon('stop',14)}<span>${esc(label)}</span></span>`;
      }else if(button===primary||button===optional){
        const target=resume?.[1]||readBack?.[1]||match?.[2]||(action==='append-next'?optionalTarget:'');
        if(target){
          const caption=resume?'Resume prep':readBack?'Back to':action==='append-next'?optionalCaption:match[1];
          button.classList.add('gn-forward');
          if(resume)button.classList.add('gn-resume');
          button.innerHTML=`<span class="gn-forward-copy"><span class="gn-action-caption">${esc(caption)}</span><strong>${esc(target)}</strong></span><span class="gn-forward-disc">${icon(resume||readBack?'back':'next',18)}</span>`;
        }else{
          const isRetest=/retest|retry/.test(action)||(root.ANOVATOR_ROUTE_REVIEW&&label.startsWith('Retest '));
          const utility=/stop/.test(action)?'stop':isRetest?'retest':action==='end'||/finish|exit/.test(action)?'done':button.classList.contains('is-back')||/return|back|resume-assessment/.test(action)?'back':action==='view-completed'?'next':'start';
          button.classList.add('gn-primary');button.innerHTML=`<span class="gn-action-visual">${icon(utility,16)}<span>${esc(label)}</span></span>`;
        }
      }else{
        button.classList.add('gn-secondary');
        const forward=action==='return-to-task'&&match?.[1]==='Next';
        const utility=forward?'next':/retest|retry|fill-test/.test(action)?'retest':/home/.test(action)?'projects':/return|resume|back/.test(action)?'back':/end|exit/.test(action)?'end':null;
        button.innerHTML=(utility?icon(utility,18):'')+`<span>${esc(resume?'Resume prep':readBack&&!root.ANOVATOR_ROUTE_REVIEW?'Back':label)}</span>`;
      }
    }
    const native=document.createElement('div');native.className='gn-task-native';native.append(row);
    row.classList.add('gn-action-row');native.dataset.designNode='748:12237';
    if(root.ANOVATOR_ROUTE_REVIEW&&hasNavigation(s,E)&&
       (s.route.startsWith('result/')||['metric','health','segments','posture-summary','group-result'].includes(s.route))){
      row.classList.add('gn-result-actions');
    }
    const target=slot&&!slot.hidden?slot:footer;target.replaceChildren(native);target.hidden=false;
    bottom.classList.toggle('gn-has-navigation',!!navigation);
  }
  function records(s,id){
    const rows=id==='grip'?(s.trials?.grip||[]):[];
    if(!rows.length)return '';
    return `<section class="local-records" aria-label="已有有效记录"><h2>已有记录</h2>${['left','right'].flatMap(side=>{const r=rows.filter(x=>x.side===side&&x.participantId===s.user?.id).at(-1);return r?[`<div class="local-record"><span>${sideName(side)} · 第 ${r.number} 次</span><strong>${r.value} <small>kg</small></strong><small>有效记录</small></div>`]:[];}).join('')}</section>`;
  }
  function status(s){
    if(!s.stop)return '';
    const text=s.stop.status==='releasing'?'袖带正在放气':s.stop.status==='unconfirmed'?(s.stop.confirmed?'设备仍在收尾':'暂未收到停止确认'):'正在停止';
    const extra=s.stop.status==='unconfirmed'?'<p>请联系工作人员检查设备。</p>':'';
    return `<div class="inline-stop-status" role="status" aria-live="polite"><strong>${text}</strong>${extra}</div>`;
  }
  function task(s,kind,id,c){
    const {E,b,scene,skipAction,reviewNote}=c,x=E.test(id),a=s.acq;
    const stopped=s.lastStop?.testId===id&&kind==='prepare',busy=kind==='measure'&&a?.testId===id;
    const name=id==='body'?'体成分分析':id==='grip'?'握力测试':x.name;
    const currentSide=id==='grip'?E.gripSide(s):null;
    const view=s.retakeView||a?.view;
    const target=({posture:{front:'正面',side:'侧面'},shoulder:{lf:'左前屈',rf:'右前屈',la:'左外展',ra:'右外展'}})[id]?.[view];
    const sub=id==='grip'?sideName(currentSide)+' · 当前尝试':target?'当前重测 · '+target:busy?'请按提示完成测量。':stopped?'准备好后，可重新测量':'准备好后，点击开始。';
    let content=`<header class="task-heading"><h1>${esc(name)}</h1><p class="muted">${sub}</p></header>`;
    if(id==='grip')content+=`<nav class="local-selector" aria-label="当前测量侧别">${['left','right'].map(side=>b(sideName(side)+(side===currentSide?' · 当前':''),'local-side',{side},side===currentSide?'active':'',busy)).join('')}</nav>`;
    if(!busy){
      content+=scene(id==='grip'?sideName(currentSide)+'握持示范':target?target+'示范':x.prep[0],'测量动作示意');
      if(stopped)content+=`<div class="inline-stop-status" role="status"><strong>${id==='grip'?'本次尝试已停止':'已停止'}</strong></div>`;
      if(id==='grip')content+=records(s,id);
      else content+=`<ol class="phase-list prep-conditions">${(target?[x.prep[0],'按示范完成'+target+'。']:x.prep).map(v=>`<li>${esc(v)}</li>`).join('')}</ol>`;
      const label=stopped?(id==='grip'?'再测'+sideName(currentSide):'重新测量'):id==='grip'?'开始测'+sideName(currentSide):'开始测量';
      const exit=stopped&&id==='grip'?b('跳过','skip-stopped'):stopped&&id==='bp'&&E.nextAfter(s,id)?b('下一项 · '+E.test(E.nextAfter(s,id)).name,'skip-stopped'):skipAction(id);
      content+=`<div class="wrap task-actions">${exit}${b(label,'start-measure',{id},'primary')}</div>`;
      return content+reviewNote('GN03 原位恢复：停止后的重测由用户发起。记录次数与采用规则仍待真实产品规程验证。');
    }
    if(id==='bp')content+=`<div class="scene pressure-scene"><div><span>袖带压力 · 示例</span><div class="big-reading">${s.stop?.status==='releasing'?'32':a.step===0?'—':a.step===1?'145':'96'} <small>mmHg</small></div><small>测量中读数不代表血压结果</small></div></div>`;
    else content+=scene(id==='grip'?sideName(currentSide)+' · '+x.stages[a.step]:x.stages[a.step],'测量示意');
    if(s.stop)content+=status(s);
    else content+=`<div class="acquisition-status" role="status"><strong>${id==='grip'?'本次尝试进行中':'正在采集'}</strong><small>${esc(x.stages[a.step])}</small></div>`;
    if(id==='grip')content+=records(s,id);
    const label=s.stop?'正在停止':id==='grip'?'停止本次':'停止测量';
    content+=`<div class="wrap task-actions">${s.stop?.status==='unconfirmed'?b('重试停止','retry-stop',{},'primary'):b(label,'stop',{},'stop-action',!!s.stop)}</div>`;
    return content;
  }
  function groupStop(s,c){
    return `<header class="task-heading"><h1>体成分与血压</h1><p class="muted">保持当前姿势</p></header>${c.scene('袖带与手柄','当前测量位置保持不变')}${status(s)}<section class="group-retained">${s.group.members.filter(id=>c.E.hasComplete(s,id)).map(id=>`<p>${esc(c.E.test(id).name)} · 已完成</p>`).join('')}</section><div class="wrap task-actions">${s.stop.status==='unconfirmed'?c.b('重试停止','retry-stop',{},'primary'):c.b('正在停止','stop',{},'stop-action',true)}</div>`;
  }
  root.ANOVATOR_GLOBAL_CHROME={header,navigation,hasNavigation,canOpenDirectory,currentIds,task,records,groupStop,mount,bindProjectDrag};
})(globalThis);
