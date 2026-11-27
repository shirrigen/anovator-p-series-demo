(function(root){
  'use strict';
  const number=v=>Number.isFinite(Number(v))&&Number(v)>0?Number(v):null;
  function init(s){return s.weight??={record:null,status:'idle',attempt:null};}
  function begin(s){s.weight={record:null,status:'acquiring',attempt:s.height.attempt};s.basics.weight=null;}
  function adopted(s){const w=init(s);return w.record?.participantId===s.user?.id?w.record:null;}
  function usable(s){const w=init(s),r=adopted(s);return !!(r&&number(r.value)&&w.status==='valid'&&r.attempt===w.attempt);}
  function event(s,p){
    const w=init(s);
    if(!s.acq||!['measure/body','group-measure'].includes(s.route)||w.status!=='acquiring'||p.attempt!==w.attempt)return false;
    if(s.acq.kind==='group'&&s.group?.states.body!=='collecting')return false;
    if(p.event==='failed'){w.status='failed';w.record=null;s.basics.weight=null;return true;}
    if(p.event!=='valid'||!number(p.value))return false;
    w.record={value:number(p.value),unit:'kg',method:'device-measurement',origin:'measurement',recordedAt:new Date().toISOString(),participantId:s.user.id,attempt:w.attempt,sample:true};
    w.status='valid';s.basics.weight=w.record.value;return true;
  }
  root.ANOVATOR_WEIGHT={init,begin,adopted,usable,event};
  if(typeof module!=='undefined')module.exports=root.ANOVATOR_WEIGHT;
})(globalThis);
