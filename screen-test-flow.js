(function(root){
  'use strict';

  const ids = ['vision', 'color', 'astigmatism', 'agility'];
  const eyeOrder = {vision: ['right', 'left'], astigmatism: ['left', 'right']};
  const directions = ['up', 'down', 'left', 'right', 'none'];
  const charts = ['C','P','E'];
  const plate = {options: ['17', '19', '29', '98'], answer: '29'};
  const rounds = 5;
  const uses = id => ids.includes(id);
  const needsPosition = id => Object.hasOwn(eyeOrder, id);
  const directionFor = eye => eye === 'right' ? 'right' : 'left';
  const lineNumber = step => step === 24 ? 12 : step / 2;
  const lineAngle = step => (step * 15 + 90) % 180;
  const outcome = (key, value, label, unit = '', pending = false) => ({id:key, label, value, unit, pending});

  function create(id, {prior, adjustment = false, examiner = false} = {}){
    const eyes = needsPosition(id) ? {...prior?.eyes} : {};
    const eye = eyeOrder[id]?.find(side => !eyes[side]);
    const phase = {vision:'prompt', color:'prompt', astigmatism:'compare', agility:'waiting'}[id];
    return {id, phase, seq:0, eyes, eye:eye || null, adjustment:!!adjustment,
      answer:null, lineStep:7, settingStep:2, target:null, times:[],
      ...(id==='vision'&&examiner?{examiner:true,chart:'E'}:{})};
  }

  function otherEye(q){
    const next = eyeOrder[q.id].find(side => !q.eyes[side]);
    if(!next)return 'complete';
    q.eye = next;
    q.phase = 'switch';
    return 'changed';
  }

  function resetEye(q){
    q.answer = null;
    q.lineStep = 7;
    q.settingStep = 2;
    q.phase = q.id === 'vision' ? 'prompt' : 'compare';
  }

  function finishAstigmatism(q){
    q.eyes[q.eye] = {
      kind:q.answer,
      line:q.answer === 'line' ? lineNumber(q.lineStep) : null,
      angle:q.answer === 'line' ? lineAngle(q.lineStep) : null,
      setting:q.adjustment && q.answer === 'line' ? q.settingStep * .25 : null,
    };
    return otherEye(q);
  }

  function respond(q, op, value){
    switch(q.id){
      case 'vision':
        if(q.examiner){
          if(q.phase==='prompt'&&op==='chart'&&charts.includes(value)&&q.chart!==value){
            q.chart=value;return 'changed';
          }
          if(q.phase==='prompt'&&op==='grade'&&['correct','incorrect'].includes(value)){
            q.answer=value;q.phase='receipt';return 'changed';
          }
          if(q.phase==='receipt'&&op==='settle'){
            q.eyes[q.eye]={chart:q.chart,judgement:q.answer};
            return otherEye(q);
          }
          break;
        }
        if(q.phase === 'prompt' && op === 'answer' && directions.includes(value)){
          q.answer = value;
          q.phase = 'receipt';
          return 'changed';
        }
        if(q.phase === 'receipt' && op === 'settle'){
          const standardExample = q.eye === 'right' ? '5.2' : '5.0';
          q.eyes[q.eye] = {response:q.answer, reading:q.answer === directionFor(q.eye) ? standardExample : null};
          return otherEye(q);
        }
        break;
      case 'color':
        if(q.phase === 'prompt' && op === 'answer' && [...plate.options, 'none'].includes(value)){
          q.answer = value;
          q.phase = 'receipt';
          return 'changed';
        }
        if(q.phase === 'receipt' && op === 'settle')return 'complete';
        break;
      case 'astigmatism':
        if(q.phase === 'compare' && ['choose-line','choose-equal'].includes(op)){
          q.answer = op === 'choose-line' ? 'line' : 'equal';
          q.phase = q.answer === 'line' ? 'direction' : 'equal';
          return 'changed';
        }
        if(['direction','equal','adjustment'].includes(q.phase) && op === 'change'){
          resetEye(q);
          return 'changed';
        }
        if(['direction','adjustment'].includes(q.phase) && op === 'step' && [-1,1].includes(value)){
          if(q.phase === 'direction')q.lineStep = (q.lineStep - 1 + value + 24) % 24 + 1;
          else q.settingStep = Math.max(0, Math.min(8, q.settingStep + value));
          return 'changed';
        }
        if(['direction','equal','adjustment'].includes(q.phase) && op === 'confirm'){
          if(q.phase === 'direction' && q.adjustment){q.phase = 'adjustment';return 'changed';}
          return finishAstigmatism(q);
        }
        break;
      case 'agility':
        if(q.phase === 'waiting' && op === 'cue' && Number.isInteger(value) && value>=0 && value<9){
          q.target = value;
          q.phase = 'lit';
          return 'changed';
        }
        if(['waiting','lit'].includes(q.phase) && op === 'tap' && Number.isInteger(value?.index) && value.index>=0 && value.index<9){
          if(q.phase === 'waiting')q.phase = 'early';
          else if(value.index !== q.target)q.phase = 'miss';
          else if(Number.isFinite(value.ms) && value.ms>=0){
            q.times.push(Math.round(value.ms));
            q.phase = 'receipt';
          }else return null;
          return 'changed';
        }
        if(q.phase === 'lit' && op === 'no-tap'){
          q.phase = 'no-tap';
          return 'changed';
        }
        if(q.phase === 'receipt' && op === 'settle'){
          if(q.times.length === rounds)return 'complete';
          q.phase = 'waiting';
          q.target = null;
          return 'changed';
        }
        if(['early','miss','no-tap'].includes(q.phase) && op === 'retry-round'){
          q.phase = 'waiting';
          q.target = null;
          return 'changed';
        }
        break;
    }
    if(q.phase === 'switch' && op === 'continue-eye'){
      resetEye(q);
      return 'changed';
    }
    if(q.phase === 'switch' && op === 'skip-eye')return 'partial';
    return null;
  }

  function input(q, op, value){
    const next = respond(q, op, value);
    if(next)q.seq++;
    return next;
  }

  // Explicit sample action for the existing reviewer seed/inspection tools.
  // The actual pages only dispatch commands from inputs or their review clock.
  function sampleStep(q){
    const op = {
      prompt:q.examiner?['grade','correct']:['answer', q.id === 'color' ? plate.answer : directionFor(q.eye)],
      receipt:['settle'], switch:['continue-eye'], compare:[q.eye==='left'?'choose-line':'choose-equal'],
      direction:['confirm'], equal:['confirm'], adjustment:['confirm'],
      waiting:['cue', q.times.length % 9], lit:['tap', {index:q.target, ms:534}],
      early:['retry-round'], miss:['retry-round'], 'no-tap':['retry-round'],
    }[q.phase];
    return op ? input(q, ...op) : null;
  }

  function record(q){
    if(q.id === 'agility'){
      const average = Math.round(q.times.reduce((sum, time) => sum + time, 0) / q.times.length);
      return {values:[outcome('reaction',average,'平均反应时间','ms'),outcome('count',q.times.length,'有效点击','次')], screen:{times:[...q.times]}};
    }
    if(q.id === 'color'){
      const value = q.answer === plate.answer ? '示例：未提示困难' : '示例：建议查看';
      return {values:[outcome('colorResult',value,'色觉样例'),outcome('plates',1,'已作答样例题','题')], screen:{answer:q.answer}};
    }
    const values = ['left','right'].map(side=>{
      const found = q.eyes[side];
      const label = side === 'left' ? '左眼' : '右眼';
      const id = side + 'Eye';
      if(!found)return outcome(id, '未测', label, '', true);
      if(q.id === 'vision'){
        return found.judgement?outcome(id, found.chart+' · '+(found.judgement==='correct'?'示例判分正确':'示例判分错误'), label):
          outcome(id, found.reading ?? '已记录示例作答', label);
      }
      if(found.kind === 'equal')return outcome(id, '线条相同', label);
      return outcome(id, found.angle, label + ' · 示例线角', '°');
    });
    return {values, screen:{eyes:q.eyes}};
  }

  const api = {ids, uses, needsPosition, directionFor, plate, rounds, charts, lineNumber, create, input, sampleStep, record};
  root.ANOVATOR_SCREEN_TEST_FLOW = api;
  if(typeof module !== 'undefined')module.exports = api;
})(globalThis);
