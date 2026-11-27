(function(root){
  'use strict';

  const reduced = root.matchMedia('(prefers-reduced-motion: reduce)');
  const enter = 'cubic-bezier(.22, 1, .36, 1)';
  const read = 'cubic-bezier(.24, .62, .36, 1)';
  const moving = new Set();
  let current = null;

  reduced.addEventListener('change', event => {
    if (event.matches) for (const animation of moving) animation.cancel();
  });

  function animate(node, frames, {duration = 170, delay = 0, easing = enter} = {}){
    if (reduced.matches || !node?.animate) return;
    const animation = node.animate(frames,{duration,delay,easing,fill:'backwards'});
    moving.add(animation);
    animation.finished.then(() => moving.delete(animation), () => moving.delete(animation));
  }

  function settle(node, {distance = 6, delay = 0, opacity = .65, duration = 170, easing = enter} = {}){
    animate(node, [
      {translate:'0 '+distance+'px',opacity},
      {translate:'0 0',opacity:1}
    ],{duration,delay,easing});
  }

  function snapshot(device){
    const nav = device?.querySelector('.receipt-list');
    const line = nav?.querySelector('[aria-current="page"] .gn-current-line');
    if (!line) return null;
    const {left,right} = line.getBoundingClientRect();
    const viewport = nav.getBoundingClientRect();
    return {id:line.closest('[data-project-id]').dataset.projectId,
      center:(left+right)/2, visible:left>=viewport.left-.5&&right<=viewport.right+.5};
  }

  function projectSelection(device, previous){
    const selected = device.querySelector('.receipt-list [aria-current="page"]');
    if (!selected || previous?.id===selected.dataset.projectId) return;
    const line = selected.querySelector('.gn-current-line');
    if (!line) return;
    const {left,right} = line.getBoundingClientRect();
    const scale = device.getBoundingClientRect().width/device.offsetWidth || 1;
    const offset = previous?.visible ? (previous.center-(left+right)/2)/scale : 0;
    if (offset && Math.abs(offset)<=112) {
      animate(line,[{translate:offset+'px 0'},{translate:'0 0'}],{duration:192});
    } else {
      animate(line,[{scale:'.4 1',opacity:.8},{scale:'1 1',opacity:1}]);
    }
    animate(selected.querySelector('.gn-nav-art'),[{opacity:.76},{opacity:1}]);
  }

  function reportFeedback(main, state, previous, changed){
    const stage = state.report?.stage || '';
    const receipt = state.report?.delivery || '';
    const status = main.querySelector('[role="status"]') || main.querySelector('.info');
    if (state.route==='report' && ['generating','generated'].includes(stage)) {
      main.querySelector('[role="status"]')?.setAttribute('data-report-activity','');
    }
    if (changed) {
      settle(main.querySelector('h1'),{easing:read});
      settle(main.querySelector('.report-sheet, .info'),{delay:45,easing:read});
    }
    if ((!changed && previous?.stage!==stage && stage==='saved') ||
        (state.route==='delivery' && receipt==='received' && previous?.receipt!==receipt)) {
      animate(status,[{boxShadow:'inset 3px 0 #d70960'},{boxShadow:'inset 0 0 transparent'}],{duration:320,easing:read});
    }
  }

  function groupFeedback(main, state, previous, changed){
    if (changed) {
      settle(main.querySelector('h1'));
      const parts = main.querySelectorAll('.group-prep .check-row, .group-member');
      parts.forEach((part,index)=>settle(part,{delay:index*45,distance:6,easing:read}));
    }
    if (state.route!=='group-measure') return;
    const members = main.querySelectorAll('.group-member');
    state.group?.members?.forEach((id,index)=>{
      if (state.group.states[id]!=='done' || previous?.groupStates?.[id]==='done') return;
      animate(members[index],[{boxShadow:'inset 0 -2px #5ad9ab'},{boxShadow:'inset 0 0 transparent'}],{duration:280,easing:read});
    });
  }

  function sync(device, state, selection){
    if (!device) {
      current = null;
      return;
    }
    const previous = current;
    const changed = previous?.route!==state.route;
    current = {route:state.route,stage:state.report?.stage||'',receipt:state.report?.delivery||'',page:state.reportPage,
      groupStates:state.route==='group-measure'?{...state.group?.states}:null};
    projectSelection(device, selection);
    const main = device.querySelector('.device-main');
    if (!main) return;
    if (state.route.startsWith('group-')) {
      groupFeedback(main,state,previous,changed);
      return;
    }
    if (['report','report-preview','delivery'].includes(state.route)) {
      reportFeedback(main,state,previous,changed || state.route==='report-preview'&&previous?.page!==state.reportPage);
      return;
    }
    if (!changed) return;
    if (state.route==='identity') {
      // The shared standby film stays on its own clock across entry.
      settle(main.querySelector('.entry-intro'));
      settle(main.querySelector('.entry-form'),{delay:45});
      settle(main.querySelector('.entry-keypad'),{delay:90,distance:4});
      return;
    }
    if (['consent','profile','prerequisites','settings','plan','end','locked','unavailable'].includes(state.route)) {
      settle(main.querySelector('h1'));
      settle(main.querySelector('.form-grid, .info, .muted'),{delay:45});
    }
  }

  function openOverlay(overlay){
    // Input is available as soon as the overlay is mounted.
    settle(overlay,{distance:8,opacity:.82,duration:192});
  }

  root.ANOVATOR_DIRECT_MOTION = {snapshot,sync,openOverlay};
})(window);
