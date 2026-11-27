// Integrated E02 v10 instrument. G01 owns identity, routing, recording and session persistence.
window.ANOVATOR_OXYGEN_MOUNT = function mountOxygen(element,host) {
'use strict';
element.inert=true;
element.style.opacity='0';
const root=element.attachShadow({mode:'open'});
root.innerHTML=window.ANOVATOR_OXYGEN_TEMPLATE;
const {softRamp,loadSandPlate,SandSurface,buildThreeGrain,buildFallbackGrain,three}=window.ANOVATOR_OXYGEN_MATERIAL;
const lifetime=new AbortController();
let disposed=false,frameId=0,restoring=true,stylesReady=false;
// The M v1 timing curves are drawn in time/progress space. Sample y at x,
// rather than using time as the Bezier parameter. Each table is built once.
function motionCurve(x1, y1, x2, y2) {
  const cubic = (t, a, b) => 3*(1-t)*(1-t)*t*a + 3*(1-t)*t*t*b + t*t*t;
  const table = new Float64Array(257);
  for (let i=1; i<256; i++) {
    let lo=0, hi=1;
    for (let j=0; j<18; j++) {
      const mid=(lo+hi)/2;
      if (cubic(mid,x1,x2) < i/256) lo=mid;
      else hi=mid;
    }
    table[i]=cubic((lo+hi)/2,y1,y2);
  }
  table[256]=1;
  return t => {
    if (t<=0) return 0;
    if (t>=1) return 1;
    const at=256*t, i=Math.floor(at);
    return table[i]+(table[i+1]-table[i])*(at-i);
  };
}

const ease = Object.freeze({
  press: motionCurve(.40,0,.20,1),
  enter: motionCurve(.22,1,.36,1),
  retract: motionCurve(.20,.55,.40,1),
  retreat: motionCurve(.31,.16,.50,1),
  travel: motionCurve(.38,.04,.32,1),
  glide: motionCurve(.38,0,.26,1),
  read: motionCurve(.24,.68,.35,1),
  result: motionCurve(.24,.62,.36,1),
  spread: motionCurve(.30,.15,.40,1),
  settle: motionCurve(.36,.12,.49,.96),
  pulse: motionCurve(.22,0,.40,1),
});

function cue(time, start, duration, curve) {
  return curve((time-start)/duration);
}

// Source and release offsets are in the 941 px E02 coordinate space. The
// screenshot endpoints stay intact; this score only governs their journey.
const preparationScore = host.directEnd ? [
  ['lead', 0, 170, 314, 146],
  ['detail', 45, 170, 288, 146],
  ['last', 78, 170, 260, 146],
  ['photo', 56, 210, 210, 170],
  ['link', 130, 170, 182, 146],
  ['tools', 172, 170, 134, 146],
  ['start', 196, 170, 126, 170],
] : [
  ['lead', 0, 195, 326, 134],
  ['detail', 42, 195, 305, 140],
  ['last', 77, 175, 285, 142],
  ['photo', 96, 325, 268, 185],
  ['link', 264, 210, 253, 155],
  ['tools', 325, 195, 245, 165],
  ['start', 355, 220, 240, 195],
];

function preparationAt(age, immediate) {
  return Object.fromEntries(preparationScore.map(([name,start,duration]) =>
    [name, immediate ? 1 : cue(age,start,duration,ease.enter)]));
}

function startReturnAt(age, from) {
  return Object.fromEntries(preparationScore.map(([name,,,start,duration]) =>
    [name,from[name]*(1-cue(age,start,duration,ease.retract))]));
}

function pressScale(age) {
  return age<80 ? 1-.022*cue(age,0,80,ease.press) : .978+.022*cue(age,80,140,ease.enter);
}

// Titles enter through the lower lip of their own mask. The two rows follow
// without moving. Read the same score backwards when leaving the measurement.
const readoutScore = host.directEnd ? [
  ['ox-channel', 0, 170, 220, 146],
  ['pr-channel', 45, 170, 175, 146],
  ['ox-field', 90, 192, 90, 146],
  ['pr-field', 135, 192, 45, 146],
] : [
  // CSS track, entry offset and duration, exit offset and duration
  ['ox-channel',   0, 225, 244, 192],
  ['pr-channel',  76, 215, 166, 184],
  ['ox-field',   152, 152,  82, 138],
  ['pr-field',   220, 145,  12, 132],
];

function readoutLayers(age, origin = null) {
  return Object.fromEntries(readoutScore.map(([key, start, duration, leave, release]) => {
    if (origin) return [key, origin[key] * (1 - cue(age, leave, release, ease.retract))];
    const curve = key.endsWith('channel') ? ease.enter : ease.result;
    return [key, cue(age, start, duration, curve)];
  }));
}

const settledReadouts = Object.freeze(readoutLayers(1000));

// The snapshot is already valid at release. Only the save acknowledgement
// can expose result actions. A slow save therefore never restarts the ascent.
const landingMs = host.directEnd ? 460 : 670;
function completionAt(age) {
  return {
    pair: cue(age,host.directEnd?112:204,landingMs-(host.directEnd?112:204),ease.glide),
    chrome: cue(age,16,182,ease.result),
    depth: cue(age,75,host.directEnd?315:480,ease.glide),
    focus: cue(age,host.directEnd?107:133,host.directEnd?353:455,ease.glide),
    stop: 1-cue(age,0,118,ease.retract),
  };
}

const liveLayout = Object.freeze(completionAt(0));
const resultLayout = Object.freeze(completionAt(1000));

const referenceReading = Object.freeze({ oxygen: 98, pulse: 72 });
const sampleSpacing = 1060;

// Integrate positive releases rather than sampling a periodic wave. A valid
// oxygen stream carries the whole field. A beat adds a small local slip.
function transportedSand(events, time, duration, envelope) {
  let distance = 0;
  for (const event of events) {
    const t = Math.max(0, Math.min(1, (time - event.at) / duration));
    distance += event.amount * envelope(t);
  }
  return distance;
}

// Two consecutive oxygen packets overlap by half a cycle. Their velocities
// sum to a constant during steady acquisition, then coast to zero on release.
const carry = t => t - Math.sin(2*Math.PI*t)/(2*Math.PI);

class SimulatedOximeter {
  constructor() {
    this.reset();
  }

  reset() {
    this.elapsed = 0;
    this.nextOxygen = 330;
    this.nextPulse = 170;
    this.oxygenAt = null;
    this.pulseAt = null;
    this.sampleCount = 0;
    this.oxygen = null;
    this.pulse = null;
    this.samples = [];
    this.beats = [];
  }

  advance(delta, oxygenSetting, pulseSetting, receivePulse = true, receiveOxygen = true) {
    this.elapsed += delta;
    let updated = false;
    while (this.elapsed >= this.nextOxygen) {
      if(!receiveOxygen){this.nextOxygen+=sampleSpacing;continue;}
      this.oxygenAt = this.nextOxygen;
      this.nextOxygen += sampleSpacing;
      this.sampleCount++;
      this.samples.push({ at: this.oxygenAt, amount: 64 });
      updated ||= this.oxygen !== oxygenSetting;
      this.oxygen = oxygenSetting;
    }
    while (this.elapsed >= this.nextPulse) {
      if (!receivePulse) {
        this.nextPulse += 60000 / pulseSetting;
        continue;
      }
      const previous = this.pulseAt;
      this.pulseAt = this.nextPulse;
      this.nextPulse += 60000 / pulseSetting;
      if (this.oxygenAt !== null && this.pulseAt >= this.samples[0].at) {
        this.beats.push({ at: this.pulseAt, amount: 3.4 });
      }
      if (previous !== null) {
        const bpm = Math.round(60000 / (this.pulseAt - previous));
        updated ||= this.pulse !== bpm;
        this.pulse = bpm;
      }
    }
    return updated;
  }

  invalidatePair() {
    this.invalidateOxygen();
    this.invalidatePulse();
  }

  invalidateOxygen() {
    this.oxygen=null;
    this.oxygenAt=null;
  }

  invalidatePulse() {
    this.pulseAt = null;
    this.pulse = null;
  }

  reading() {
    return this.oxygen === null || this.pulse === null ? null : { oxygen: this.oxygen, pulse: this.pulse };
  }

  sandAt(time) {
    return {
      current: transportedSand(this.samples, time, 2 * sampleSpacing, carry),
      accent: transportedSand(this.beats, time, 560, ease.pulse),
    };
  }
}

// The review clock and fault switches simulate events. They are not a peripheral protocol.
const reviewDelay = Object.freeze({ connection:1000, delayed:3300, expired:8500, release:950, restore:1700 });
const finishedView = new Set(['recording','result','saveFailed','saveUnknown']);

const liveViews = new Set(['acquiring','measuring','interrupted','releasing','stopping']);


function action(key, label, primary=false) { return {key,label,primary}; }

function journeyCopy(s, signalIssue) {
  const old=!!s.result;
  const retry=action('retry','Try again',true);
  const later=action('defer','Measure later');
  const back=action('previous','Previous result');
  const recovered=s.recovered && oximeter.oxygen!==null && s.age<reviewDelay.restore;
  switch(s.stage) {
    case 'ready': {
      const note={connected:'Tap Start. Keep still.',offline:'Connect the oximeter to start.',connecting:'Keep the oximeter nearby.',failed:'Check the oximeter and try again.'}[s.link];
      return {lines:[{type:'strong',text:'Put on the finger clip.'},'Sit with your hand on your thigh.',note]};
    }
    case 'acquiring':
      if(s.fault==='start'&&s.issueAge>=reviewDelay.delayed)return {lines:['The oximeter has not responded.','Keep still, or try again.'],status:'Still waiting for the oximeter',actions:[later,retry],issue:true};
      if(s.issueAge>=reviewDelay.delayed) return {lines:signalIssue==='contact'?['Adjust the clip on your finger.','Keep your hand resting on your thigh.']:['No usable reading yet.','Keep still, or try again.'],status:signalIssue==='contact'?'Waiting for finger contact':'Still waiting for a reading',actions:[later,retry],issue:true};
      if(signalIssue==='connection')return {lines:['Reconnect the oximeter.','Keep your hand resting on your thigh.'],status:'Oximeter disconnected',issue:true};
      if(signalIssue==='contact')return {lines:['Adjust the clip on your finger.','Keep your hand relaxed and still.'],status:'Waiting for finger contact',issue:true};
      if(s.fault==='start')return {lines:['Keep your hand relaxed and still.'],status:'Waiting for the oximeter'};
      return {lines:['Keep your hand relaxed and still.'],status:'Checking signal…'};
    case 'measuring':
      if(s.fault==='pulse' && s.partialAge>=reviewDelay.delayed)return {lines:['Keep your hand relaxed and still.','Waiting for a pulse reading.'],status:'Blood oxygen signal detected',issue:true,actions:[action('stop','Stop'),later]};
      if(s.fault==='oxygen' && s.partialAge>=reviewDelay.delayed)return {lines:['Keep your hand relaxed and still.','Waiting for a blood oxygen reading.'],status:'Pulse signal detected',issue:true,actions:[action('stop','Stop'),later]};
      return {lines:['Keep your hand relaxed and still.'],status:recovered?'Signal restored':oximeter.oxygen===null?'Checking signal…':'Measuring'};
    case 'interrupted': {
      const lines=signalIssue==='connection'?['Reconnect the oximeter.','Keep the clip on your finger.']:signalIssue==='contact'?['Adjust the clip on your finger.','Keep your hand resting on your thigh.']:['Signal interrupted.','Keep your hand relaxed and still.'];
      return {lines,status:'Waiting for a fresh reading',issue:true,actions:s.issueAge>=reviewDelay.delayed?[later,retry]:null};
    }
    case 'releasing':
    case 'stopping':
      if(s.age>=reviewDelay.delayed)return {lines:[s.stage==='releasing'?'Your readings are held.':'Stop requested.','Keep the clip on until confirmed.'],status:s.checkingRelease?'Checking device status…':'Waiting for device confirmation',issue:!s.checkingRelease,actions:s.checkingRelease?[]:[action('checkRelease','Check device status',true)]};
      return s.stage==='releasing'?{lines:['Readings captured.','Keep the clip on for a moment.'],status:'Finishing measurement…',actions:[]}:{lines:['Keep the clip on for a moment.'],status:s.afterStop==='failed'?'Finishing this attempt…':'Stopping measurement…',actions:[]};
    case 'failed':return {lines:[s.failure==='start'?'The oximeter did not start.':'No complete reading this time.',old?'Your previous result is still saved.':'You can remove the clip.'],status:old?'Previous result kept':'No reading recorded',issue:true,actions:[old?back:later,retry]};
    case 'stopped':return {lines:['Measurement stopped.','You can remove the clip.'],status:old?'Previous result kept':'No new reading recorded',actions:[old?back:later,retry]};
    case 'recording':return {lines:['Measurement complete.','You can remove the clip.'],status:s.checkingReceipt?'Checking save status…':'Saving reading…',actions:[]};
    case 'saveFailed':return {lines:['You can remove the clip.','Your readings are ready to save.'],status:'Reading not saved',issue:true,actions:[action('saveAgain','Retry save',true)]};
    case 'saveUnknown':return {lines:['You can remove the clip.','Checking will keep the same readings.'],status:'Save status unconfirmed',issue:true,actions:[action('checkSave','Check save status',true)]};
    case 'result':return {lines:[s.replaced?'New reading recorded.':'Reading recorded.','You can remove the clip.']};
    default:return {lines:['Keep your hand relaxed and still.']};
  }
}

const byId = id => root.getElementById(id);
const screen = byId('screen');
const content = byId('device-content');
const shell = byId('screen-shell');


const modal = byId('modal');
const connected = byId('sensor-connected');
const contact = byId('sensor-contact');
const lessMotion = byId('reduce-motion');


const reducePreference = matchMedia('(prefers-reduced-motion: reduce)');
const embedded = window.ANOVATOR_OXYGEN_ART;
const oximeter = new SimulatedOximeter();
const settings = { ...referenceReading };
let canvas = byId('grain');
let material = null;
let sandSurface = null;


let activeDialog = null;
let simulation = newSession();
let invalidateDrawing = true;
let lastTick = 0;
let lastDraw = -100;
let drawnSize = 0;
let renderedSample = '';
let motionClock = 0;
let pressedAt = null;
let statusAt = 0;
const lineStarts = new WeakMap();
const nextButton = screen.querySelector('[data-action="next"]');
const resultActions = byId('actions-result');
const resultButtons = [...resultActions.querySelectorAll('button')];
const readyEnd = byId('actions-ready').querySelector('.action-end');
const resultEnd = resultActions.querySelector('.action-end');
const endText = resultEnd.lastChild;
const endIcon = resultEnd.querySelector('img');
const reviewFooter = window.ANOVATOR_ROUTE_REVIEW === true;
const endLabel = () => reviewFooter && !host.canMakeReport() ? 'Exit session' : 'End session';
screen.classList.toggle('review-result-footer', reviewFooter);
const halfSpeed = byId('half-speed');
const styleCache = new Map();

const phases = Object.freeze({ starting: 460, acquiring: 1280, measuring: 7080, recording: 1460, returning: 480 });
const openingMs = 2270;
const referenceSand = Object.freeze({birth:1, capture:0, gain:1, oxygenCohesion:1, oxygenAge:1.2, pulseAge:1.2, current:0, accent:0});
const handoffMs = 1110;
const operationView = Object.freeze({ready:'ready', starting:'ready', result:'result', saveFailed:'result', saveUnknown:'result'});

for (const image of screen.querySelectorAll('[data-icon]')) {
  image.width=40;
  image.height=40;
  image.src = 'assets/chrome-v04/' + image.dataset.icon + '.svg';
}
const linkGlyph=byId('prep-link').querySelector('svg');
linkGlyph.setAttribute('width','37');
linkGlyph.setAttribute('height','37');
const prepPhoto=byId('prep-visual');
let prepFrame=prepPhoto;
if(host.directEnd){
  prepFrame=document.createElement('div');
  prepFrame.className='prep-visual prep-photo-crop';
  prepPhoto.classList.remove('prep-visual');
  prepPhoto.width=1448;
  prepPhoto.height=1086;
  prepPhoto.replaceWith(prepFrame);
  prepFrame.append(prepPhoto);
  prepPhoto.src='oxygen/GH-OX-CLOSE-PNG-v11.png';
}else{
  prepPhoto.src=embedded.preparation;
}
screen.toggleAttribute('data-direct-motion', !!host.directEnd);
let directReduceOverride = false;
lessMotion.checked = reducePreference.matches;
function syncMotionPreference() {
  const previous=screen.classList.contains('is-reduced');
  screen.classList.toggle('is-reduced', lessMotion.checked);
  if (previous===lessMotion.checked) return;
  if (simulation.stage==='starting') return setStage('acquiring',true);
  if (simulation.stage==='returning') return setStage(simulation.returnFrom.target,true);
  if (simulation.stage==='result') {
    simulation.age=Math.max(simulation.age,handoffMs);
    simulation.restoredAt=null;
  }
  if (simulation.stage==='recording' || simulation.stage==='result') simulation.finishStill=true;
  if (simulation.stage==='ready') simulation.age=Math.max(simulation.age,580);
  simulation.panelAge=Math.max(simulation.panelAge,365);
  if (previous && simulation.stage==='measuring') {
    simulation.birthFloor=oximeter.sampleCount>=2 ? 1 : oximeter.sampleCount ? .27 : 0;
  }
}
function applyMotionOverride(value) {
  if (host.directEnd) directReduceOverride = !!value;
  lessMotion.checked = !!value || (host.directEnd && reducePreference.matches);
  syncMotionPreference();
}
syncMotionPreference();
lessMotion.addEventListener('change', () => {applyMotionOverride(lessMotion.checked);renderInterface();});
reducePreference.addEventListener('change', event => {
  lessMotion.checked = event.matches || (host.directEnd && directReduceOverride);
  syncMotionPreference();
  renderInterface();
}, {signal:lifetime.signal});

function newSession() {
  return {stage:'ready', age:0, panelAge:0, remaining:0, connected:true, contact:true,
    retesting:false, pending:null, result:null, startFrom:null,
    returnFrom:null, restoredAt:null, frozenAt:null, finishStill:false,
    lastFlow:null, birthFloor:0, lastSand:null, pendingSand:null, resultSand:null,
    link:'connected', linkAge:0, fault:'normal', issueAge:0, partialAge:0, failure:null,
    afterStop:null, heldSand:null,
    remainingBeforeLoss:0, recovered:false, captureId:null, savedId:null,
    saveProblem:null, releaseConfirmed:false, checkingRelease:false, pollAge:0, replaced:false, retrySave:false, checkingReceipt:false, receipts:{}};
}

function running() {
  return Object.hasOwn(phases, simulation.stage);
}

function sensorIssue() {
  if (!simulation.connected) return 'connection';
  if (!simulation.contact) return 'contact';
  if (simulation.fault==='silent') return 'signal';
  return '';
}

function announce(text) {
  byId('device-announcement').textContent = text;
}

function setStage(stage, changeFocus = false) {
  const previous = simulation.stage;
  if (stage === 'acquiring') {
    oximeter.reset();
    simulation.birthFloor=0;
    simulation.pending=null;
    simulation.lastSand=null;
    simulation.pendingSand=null;
    simulation.heldSand=null;
    simulation.frozenAt=null;
    simulation.finishStill=false;
    simulation.issueAge=0;
    simulation.partialAge=0;
    simulation.recovered=false;
    if (!['measuring','acquiring'].includes(previous)) simulation.panelAge=previous==='starting'?100:0;
  }
  if (stage==='recording' && !simulation.retrySave) {
    simulation.frozenAt=motionClock;
    simulation.finishStill=lessMotion.checked;
  } else if (stage==='result' && previous!=='recording') {
    simulation.frozenAt=null;
    simulation.finishStill=lessMotion.checked;
  }
  simulation.stage=stage;
  simulation.age=stage==='result' && previous!=='recording'?handoffMs:0;
  simulation.restoredAt=stage==='result' && previous!=='recording' && !lessMotion.checked?motionClock:null;
  simulation.remaining=phases[stage]??0;
  if (stage!=='ready') pressedAt=null;
  renderInterface();
  checkpoint();
  if (changeFocus) focusState();
}

function focusState() {
  if (activeDialog) return;
  const buttons=[...content.querySelectorAll('#branch-actions button, #session-list button, .actions button')].filter(n=>!n.disabled&&!n.closest('[hidden],[inert]'));
  const preferred=buttons.find(n=>n.classList.contains('primary')||n.dataset.action==='start'||n.dataset.action==='next');
  (preferred||buttons[0]||byId('device-title')).focus({preventScroll:true});
}

function setInstructions(lines) {
  const box = byId('device-instructions');
  lines.forEach((line,i) => {
    const tag = line.type === 'strong' ? 'STRONG' : 'SPAN';
    const text = line.text ?? line;
    let node = box.children[i];
    if (node?.tagName === tag && node.textContent === text) return;
    const replacement = document.createElement(tag);
    replacement.textContent = text;
    if (node) node.replaceWith(replacement);
    else box.append(replacement);
    lineStarts.set(replacement,motionClock+32*i);
  });
  while (box.children.length > lines.length) box.lastElementChild.remove();
}

function visualState() {
  if (simulation.stage === 'returning') return simulation.returnFrom.view;
  return operationView[simulation.stage] ?? 'measuring';
}

function updateReadouts(values) {
  byId('readouts').toggleAttribute('data-empty', !Number.isFinite(values?.oxygen) && !Number.isFinite(values?.pulse));
  for (const name of ['oxygen', 'pulse']) {
    const value = values?.[name];
    const available = Number.isFinite(value);
    const number = byId(name + '-value');
    const group = number.closest('.metric');
    const text = available ? String(value) : '';
    if (number.textContent !== text) number.textContent = text;
    group.toggleAttribute('data-available', available);
    group.toggleAttribute('data-wide', available && value >= 100);
    number.setAttribute('aria-hidden', String(!available));
    group.querySelector('.pending-description').hidden = available;
  }
}

function renderInterface() {
  const s=simulation;
  const exiting=s.stage==='returning'?s.returnFrom:null;
  const stage=exiting?.stage??s.stage;
  const presentation=exiting?.copy??journeyCopy(stage==='starting'?{...s,stage:'ready'}:s,sensorIssue());
  const view=visualState(), ready=view==='ready';
  const released=finishedView.has(stage), outcome=stage==='result', prepLink=byId('prep-link');
  const values=exiting?exiting.values:
    outcome?s.result:released||stage==='releasing'?s.pending:stage==='measuring'?oximeter:null;
  screen.dataset.view=view;
  screen.dataset.stage=s.stage;
  screen.toggleAttribute('data-finish',released);
  screen.toggleAttribute('data-lost',stage==='interrupted');
  content.inert=!!activeDialog;
  const title=byId('device-title'), titleText=presentation.title??'Oxygen & pulse';
  if(title.textContent!==titleText)title.textContent=titleText;
  
  prepFrame.hidden=!ready;
  prepLink.hidden=!ready;
  const signed=s.link==='connected';
  prepLink.classList.toggle('regressed',!signed);
  byId('prep-mark').setAttribute('d',signed?'M11 20.5l6 6 12-13':s.link==='connecting'?'M20 10v10l7 4':'M20 10v11m0 6v2');
  byId('prep-link-text').textContent={connected:'Oximeter connected',offline:'Oximeter disconnected',connecting:'Connecting oximeter…',failed:'Could not connect'}[s.link];
  setInstructions(presentation.lines);
  canvas.hidden=ready||['failed','stopped'].includes(stage);
  byId('readouts').hidden=ready&&stage!=='starting';
  updateReadouts(values);
  byId('spo2').setAttribute('aria-hidden',String(!released));
  const status=byId('measurement-status');
  status.hidden=!presentation.status;
  status.toggleAttribute('data-issue',!!presentation.issue);
  if(status.textContent!==(presentation.status??'')) {status.textContent=presentation.status??'';statusAt=motionClock;}
  const branch=byId('branch-actions');
  let actions=presentation.actions;
  if(ready&&!signed) actions=[action(s.retesting?'previous':'defer',s.retesting?'Previous result':'Measure later'),...(s.link==='connecting'?[]:[action('connect',s.link==='failed'?'Retry connection':'Connect',true)])];
  branch.hidden=!!exiting||!actions?.length;
  const actionKey=JSON.stringify(actions??[]);
  if(branch.dataset.actions!==actionKey){
    branch.replaceChildren(...(actions??[]).map(({key,label,primary})=>{
      const b=document.createElement('button');b.dataset.action=key;b.textContent=label;if(primary)b.className='primary';return b;
    }));branch.dataset.actions=actionKey;
  }
  byId('actions-ready').hidden=!ready||!!actions;
  byId('actions-ready').inert=stage==='starting';
  byId('actions-measuring').hidden=view!=='measuring'||!!actions;
  byId('actions-measuring').inert=!!exiting||released;
  byId('actions-result').hidden=!outcome;
  readyEnd.hidden=host.directEnd&&!s.retesting;
  byId('action-end-text').textContent=s.retesting?'Cancel retest':'End session';
  screen.querySelector('[data-action="skip"]').hidden=s.retesting;
  screen.querySelector('[data-action="start"]').disabled=!signed;
  const destination=host.next();
  nextButton.hidden=!destination;
  nextButton.toggleAttribute('data-long',(destination?.label||'').length>10);
  nextButton.querySelector('strong').textContent=destination?.label||'';
  const caption=nextButton.querySelector('.next-label');
  caption.textContent=destination?.caption||'Next';
  if(reviewFooter){
    const repair=!!destination&&!destination.caption;
    caption.hidden=repair;
    nextButton.toggleAttribute('data-repair',repair);
    nextButton.setAttribute('aria-label',destination?(repair?destination.label:destination.caption+' · '+destination.label):'');
    const back=host.resultBack?.();
    const sessionGlyph=host.resultEndGlyph?.();
    resultEnd.hidden=sessionGlyph===null&&!back;
    resultEnd.toggleAttribute('data-close-out',!!host.directEnd&&!resultEnd.hidden&&!back&&!!host.resultEndEmphasized?.());
    endText.nodeValue=back?'Back':endLabel();
    resultEnd.dataset.action=back?'back':'end';
    if(back)resultEnd.setAttribute('aria-label',back.label);
    else resultEnd.removeAttribute('aria-label');
    const endGlyph=back?'back':sessionGlyph??'end';
    if(endIcon.dataset.icon!==endGlyph){
      endIcon.dataset.icon=endGlyph;
      endIcon.src='assets/chrome-v04/'+endGlyph+'.svg';
    }
    const icon=nextButton.querySelector('.next-disc img');
    const name=repair?'retest':'next';
    if(icon.dataset.icon!==name){
      icon.dataset.icon=name;
      icon.src='assets/chrome-v04/'+name+'.svg';
    }
  }
  window.ANOVATOR_FOOTER_H10?.oxygen(screen, { retesting: s.retesting, canMakeReport: host.canMakeReport() });
  placeChoreography();
  if(!exiting) announce([presentation.title||'Oxygen & pulse',...presentation.lines.map(x=>x.text??x),presentation.status].filter(Boolean).join('. '));
  invalidateDrawing=true;
}

function updateSensor() {
  const s=simulation;
  s.connected=connected.checked;s.contact=contact.checked;
  s.link=s.connected?'connected':'offline';
  handleSignal();
}

function handleSignal() {
  const s=simulation;
  const issue=sensorIssue();
  if(s.stage==='measuring'&&issue) {
    s.heldSand=s.lastSand??materialFrame();
    s.remainingBeforeLoss=s.remaining;
    oximeter.invalidatePair();s.issueAge=0;
    setStage('interrupted');
  } else if(s.stage==='interrupted'&&!issue) {
    s.recovered=true;s.issueAge=0;s.partialAge=0;
    setStage('measuring');s.remaining=Math.max(2160,s.remainingBeforeLoss);
  } else renderInterface();
}

function goToNext() {
  const s=simulation;
  host.leave(s.result ? 'next' : 'skip');
}

function requestStop(afterStop='stopped') {
  if(!liveViews.has(simulation.stage) && simulation.stage!=='starting')return;
  if (!host.stop(simulation.captureId)) return;
  simulation.afterStop=afterStop;
  simulation.heldSand=simulation.lastSand;
  setStage('stopping',true);
}

function cancelReading() {
  host.leave('previous');
}

function leaveReadouts(target, rewind = false) {
  const {stage} = simulation;
  if (stage === 'returning') return;
  if (lessMotion.checked || !['acquiring', 'measuring', 'result'].includes(stage)) {
    setStage(target, true);
    return;
  }
  const values=stage==='result'?simulation.result:stage==='measuring'?oximeter:null;
  simulation.returnFrom={
    stage,target,rewind,view:visualState(),copy:journeyCopy(simulation,sensorIssue()),values:{oxygen:values?.oxygen??null,pulse:values?.pulse??null},
    layers:currentReadoutLayers(),tracks:readingTracks(),frame:materialFrame(),
  };
  setStage('returning',true);
}

function openDialog({ title, body, confirm, cancel = 'Close', apply }) {
  if (activeDialog) return;
  const before = root.activeElement;
  activeDialog = { before, apply };
  byId('modal-title').textContent = title;
  byId('modal-detail').textContent = body;
  byId('modal-confirm').textContent = confirm ?? '';
  byId('modal-confirm').hidden = !confirm;
  byId('modal-cancel').textContent = cancel;
  content.inert = true;
  host.modal(true);
  modal.hidden = false;
  byId('modal-cancel').focus({ preventScroll: true });
}

function closeDialog(restoreFocus = true) {
  const clicked = activeDialog?.before;
  activeDialog = null;
  modal.hidden = true;
  content.inert = false;
  host.modal(false);
  if (restoreFocus && clicked && !clicked.closest('[hidden]') && !clicked.disabled) {
    clicked.focus({ preventScroll: true });
  }
}

byId('modal-cancel').addEventListener('click', () => closeDialog());
byId('modal-confirm').addEventListener('click', () => {
  const apply = activeDialog?.apply;
  closeDialog(false);
  apply?.();
});
root.addEventListener('keydown', event => {
  if (!activeDialog) return;
  if (event.key === 'Escape') {
    event.preventDefault();
    closeDialog();
  } else if (event.key === 'Tab') {
    const buttons = [...modal.querySelectorAll('button:not([hidden])')];
    const index = buttons.indexOf(root.activeElement);
    const next = (index + (event.shiftKey ? -1 : 1) + buttons.length) % buttons.length;
    event.preventDefault();
    buttons[next].focus({ preventScroll: true });
  }
});

function markSaved() {
  const s=simulation;
  if(!s.pending || !s.releaseConfirmed)return;
  if (!host.record(s.captureId, s.pending)) return;
  s.receipts[s.captureId]??={...s.pending};
  s.replaced=!!s.result && s.savedId!==s.captureId;
  s.result=s.pending;s.resultSand=s.pendingSand;s.savedId=s.captureId;
  s.pending=null;s.saveProblem=null;s.retesting=false;s.retrySave=false;s.checkingReceipt=false;
  checkpoint();
  setStage('result',true);
}

function saveAgain(checkOnly=false) {
  if(!simulation.pending || !simulation.releaseConfirmed) return;
  if(checkOnly && !simulation.receipts[simulation.captureId]){
    simulation.saveProblem='saveFailed';checkpoint();setStage('saveFailed',true);return;
  }
  simulation.retrySave=true;
  simulation.checkingReceipt=checkOnly;
  simulation.saveProblem=null;
  checkpoint();
  setStage('recording',true);
}

function deferMeasurement() {
  const s=simulation;
  if(liveViews.has(s.stage)){requestStop('defer');return;}
  if(s.result){cancelReading();return;}
  goToNext();
}

const deviceActions = {
  start() {
    const s=simulation;
    if(s.stage!=='ready'||!s.connected)return;
    s.replaced=false;s.failure=null;s.afterStop=null;s.saveProblem=null;
    s.releaseConfirmed=false;s.checkingRelease=false;s.retrySave=false;s.checkingReceipt=false;s.captureId=host.begin();if(s.captureId==null)return;s.recovered=false;
    s.startFrom=preparationAt(s.age,lessMotion.checked);
    const pressed=pressedAt===null?0:Math.min(80,Math.max(0,motionClock-pressedAt));
    if(lessMotion.checked)return setStage('acquiring',true);
    setStage('starting');s.age=pressed;s.remaining-=pressed;placeChoreography();
  },
  connect() {
    if(simulation.stage!=='ready'||simulation.link==='connecting')return;
    simulation.link='connecting';simulation.linkAge=0;renderInterface();
  },
  stop() {
    if(!['measuring','interrupted','acquiring'].includes(simulation.stage))return;
    openDialog({title:'Stop measurement?',body:simulation.retesting?'Your previous reading will be kept.':'This attempt will not be recorded.',
      cancel:'Keep measuring',confirm:'Stop measurement',apply:()=>requestStop()});
  },
  retry() {
    if(['acquiring','interrupted','measuring'].includes(simulation.stage)){requestStop('retry');return;}
    simulation.retesting=!!simulation.result;
    setStage('ready',true);
  },
  retest() {
    if(simulation.stage!=='result')return;
    if (!host.retest()) return;
    simulation.retesting=true;
    leaveReadouts('ready',true);
  },
  previous:cancelReading,saveAgain,checkSave:()=>saveAgain(true),defer:deferMeasurement,skip:deferMeasurement,next:goToNext,back:()=>host.leave('back'),
  checkRelease(){
    const s=simulation;
    if(!['releasing','stopping'].includes(s.stage)||s.checkingRelease)return;
    if(!s.connected){openDialog({title:'Oximeter disconnected',body:'Reconnect the oximeter, then check the device status again.'});return;}
    s.checkingRelease=true;s.pollAge=0;renderInterface();
  },
  end() {
    if(simulation.retesting&&simulation.stage==='ready'){cancelReading();return;}
    if(liveViews.has(simulation.stage)||simulation.pending)return;
    if(host.directEnd){
      if(simulation.stage==='result')host.leave('end',resultEnd);
      return;
    }
    if(endLabel()==='Exit session'){
      host.leave('end');
      return;
    }
    openDialog({title:'End this session?',body:simulation.result?'Your recorded oxygen and pulse readings will be in the summary.':'Oxygen and pulse will be shown as not recorded.',
      confirm:window.ANOVATOR_FOOTER_H10?'End':'End session',cancel:'Continue',apply:()=>host.leave('end')});
  }
};

const startButton = screen.querySelector('[data-action="start"]');
function primePress() {
  if (simulation.stage === 'ready' && simulation.connected) pressedAt ??= motionClock;
}
startButton.addEventListener('pointerdown',e=>{ if (e.button===0) primePress(); });
startButton.addEventListener('keydown',e=>{ if (e.key===' ' || e.key==='Enter') primePress(); });
for (const name of ['pointercancel','pointerleave','blur']) {
  startButton.addEventListener(name,()=>{ if (simulation.stage === 'ready') pressedAt=null; });
}
content.addEventListener('click', event => {
  const button = event.target.closest('button[data-action]');
  if (!button || button.disabled || button.closest('[hidden],[inert]') || content.inert) return;
  deviceActions[button.dataset.action]?.();
});
byId('device-title').tabIndex=-1;
connected.addEventListener('change',updateSensor);
contact.addEventListener('change',updateSensor);
function trackScale() {
  const width = shell.clientWidth;
  screen.style.setProperty('--zoom', width / 941);
  if (!material || !width) return;
  const pixels = Math.min(941, Math.round(width * Math.min(2, devicePixelRatio || 1)));
  if (pixels !== drawnSize) {
    drawnSize = pixels;
    material.resize(pixels);
    invalidateDrawing = true;
  }
}
const resizeObserver=new ResizeObserver(trackScale);
resizeObserver.observe(shell);

function activateFallback(error) {
  if (disposed) return;
  console.warn('E02 WebGL rendering fallback', error);
  const replacement = canvas.cloneNode(false);
  canvas.replaceWith(replacement);
  canvas = replacement;
  setMaterial(buildFallbackGrain(canvas,sandSurface));
}

function setMaterial(renderer) {
  material = renderer;
  drawnSize = 0;

  screen.dataset.renderer = material.kind;
  trackScale();
}

async function initializeMaterial() {
  try {
    const plate = await loadSandPlate(embedded.plate);
    sandSurface = new SandSurface(embedded.opticalProfile,plate);
    const THREE = await three();
    if(disposed)return;
    setMaterial(buildThreeGrain(canvas,THREE,sandSurface));
    canvas.addEventListener('webglcontextlost', () => activateFallback('WebGL context lost'), { once: true });
  } catch (error) {
    activateFallback(error);
  }
}

function advanceMeasurement(dt) {
  const s=simulation,stage=s.stage;
  if(stage==='ready'&&s.link==='connecting') {
    s.linkAge+=dt;
    if(s.linkAge>=reviewDelay.connection) {
      s.connected=s.fault!=='connect';connected.checked=s.connected;s.link=s.connected?'connected':'failed';host.connected(s.connected);renderInterface();checkpoint();
    }
  }
  if(stage==='interrupted'||stage==='acquiring'&&(sensorIssue()||s.fault==='start')) {
    const before=s.issueAge;s.issueAge+=dt;s.panelAge=Math.min(s.panelAge+dt,1100);
    if(before<reviewDelay.delayed && s.issueAge>=reviewDelay.delayed)renderInterface();
    if(s.issueAge>=reviewDelay.expired){
      s.failure=s.fault==='start'?'start':'signal';
      if(activeDialog)closeDialog(false);
      requestStop('failed');
    }
    return;
  }
  if(stage==='acquiring') s.issueAge=0;
  if(stage==='stopping'||stage==='releasing'){
    const before=s.age;s.age+=dt;
    if(before<reviewDelay.delayed&&s.age>=reviewDelay.delayed)renderInterface();
    if(s.checkingRelease)s.pollAge+=dt;
    const polled=s.checkingRelease&&s.connected&&s.pollAge>=reviewDelay.connection;
    if(s.age<reviewDelay.release||!s.connected||(s.fault==='hold'&&!polled))return;
    if(activeDialog)closeDialog(false);
    s.checkingRelease=false;
    s.releaseConfirmed=true;
    if(stage==='releasing') {if(!host.release(s.captureId,s.pending))return;checkpoint();setStage('recording');return;}
    const target=s.afterStop;s.afterStop=null;
    if(!host.stopped(s.captureId))return;
    if(target==='defer'){if(s.result)cancelReading();else goToNext();return;}
    if(target==='retry'){setStage('ready',true);return;}
    setStage(target==='failed'?'failed':'stopped',true);return;
  }
  if(!running()){
    s.age=Math.min(2000,s.age+dt);
    return;
  }
  if(stage==='acquiring'||stage==='measuring'){
    s.panelAge=Math.min(1100,s.panelAge+dt);if(!material&&!host.directEnd)return;
    if(stage==='measuring'&&sensorIssue()){handleSignal();return;}
  }
  if(stage==='measuring'&&['pulse','oxygen'].includes(s.fault)){
    const before=s.partialAge;s.partialAge+=dt;
    if(before<reviewDelay.delayed&&s.partialAge>=reviewDelay.delayed)renderInterface();
    if(s.partialAge>=reviewDelay.expired){s.failure='partial';if(activeDialog)closeDialog(false);requestStop('failed');return;}
  }
  const step=Math.min(dt,s.remaining);
  s.age+=step;
  if(stage==='measuring'){
    const initial=oximeter.oxygen===null, priorPulse=oximeter.pulse;
    if(oximeter.advance(step,settings.oxygen,settings.pulse,s.fault!=='pulse',s.fault!=='oxygen')){
      if(initial||priorPulse===null&&oximeter.pulse!==null)renderInterface();else updateReadouts(oximeter);
    }
    if(s.recovered&&s.age>=reviewDelay.restore){s.recovered=false;renderInterface();}
  }
  s.remaining-=step;
  if(s.remaining>0)return;
  if(stage==='starting') setStage('acquiring',true);
  else if(stage==='returning') setStage(s.returnFrom.target,true);
  else if(stage==='acquiring')setStage('measuring');
  else if(stage==='measuring'){
    const pair=oximeter.reading();
    if(!pair){s.remaining=500;return;}
    if(activeDialog)closeDialog(false);
    s.pending=Object.freeze(pair);
    s.pendingSand=Object.freeze(s.lastSand??materialFrame());
    s.releaseConfirmed=false;s.retrySave=false;
    checkpoint();
    setStage('releasing',true);
  } else if(stage==='recording'){
    if(!s.retrySave&&['save','unknown'].includes(s.fault)){
      if(s.fault==='unknown')s.receipts[s.captureId]??={...s.pending};
      s.saveProblem=s.fault==='save'?'saveFailed':'saveUnknown';checkpoint();setStage(s.saveProblem,true);
    }else markSaved();
  }
  if(dt>step)advanceMeasurement(dt-step);
}

function readingTracks() {
  const {stage,age,returnFrom,frozenAt,restoredAt} = simulation;
  if (stage === 'returning') {
    const {tracks:from, rewind} = returnFrom;
    const back=rewind ? 1-cue(age,48,346,ease.glide) : 1;
    return {
      ...from, pair:from.pair*back,
      next: from.next*(1-cue(age,30,145,ease.retract)),
      tools: from.tools*(1-cue(age,0,140,ease.retract)),
    };
  }
  const view = stage;
  const recorded = view==='result';
  if(view==='saveFailed'||view==='saveUnknown')return {...resultLayout,next:0,tools:0};
  if(!recorded&&view!=='recording')return {...liveLayout,next:0,tools:0};
  const elapsed = frozenAt === null ? Infinity : motionClock-frozenAt;
  const still = lessMotion.checked || simulation.finishStill;
  const tracks = still || elapsed>=1000 ? resultLayout : completionAt(elapsed);
  // A fast receipt waits for the moving pair. A slow one only reveals the actions.
  const actionAge = restoredAt !== null ? motionClock-restoredAt-(host.directEnd?148:230) : Math.min(age,elapsed-landingMs);
  const nextDelay = host.directEnd ? 24 : 50, toolDelay = host.directEnd ? 24 : 95;
  return {...tracks, next: recorded ? (still ? 1 : cue(actionAge,nextDelay,146,ease.enter)) : 0,
    tools: recorded ? (still ? 1 : cue(actionAge,toolDelay,146,ease.enter)) : 0};
}

function currentReadoutLayers() {
  if (lessMotion.checked) return settledReadouts;
  const {stage, age, panelAge} = simulation;
  if (stage === 'returning') return readoutLayers(age, simulation.returnFrom.layers);
  if (stage === 'result' && simulation.restoredAt !== null) return readoutLayers(motionClock - simulation.restoredAt);
  if (stage === 'starting') return readoutLayers(age - 360);
  if (stage === 'acquiring' || stage === 'measuring') return readoutLayers(panelAge);
  return settledReadouts;
}

function cssProgress(key,value) {
  const number=value.toFixed(4);
  if (styleCache.get(key)===number) return;
  screen.style.setProperty('--'+key,number);
  styleCache.set(key,number);
}

function placeChoreography() {
  const stage = simulation.stage;
  const still = lessMotion.checked;
  const age = simulation.age;
  if (stage==='ready' || stage==='starting') {
    const group = stage==='starting' ? startReturnAt(age,simulation.startFrom) : preparationAt(age,still);
    for (const [name,p] of Object.entries(group)) cssProgress('prep-'+name,p);
    const button = stage==='starting' ? pressScale(age) : pressedAt===null ? 1 : pressScale(Math.min(80,motionClock-pressedAt));
    cssProgress('press-scale',still ? 1 : button);
    cssProgress('press-depth',still ? 0 : (1-button)/.022);
    cssProgress('prep-bridge',stage==='starting' ? cue(age,240,220,ease.travel) : 0);
  }
  const entered = simulation.panelAge;
  const tracks = readingTracks();
  cssProgress('read-shift',tracks.pair);
  cssProgress('finish-chrome',tracks.chrome);
  cssProgress('sand-depth',tracks.depth);
  cssProgress('sand-focus',tracks.focus);
  const checking = stage==='acquiring' || stage==='measuring';
  for (const [key,p] of Object.entries(currentReadoutLayers())) cssProgress(key,p);
  const departure = stage==='returning' ? 1-cue(age,0,145,ease.retract) : 1;
  const stop = stage==='recording' ? tracks.stop : still ? 1 : cue(entered,194,172,ease.enter)*departure;
  cssProgress('stop-in',stop);
  if (stage==='recording') byId('actions-measuring').hidden=stop<=0;
  const warning = byId('measurement-status').hasAttribute('data-issue');
  const initialStatus = !still && checking && !warning ? cue(entered,222,145,ease.enter) : 1;
  cssProgress('status-in',still ? 1 : departure*Math.min(initialStatus,cue(motionClock-statusAt,0,137,ease.result)));
  for (const node of byId('device-instructions').children) {
    const reveal = still ? 1 : cue(motionClock-(lineStarts.get(node)??motionClock),0,155,ease.result);
    const p = reveal.toFixed(4);
    if (node.style.getPropertyValue('--line-in')!==p) node.style.setProperty('--line-in',p);
  }
  cssProgress('next-in',tracks.next);
  cssProgress('result-tools-in',tracks.tools);
  for (const item of resultButtons) {
    const locked = stage!=='result' || (item===nextButton ? tracks.next : tracks.tools)<.53;
    if (item.inert!==locked) item.inert=locked;
  }
}

function materialFrame() {
  const stage = simulation.stage;
  if(['recording','saveFailed','saveUnknown','releasing'].includes(stage))return simulation.pendingSand??referenceSand;
  if(stage==='result')return simulation.resultSand??referenceSand;
  if(stage==='interrupted'||stage==='stopping'){
    const held=simulation.heldSand;
    if(held)return {...held,gain:held.gain*(1-.30*cue(simulation.issueAge||simulation.age,0,460,ease.settle))};
  }
  if(stage==='returning'){
    const prior=simulation.returnFrom.frame??referenceSand;
    return {...prior,gain:prior.gain*(1-cue(simulation.age,130,330,ease.retreat))};
  }
  if(stage==='measuring'&&simulation.recovered&&simulation.heldSand&&oximeter.oxygen===null)return {...simulation.heldSand,gain:.70};
  if(stage==='measuring'&&simulation.fault==='oxygen')return simulation.heldSand?{...simulation.heldSand,gain:.7}:{...referenceSand,birth:0,capture:0,gain:0};
  const live = stage === 'measuring' && !sensorIssue();
  const firstSample = oximeter.samples[0]?.at;
  const hasSample = firstSample !== undefined;
  const elapsed = oximeter.elapsed;
  const reduced = lessMotion.checked;
  const sampleAge = hasSample ? Math.max(0, elapsed - firstSample) : 0;
  const maturity = Math.min(1, oximeter.sampleCount / 6);
  const birth = !live || !hasSample ? 0 :
    reduced ? (oximeter.sampleCount >= 2 ? 1 : .27) :
    Math.max(simulation.birthFloor,cue(sampleAge,150,openingMs,ease.spread));
  const capture = !reduced && live && hasSample ? (.81 + .19 * maturity) * softRamp(birth * 6) : 0;
  const age = last => live && last !== null ? Math.min(1.2, (elapsed - last) / 1000) : 1.2;
  return {
    birth, capture, gain:1, oxygenCohesion:maturity, oxygenAge:age(oximeter.oxygenAt),
    pulseAge:age(oximeter.pulseAt), ...oximeter.sandAt(elapsed),
  };
}

function drawMaterial(time) {
  if (!material || canvas.hidden || !drawnSize) return;
  if (time - lastDraw < 14 || (activeDialog && !invalidateDrawing)) return;
  const frame = materialFrame();
  const sample = Object.values(frame).map(value => value.toFixed(4)).concat(drawnSize).join('/');
  if (!invalidateDrawing && sample === renderedSample) return;
  material.draw(frame);
  if (simulation.stage === 'measuring' && !sensorIssue() && oximeter.sampleCount) {
    simulation.lastSand = frame;
  }
  renderedSample = sample;
  invalidateDrawing = false;
  lastDraw = time;
}

function tick(time) {
  const dt = (lastTick ? Math.min(110,time-lastTick) : 0) * (halfSpeed.checked ? .5 : 1);
  lastTick = time;
  if(stylesReady&&!document.hidden&&host.automatic()){
    motionClock+=dt;
    if(!activeDialog||liveViews.has(simulation.stage)||simulation.stage==='recording')advanceMeasurement(dt);
  }
  placeChoreography();
  drawMaterial(time);
  if(!disposed) frameId=requestAnimationFrame(tick);
}

function dispose() {
  if(disposed)return;
  disposed=true;
  lifetime.abort();
  resizeObserver.disconnect();
  cancelAnimationFrame(frameId);
  material?.dispose?.();
}

function revealStyledSurface() {
  const sheets=[...root.querySelectorAll('link[rel="stylesheet"]')];
  const show=()=>{
    if(disposed||stylesReady||sheets.some(link=>!link.sheet))return;
    trackScale();
    stylesReady=true;
    element.style.removeProperty('opacity');
    element.inert=false;
  };
  const failed=()=>{
    dispose();
    const notice=document.createElement('div');
    notice.style.cssText='padding:72px 24px 24px;color:#f5f5f5;font:inherit';
    const message=document.createElement('p');
    message.setAttribute('role','status');
    message.textContent=reviewFooter?'The test screen could not load.':'血氧画面未能加载。';
    notice.append(message);
    if(host.retryView){
      const retry=document.createElement('button');
      retry.type='button';
      retry.textContent=reviewFooter?'Try again':'重试';
      retry.style.cssText='min-height:40px;padding:0 18px;border:0;border-radius:20px;background:#d70960;color:#fff;font:inherit;cursor:pointer';
      retry.addEventListener('click',host.retryView,{once:true});
      notice.append(retry);
    }
    root.replaceChildren(notice);
    element.style.removeProperty('opacity');
    element.inert=false;
  };
  for(const sheet of sheets){
    sheet.addEventListener('load',show,{once:true,signal:lifetime.signal});
    sheet.addEventListener('error',failed,{once:true,signal:lifetime.signal});
  }
  show();
}


// Only durable material/measurement state crosses into the session. Live samples
// must reacquire after a page refresh. A released pair can retry the same receipt.
function checkpoint() {
  if(restoring||disposed)return;
  const s=simulation;
  host.checkpoint({
    stage:s.stage, captureId:s.captureId, savedId:s.savedId, resultSand:s.resultSand,
    pending:s.pending, pendingSand:s.pendingSand, releaseConfirmed:s.releaseConfirmed,
    receiptSeen:!!s.receipts[s.captureId], saveProblem:s.saveProblem, afterStop:s.afterStop,
    failure:s.failure, replaced:s.replaced, link:s.link, fault:s.fault, contact:s.contact,
    settings:{...settings}, reduced:host.directEnd?directReduceOverride:lessMotion.checked, slow:halfSpeed.checked
  });
}



function restore() {
  const initial=host.snapshot(), s=simulation, cache=initial.cache||{};
  s.result=initial.result;
  s.savedId=initial.savedId;
  s.retesting=initial.retest;
  s.resultSand=s.result?(cache.resultSand||referenceSand):null;
  connected.checked=s.connected=initial.connected;
  s.link=s.connected?'connected':cache.link==='failed'?'failed':'offline';
  contact.checked=s.contact=cache.contact!==false;
  s.fault=cache.fault||'normal';
  Object.assign(settings,cache.settings);
  if(typeof cache.reduced==='boolean')applyMotionOverride(cache.reduced);
  halfSpeed.checked=!!cache.slow;
  syncMotionPreference();
  if(initial.acq){
    s.captureId=initial.acq.id;
    const same=cache.captureId===s.captureId;
    s.pending=initial.acq.oxygenPair||(same?cache.pending:null);
    if(s.pending)s.pendingSand=cache.pendingSand||referenceSand;
    s.releaseConfirmed=!!initial.acq.oxygenPair;
    if(same&&cache.receiptSeen)s.receipts[s.captureId]=s.pending;
    if(initial.stopping){s.afterStop=cache.afterStop||'stopped';s.failure=cache.failure;setStage('stopping');}
    else if(s.releaseConfirmed){s.saveProblem=cache.saveProblem||'saveUnknown';setStage(s.saveProblem);}
    else if(s.pending){setStage('releasing');}
    else setStage('acquiring');
  }else if(initial.resultView&&s.result){
    s.replaced=!!cache.replaced;s.retesting=false;setStage('result');
  }else if(initial.stopped&&['failed','stopped'].includes(cache.stage)&&cache.captureId===initial.stopped){
    s.captureId=cache.captureId;s.failure=cache.failure;setStage(cache.stage);
  }else setStage('ready');
  restoring=false;checkpoint();
}

function configure(key,value) {
  const s=simulation;
  if(key==='oxygen'||key==='pulse'){settings[key]=Number(value);}
  else if(key==='connected'){connected.checked=!!value;updateSensor();host.connected(s.connected);}
  else if(key==='contact'){contact.checked=!!value;updateSensor();}
  else if(key==='reduced'){applyMotionOverride(value);}
  else if(key==='slow'){halfSpeed.checked=!!value;}
  else if(key==='fault'){
    const before=s.fault;s.fault=value;
    if(value==='connect'&&s.stage==='ready'){connected.checked=false;s.connected=false;s.link='offline';host.connected(false);}
    if(value==='pulse'&&before!==value){oximeter.invalidatePulse();s.partialAge=0;}
    if(value==='oxygen'&&before!==value){s.heldSand=s.lastSand;oximeter.invalidateOxygen();s.partialAge=0;}
    handleSignal();
  }
  renderInterface();checkpoint();
}
restore();
trackScale();
revealStyledSurface();
initializeMaterial();
frameId=requestAnimationFrame(tick);
return {
  configure, refresh:renderInterface,
  step() {if(!host.automatic()){motionClock+=500;advanceMeasurement(500);placeChoreography();drawMaterial(performance.now());}},
  dispose
};
};
