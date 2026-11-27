(function(root){
  'use strict';
  const copy=x=>JSON.parse(JSON.stringify(x)),now=()=>new Date().toISOString();
  let requestSequence=0;
  const number=v=>Number.isFinite(Number(v))&&Number(v)>0?Number(v):null;
  const key=(s,id=s.user?.id)=>JSON.stringify([s.profileId,String(id||'')]);
  const method=s=>s.settings.height==='auto'?(s.settings.heightMethod||root.ANOVATOR_CATALOG.profiles.find(p=>p.id===s.profileId)?.heightMethod||'automatic'): 'manual';
  const automatic=s=>method(s)!=='manual';
  const label=m=>({manual:'手动输入',ultrasonic:'设备测量',camera:'相机测量',automatic:'自动测量'}[m]||'来源未提供');
  function init(s){s.accounts??={};s.height??={record:null,status:'idle',attempt:null,sequence:0};return s.height;}
  function adopted(s){const h=init(s);return h.record&&h.record.participantId===s.user?.id?h.record:null;}
  function usable(s){const r=adopted(s),h=init(s);return !!(number(r?.value)&&r.method===method(s)&&(!automatic(s)||(h.status==='valid'&&r.attempt===h.attempt)));}
  function required(s,id){return id==='body'&&!automatic(s)&&!usable(s);}
  function login(s,id){
    init(s);s.height={record:null,status:'idle',attempt:null,sequence:s.height.sequence};s.basics={age:'',sex:'',height:null,weight:null};
    const saved=s.accounts[key(s,id)]?.height;
    if(!automatic(s)&&number(saved?.value)&&saved.method==='manual'){
      s.height.record={...copy(saved),participantId:id,adoptedAt:now(),origin:'account'};
      s.height.status='valid';s.basics.height=saved.value;
    }
  }
  function manual(s,value){
    if(!s.user||automatic(s)||!number(value))return false;
    const h=init(s),account=s.accounts[key(s)]||{},time=now();
    const record={value:number(value),unit:'cm',method:'manual',recordedAt:time,revision:(account.height?.revision||0)+1};
    s.accounts[key(s)]={...account,height:copy(record)};
    h.record={...record,participantId:s.user.id,origin:'manual-current',adoptedAt:time};h.status='valid';s.basics.height=record.value;return true;
  }
  function begin(s){
    const h=init(s);h.sequence++;h.attempt=String(h.sequence)+'-'+(++requestSequence)+'-'+now();s.bodyDataReady=false;
    if(automatic(s)){h.status='acquiring';h.record=null;s.basics.height=null;}
  }
  function event(s,p){
    const h=init(s);
    if(!automatic(s)||!s.acq||!['measure/body','group-measure'].includes(s.route)||h.status!=='acquiring'||p.attempt!==h.attempt)return false;
    if(s.acq.kind==='group'&&s.group?.states.body!=='collecting')return false;
    if(p.event==='failed'){h.status='failed';h.record=null;s.basics.height=null;return true;}
    if(p.event!=='valid'||!number(p.value))return false;
    h.record={value:number(p.value),unit:'cm',method:method(s),recordedAt:now(),adoptedAt:now(),origin:'measurement',participantId:s.user.id,attempt:h.attempt,sample:true};
    h.status='valid';s.basics.height=h.record.value;return true;
  }
  function invalidate(s){
    if(s.results.body){s.results.body.needsReview=true;s.status.body='needs-review';}
    if(s.report&&!s.report.historyId)s.report.stale=true;
    if(s.reports?.current)s.reports.current.stale=true;
  }
  root.ANOVATOR_HEIGHT={init,key,method,automatic,label,adopted,usable,required,login,manual,begin,event,invalidate,number};
  if(typeof module!=='undefined')module.exports=root.ANOVATOR_HEIGHT;
})(globalThis);
