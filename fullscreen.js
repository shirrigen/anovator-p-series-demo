(function(){
'use strict';
// Presentation only: measurement state and device events stay in app/engine.
let active=false,controlsOpen=false,nativeSeen=false,panelWasOpen=false,requestId=0,restoreScroll=0;
const q=s=>document.querySelector(s);
const display=text=>window.ANOVATOR_REVIEW_EN?.text(text)||text;
const fullscreenElement=()=>document.fullscreenElement||document.webkitFullscreenElement;
function sync(){
  document.body.classList.toggle('screen-fullscreen',active);
  document.body.classList.toggle('screen-controls-open',active&&controlsOpen);
  const viewport=q('.device-viewport'),device=q('.device'),stage=q('.device-stage');
  if(!viewport||!device||!stage)return;
  if(active){
    const bounds=stage.getBoundingClientRect();
    const scale=Math.min(bounds.width/540,bounds.height/960);
    viewport.style.width=(540*scale)+'px';
    viewport.style.height=(960*scale)+'px';
    device.style.transform='scale('+scale+')';
    const panel=q('details#demo-controls');
    if(panel)panel.open=controlsOpen;
  }else{
    viewport.style.removeProperty('width');
    viewport.style.removeProperty('height');
    device.style.transform='scale('+(viewport.getBoundingClientRect().width/540)+')';
  }
  const controls=q('[data-screen-action="controls"]');
  if(controls){controls.textContent=controlsOpen?'收起演示控制':'演示控制';controls.setAttribute('aria-expanded',String(controlsOpen));}
  const label=q('#screen-mode-label');
  if(label)label.textContent=display(nativeSeen?'全屏触控体验':'窗口触控体验');
}
function leavePresentation(){
  active=false;controlsOpen=false;nativeSeen=false;requestId++;
  sync();
  const panel=q('details#demo-controls');if(panel)panel.open=panelWasOpen;
  window.scrollTo(0,restoreScroll);
  q('[data-screen-action="enter"]')?.focus({preventScroll:true});
}
async function exit(){
  const exitNative=document.exitFullscreen||document.webkitExitFullscreen;
  if(fullscreenElement()&&exitNative){
    try{await exitNative.call(document);}catch{}
    // If native exit failed, leave the escape control available.
    if(fullscreenElement())return;
  }
  leavePresentation();
}
async function enter(){
  if(active)return;
  restoreScroll=window.scrollY;
  panelWasOpen=!!q('details#demo-controls')?.open;
  active=true;controlsOpen=false;nativeSeen=false;
  const attempt=++requestId;
  sync();
  q('[data-screen-action="exit"]')?.focus({preventScroll:true});
  const root=document.documentElement;
  const request=root.requestFullscreen||root.webkitRequestFullscreen;
  if(request){
    try{
      // The stable root survives app.innerHTML replacement during navigation.
      await request.call(root);
      if(attempt!==requestId){
        const cancel=document.exitFullscreen||document.webkitExitFullscreen;
        if(fullscreenElement()&&cancel)await cancel.call(document);
        return;
      }
      nativeSeen=!!fullscreenElement();
    }catch(error){
      // Unsupported/denied native fullscreen still gets a window-filling view.
      console.info('Fullscreen unavailable; using fitted window mode:',error.name,error.message);
    }
  }
  sync();
}
document.addEventListener('click',event=>{
  const button=event.target.closest('[data-screen-action]');
  if(!button)return;
  event.preventDefault();
  if(button.dataset.screenAction==='enter')void enter();
  else if(button.dataset.screenAction==='exit')void exit();
  else if(button.dataset.screenAction==='controls'){controlsOpen=!controlsOpen;sync();}
});
document.addEventListener('toggle',event=>{
  if(active&&event.target.id==='demo-controls'&&event.target.isConnected&&controlsOpen!==event.target.open){
    controlsOpen=event.target.open;
    sync();
  }
},true);
function nativeChanged(){
  if(!active)return;
  if(fullscreenElement()){nativeSeen=true;sync();}
  else if(nativeSeen)leavePresentation();
}
document.addEventListener('fullscreenchange',nativeChanged);
document.addEventListener('webkitfullscreenchange',nativeChanged);
document.addEventListener('keydown',event=>{
  if(active&&event.key==='Escape'&&!fullscreenElement())void exit();
});
window.addEventListener('resize',sync);
window.visualViewport?.addEventListener('resize',sync);
window.ANOVATOR_SCREEN={sync};
sync();
})();
