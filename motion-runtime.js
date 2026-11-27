(function(root){
 'use strict';
 const motion=root.ANOVATOR_MOTION_TESTS;
 const preference=matchMedia('(prefers-reduced-motion: reduce)');
 let audio=null;
 let lastCue='',renderTimer=0,fluid=null;
 let presentation=null;
 let fieldPromise=null,solverPromise=null;
 const postureArt=new Map();

 function armSound(id){
   if(!['balance','shoulder','pushups','jump','scan360'].includes(id))return;
   try {
     audio??=new AudioContext();
     if(audio.state==='suspended')audio.resume().catch(()=>{});
   } catch {}
 }

 function soundCue(kind){
   if(audio?.state!=='running')return;
   const tones=kind==='finish'?[820,605]:kind==='retry'?[420,420]:kind==='count'?[660]:[620,830];
   for(const [i,frequency] of tones.entries()){
     const start=audio.currentTime+.02+i*.15;
     const oscillator=audio.createOscillator(),gain=audio.createGain();
     oscillator.frequency.value=frequency;
     gain.gain.setValueAtTime(.001,start);
     gain.gain.exponentialRampToValueAtTime(.075,start+.016);
     gain.gain.exponentialRampToValueAtTime(.001,start+.112);
     oscillator.connect(gain).connect(audio.destination);
     oscillator.start(start);
     oscillator.stop(start+.12);
   }
 }

 function syncSound(s,screen){
   const a=s.acq,q=a?.motion;
   if(!q||!screen)return;
   let type=null;
   if(q.id==='balance'&&q.phase==='holding'||q.id==='jump'&&q.phase==='go'||q.id==='pushups'&&q.phase==='repeating'&&q.count===null)type='start';
   if(q.phase==='release')type='finish';
   if(['invalid','lost'].includes(q.phase))type='retry';
   if(q.id==='pushups'&&q.phase==='repeating'&&q.note==='counted')type='count';
   if(q.id==='pushups'&&q.phase==='repeating'&&q.note==='rejected')type='retry';
   if(s.stop&&q.id==='balance')type='finish';
   const phase=q.id==='pushups'&&q.phase==='repeating'?q.phase+':'+q.version:q.phase;
   const key=[s.user?.id,a.id,phase,s.stop?.requested,type].join('/');
   screen.dataset.hasSound=String(audio?.state==='running');
   if(q.id==='balance'&&['position','holding'].includes(q.phase)&&audio?.state!=='running'){
     const instruction=screen.querySelector('.balance-position-cue,.motion-intro');
     if(instruction)instruction.textContent='Keep your eyes open in this demo. Follow the on-screen cues.';
   }
   if(type&&key!==lastCue){lastCue=key;soundCue(type);}
 }

 function syncClock(){
   clearInterval(renderTimer);
   const el=document.querySelector('[data-hold-start]');
   if(!el)return;
   const t0=Number(el.dataset.holdStart);
   const track=document.querySelector('.direct-navigation .balance-time-track');
   const tick=()=>{
     const remaining=Math.min(motion.holdMs,Math.max(0,motion.holdMs-Date.now()+t0));
     const seconds=String(Math.ceil(remaining/1000));
     if(el.textContent!==seconds)el.textContent=seconds;
     track?.style.setProperty('--balance-time-left',String(remaining/motion.holdMs));
   };
   tick();
   renderTimer=setInterval(tick,100);
 }

 function motionTiming(screen){
   const values=getComputedStyle(screen);
   const duration=(name,fallback)=>parseFloat(values.getPropertyValue('--motion-'+name))||fallback;
   const ease=(name,fallback)=>values.getPropertyValue('--motion-ease-'+name).trim()||fallback;
   return {
     enter:duration('enter',170),read:duration('read',192),gap:duration('gap',45),
     easeEnter:ease('enter','cubic-bezier(.22,1,.36,1)'),
     easeRead:ease('read','cubic-bezier(.24,.68,.35,1)')
   };
 }

 function animate(node,name,frames,options){
   if(!node?.animate)return null;
   return node.animate(frames,{...options,id:'assessment-'+name});
 }

 function reveal(screen,selector,timing,delay=0,offset=4){
   for(const element of screen.querySelectorAll(selector)){
     if(element instanceof HTMLImageElement&&!element.naturalWidth)continue;
     const opacity=Number(getComputedStyle(element).opacity);
     animate(element,'reveal',[{opacity:opacity*.64,translate:'0 '+offset+'px'},{opacity,translate:'0 0'}],{
       duration:timing.enter,easing:timing.easeEnter,delay,fill:'backwards'
     });
   }
 }

 function warmPostureArt(){
   const base='assets/posture-ui/';
   const views=['front','side'].flatMap(view=>[base+'result/'+view+'/specimen-mask.svg']);
   for(const url of [base+'gold-family-front-side-v01.png',...views]){
     if(postureArt.has(url))continue;
     const image=new Image();
     image.src=url;
     postureArt.set(url,image);
     image.decode().catch(()=>postureArt.delete(url));
   }
 }

 function revealLateArtwork(screen,timing){
   const images=screen.querySelectorAll('.pose-field img,.pose-result-art img.pose-public-specimen,.grip-ready-figure,.grip-ready-detail img,.accessory-figure,.balance-ready-pose,.motion-ready-art img,.rope-ready-art');
   for(const image of images){
     if(image.naturalWidth)continue;
     image.style.opacity='0';
     image.decode().then(()=>{
       if(!image.isConnected)return;
       image.style.removeProperty('opacity');
       if(preference.matches)return;
       const opacity=Number(getComputedStyle(image).opacity);
       animate(image,'artwork',[{opacity:0},{opacity}],{duration:timing.enter,easing:timing.easeEnter});
     },()=>image.style.removeProperty('opacity'));
   }
 }

 function presentPose(screen,phase,last,view,timing){
   if(last?.phase===phase&&last.view===view)return;
   const result=['result','detail'].includes(phase);
   if(result){
     // The captured image remains anchored. References and paired values follow it.
     reveal(screen,'[data-pose-art-layer="grid"]',timing,0,0);
     const columns=[...screen.querySelectorAll('.pose-readings')];
     const rows=Math.max(0,...columns.map(column=>column.children.length));
     for(let i=0;i<rows;i++)reveal(screen,'.pose-readings .pose-reading:nth-child('+(i+1)+')',
       timing,timing.gap*(i+1),3);
   }else{
     reveal(screen,'.pose-instruction h2,.pose-empty h2',timing);
     reveal(screen,'.pose-instruction p,.pose-empty p',timing,timing.gap,3);
     if(last?.view!==view)reveal(screen,'.pose-field > img',timing,0,0);
   }
 }

 function materialPose(material){
   const style=getComputedStyle(material);
   const matrix=style.transform==='none'?new DOMMatrix():new DOMMatrix(style.transform);
   return {x:matrix.a,y:matrix.d,opacity:Number(style.opacity)};
 }

 function currentMaterial(pose){
   const t=pose.animation?.pending?0:pose.animation?.effect?.getComputedTiming().progress??1;
   return Object.fromEntries(Object.entries(pose.to).map(([key,goal])=>[key,pose.from[key]+(goal-pose.from[key])*t]));
 }

 function presentAccessory(screen,next,last,timing){
   const {phase,view}=next;
   if(last?.phase!==phase||last?.view!==view){
     reveal(screen,'.accessory-phrase,.grip-ready-intro,.accessory-recovery',timing);
     if(phase==='ready')reveal(screen,'.accessory-breath li + li,.grip-ready-stance',timing,timing.gap);
     if(phase==='handoff'||phase==='handoff-ready')reveal(screen,'.grip-handoff-note',timing,timing.gap);
     // The volume shown while saving is already the final reading.
     if(phase==='result'&&!(next.id==='lung'&&last?.phase==='settling')){
       reveal(screen,'.accessory-reading',timing,timing.gap,3);
     }
   }
   const material=screen.querySelector('.accessory-material');
   if(!material)return;
   const to=materialPose(material),from=last?.material?currentMaterial(last.material):to;
   const frame=pose=>({transform:'scale('+pose.x+','+pose.y+')',opacity:pose.opacity});
   const changes=Object.keys(to).some(key=>Math.abs(to[key]-from[key])>.001);
   const animation=changes?animate(material,'sample-material',[frame(from),frame(to)],{
     duration:timing.read,easing:timing.easeRead
   }):null;
   next.material={from,to,animation};
 }

 function presentBodyTask(screen,next,last,timing){
   const {id,phase,view}=next;
   const changed=last?.phase!==phase||last?.view!==view;
   if(changed){
     // Keep the apparatus and numbers in place when a new cue takes over.
     reveal(screen,'.motion-prep-copy,.shoulder-motion-callout,.motion-intro,.balance-fault',timing,0,3);
     if(phase==='ready')reveal(screen,'.motion-ready-art,.balance-ready-pose',timing,timing.gap,2);
     if(phase==='result')reveal(screen,'.shoulder-results section',timing,timing.gap,3);
   }
   const previousCount=last?.attempt===next.attempt?last?.count:0;
   if(id==='pushups'&&phase==='repeating'&&next.note==='counted'&&next.count>(previousCount??0)){
     animate(screen.querySelector('.push-motion-points'),'rep-accepted',[
       {opacity:1,filter:'drop-shadow(0 0 5px #ecf5ff)'},
       {opacity:.74,filter:'none'}
     ],{duration:timing.read,easing:timing.easeRead});
   }
   if(id==='jump'&&changed&&['airborne','landing'].includes(phase)){
     const rising=phase==='airborne';
     animate(screen.querySelector('.jump-lift'),'jump-trajectory',[
       {transform:rising?'translateY(0)':'translateY(-18px)',opacity:rising?.64:1},
       {transform:rising?'translateY(-18px)':'translateY(0)',opacity:rising?1:.55}
     ],{duration:timing.enter,easing:timing.easeEnter});
   }
   if(id==='balance'&&phase==='result'&&last?.phase==='release'&&last.attempt===next.attempt){
     const vessel=screen.querySelector('.balance-vessel');
     animate(vessel,'balance-receipt',[
       {filter:'brightness(1)'},{filter:'brightness(1.14)',offset:.35},{filter:'brightness(1)'}
     ],{duration:timing.read+timing.enter,easing:timing.easeRead});
   }
 }

 function syncPresentation(s){
   const screen=document.querySelector('.direct-navigation :is(.pose-screen,.accessory-screen,.motion-stage,.rope-screen)');
   if(!screen){presentation=null;return;}
   const data=screen.dataset,q=s.acq?.motion;
   const id=data.motionTest||data.accessory||(data.poseStage?'posture':'rope');
   const phase=data.motionPhase||data.accessoryStage||data.poseStage||data.ropeStage;
   if(id==='posture'&&phase==='prepare')warmPostureArt();
   const timing=motionTiming(screen);
   revealLateArtwork(screen,timing);
   if(preference.matches){presentation=null;return;}
   const view=data.poseView??screen.querySelector('.grip-ready-figure')?.dataset.hand??
     (id==='shoulder'&&q?motion.direction(q):s.retakeView);
   const attempt=s.acq?.id??s.results[id]?.acqId;
   const next={id,phase,view,attempt,count:q?.count,note:q?.note};
   const last=presentation?.id===id?presentation:null;
   presentation=next;
   if(id==='scan360')return;
   if(id==='posture')presentPose(screen,phase,last,view,timing);
   else if(data.accessory)presentAccessory(screen,next,last,timing);
   else if(data.motionTest)presentBodyTask(screen,next,last,timing);
   else if(last?.phase!==phase){
     reveal(screen,'.rope-instruction',timing);
     if(phase==='ready')reveal(screen,'.rope-ready-art,.rope-note',timing,timing.gap,3);
   }
 }

 function closeFluid(){
   if(!fluid)return;
   fluid.renderer?.dispose?.();
   clearTimeout(fluid.fallback);
   fluid.worker?.terminate();
   fluid.local?.({type:'pause',epoch:1,value:true});
   fluid=null;
 }

 function fluidTransport(scene,onFrame){
   function local(){
     if(scene.local||scene.switching||fluid!==scene)return;
     scene.switching=true;
     scene.worker?.terminate();scene.worker=null;
     clearTimeout(scene.fallback);
     solverPromise??=import('./balance-solver.js');
     solverPromise.then(module=>{
       if(fluid!==scene)return;
       scene.local=module.createLocalTank(onFrame);
       scene.canvas.dataset.solver='main';
       scene.local({type:'reset',epoch:1});
       steer(scene);
     }).catch(()=>{if(fluid===scene)scene.canvas.dataset.solver='unavailable';});
   }
   try{
     if(new URLSearchParams(location.search).get('renderer')==='canvas'){local();return;}
     scene.worker=new Worker(new URL('./assets/motion-ui/balance-tank.js',document.baseURI),{type:'module'});
     scene.worker.addEventListener('message',event=>{
       if(fluid!==scene)return;
       clearTimeout(scene.fallback);onFrame(event.data);
     });
     scene.worker.addEventListener('error',event=>{event.preventDefault();local();});
     scene.worker.postMessage({type:'reset',epoch:1});
     scene.fallback=setTimeout(local,2400);
     scene.canvas.dataset.solver='worker';
   }catch{local();}
 }

 function steer(scene){
   if(!scene.signal)return;
   const [roll,pitch]=scene.signal;
   const packet={type:'turn',epoch:1,roll,pitch};
   if(scene.worker)scene.worker.postMessage(packet);
   else scene.local?.(packet);
 }

 async function mountFluid(scene){
   try{
     fieldPromise??=import('./balance-field.js');
     const field=await fieldPromise;
     if(fluid!==scene)return;
     const forceCanvas=new URLSearchParams(location.search).get('renderer')==='canvas';
     async function fallback(){
       if(scene.compat||fluid!==scene)return;
       scene.compat=true;
       scene.renderer?.dispose?.();scene.renderer=null;
       const replacement=scene.canvas.cloneNode(false);
       scene.canvas.replaceWith(replacement);scene.canvas=replacement;
       try{
         const renderer=await field.buildCompatibleVessel(replacement);
         if(fluid!==scene)return;
         install(renderer);
       }catch{if(fluid===scene)scene.host.dataset.renderer='unavailable';}
     }
     function install(renderer){
       scene.renderer=renderer;
       renderer.appearance('water');
       scene.host.dataset.renderer=scene.canvas.dataset.engine;
       if(scene.lastFrame)renderFrame(scene.lastFrame);
       else if(!scene.transport){
         scene.transport=true;
         fluidTransport(scene,renderFrame);
       }
     }
     function renderFrame(frame){
       if(fluid!==scene||!scene.renderer)return;
       scene.lastFrame=frame;
       try{
         scene.renderer.update(frame);
         scene.host.dataset.ready='true';
       }catch{fallback();}
     }
     if(forceCanvas){await fallback();return;}
     try{
       const three=await import('three');
       if(fluid!==scene)return;
       const webgl=scene.canvas.getContext('webgl2',{alpha:false,preserveDrawingBuffer:true});
       if(!webgl){await fallback();return;}
       scene.canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();fallback();},{once:true});
       install(field.buildVesselView(three,scene.canvas,webgl));
     }catch{await fallback();}
   }catch{if(fluid===scene)scene.host.dataset.renderer='unavailable';}
 }

 function syncFluid(s){
   const host=document.querySelector('.balance-vessel');
   if(!host){closeFluid();return;}
   const view=host.dataset.fluidAttempt;
   if(fluid?.id!==view){
     closeFluid();
     const canvas=host.querySelector('canvas')||document.createElement('canvas');
     canvas.setAttribute('aria-hidden','true');
     host.append(canvas);
     fluid={id:view,host,canvas,signal:null,transport:false};
     mountFluid(fluid);
   }else{
     const {canvas}=fluid;
     fluid.host=host;host.replaceChildren(canvas);
     if(fluid.lastFrame)host.dataset.ready='true';
     if(canvas.dataset.engine)host.dataset.renderer=canvas.dataset.engine;
   }
   const q=s.acq?.motion;
   const signal=!preference.matches&&q?.phase==='holding'?[q.roll||0,q.pitch||0]:[0,0];
   if(signal[0]!==fluid.signal?.[0]||signal[1]!==fluid.signal?.[1]){
     fluid.signal=signal;
     steer(fluid);
   }
 }

 function sync(s){
   const screen=document.querySelector('[data-motion-test]');
   const q=s.acq?.motion;
   if(screen&&q?.id==='pushups'&&q.note)screen.dataset.repOutcome=q.note;
   syncSound(s,screen);syncClock();syncFluid(s);syncPresentation(s);
 }

 root.ANOVATOR_MOTION_RUNTIME={sync,armSound};
})(globalThis);
