/* A teaching illustration with a fixed camera, a stationary torso and one moving arm. */
(() => {
  const WIDTH = 306;
  const HEIGHT = 234;
  const REST = 4;
  const PEAK = 180;
  const MAX_ARM = 101;
  const START = 0.55;
  const REACH = 2.95;
  const RELEASE = 3.75;
  const END = 5.65;
  const PERIOD = 5.95;

  const frontTorso = new Path2D(
    'M 145 87 Q 148 96 142 102 C 138 105 132 106 129 113 ' +
    'C 124 123 123 136 125 152 C 127 174 119 194 117 228 ' +
    'L 189 228 C 187 194 179 174 181 152 C 183 136 182 123 177 113 ' +
    'C 174 106 168 105 164 102 Q 158 96 161 87 Z'
  );
  const frontHead = new Path2D(
    'M 153 54 C 164 54 172 61 172 72 C 172 86 165 95 155 99 ' +
    'C 145 100 135 86 135 72 C 135 61 142 54 153 54 Z'
  );
  const profileTorso = new Path2D(
    'M 128 85 L 146 83 C 144 96 144 100 150 106 C 155 112 158 123 157 132 ' +
    'C 155 145 151 156 151 171 C 151 188 157 204 154 228 L 116 228 ' +
    'C 115 204 121 188 121 170 C 121 155 114 147 114 132 ' +
    'C 113 116 119 110 123 104 Q 128 97 128 85 Z'
  );
  const profileHead = new Path2D(
    'M 136 54 C 149 50 159 57 161 68 C 162 74 163 75 165 79 ' +
    'Q 166 81 162 83 Q 161 92 154 96 C 143 99 132 94 126 82 ' +
    'C 119 66 125 57 136 54 Z'
  );

  const clamp = value => Math.max(0, Math.min(1, value));
  const smooth = value => { const t = clamp(value); return t*t*(3-2*t); };

  function angleAt(seconds) {
    if (seconds <= START) return REST;
    if (seconds < REACH) return REST + (PEAK-REST)*smooth((seconds-START)/(REACH-START));
    if (seconds <= RELEASE) return PEAK;
    return PEAK - (PEAK-REST)*smooth((seconds-RELEASE)/(END-RELEASE));
  }

  function armAt(view, angle) {
    const degrees = Math.max(REST, Math.min(PEAK, angle));
    const radians = Math.PI*degrees/180;
    const lift = smooth((degrees-75)/105);
    const front = view === 'side';
    const pivot = front ? [121+1.2*lift,116-3.4*lift] : [135+1.8*lift,117-2.7*lift];
    const sign = front ? -1 : 1;
    const direction = [sign*Math.sin(radians),Math.cos(radians)];
    const outer = [sign*Math.cos(radians),-Math.sin(radians)];
    const point = (along, across=0) => [
      pivot[0]+direction[0]*along+outer[0]*across,
      pivot[1]+direction[1]*along+outer[1]*across
    ];

    const outline = new Path2D();
    const collar = front ? [144,106] : [123,107];
    const underarm = front ? [127,148] : [144,137];
    const edge = point(18,10.3);
    const inner = point(28,-10.2);
    const turn = smooth((degrees-62)/105);
    const upperJoin = front ? [132,105-3*turn] : [113,105+2*turn];
    const lowerJoin = front ? [124-2*turn,153-12*turn] : [145+8*turn,138+turn*3];
    outline.moveTo(...collar);
    outline.bezierCurveTo(...upperJoin,...point(5,10.1),...edge);
    const drawCurve = (a,b,c,d,e,f) => outline.bezierCurveTo(...point(a,b),...point(c,d),...point(e,f));
    drawCurve(27,10.6, 34,8.9, 41,8.3);
    drawCurve(48,8.8, 61,7.9, 73,5.2);
    drawCurve(78,4.8, 83,5.6, 87,5.6);
    drawCurve(93,5.6, 99,4.0, MAX_ARM,1.5);
    drawCurve(103.1,-.7, 99.1,-3.8, 94.0,-3.9);
    drawCurve(90,-4.0, 88,-3.5, 86,-4.3);
    drawCurve(83,-5.3, 82,-6.0, 80,-6.0);
    drawCurve(78,-5.9, 78,-4.8, 73,-4.9);
    drawCurve(63,-6.0, 54,-7.4, 42,-7.7);
    drawCurve(36,-7.9, 31,-9.2, 28,-10.2);
    outline.bezierCurveTo(inner[0]-direction[0]*14,inner[1]-direction[1]*14,...lowerJoin,...underarm);
    outline.quadraticCurveTo(front?143:133,front?131:123,...collar);
    outline.closePath();

    return {outline, pivot, direction, point, elbow:point(42), wrist:point(76), hand:point(MAX_ARM)};
  }

  function gradient(ctx,x,y,r,b,stops) {
    const fill = ctx.createLinearGradient(x,y,r,b);
    for (const [at,color] of stops) fill.addColorStop(at,color);
    return fill;
  }

  function drawArm(ctx,arm,bodyTone,muted) {
    const {outline,point} = arm;
    ctx.fillStyle = bodyTone;
    ctx.fill(outline);
    const longLight = muted
      ? [[0,'rgba(98,110,122,0)'],[.65,'#59636e'],[1,'#404a56']]
      : [[0,'rgba(185,200,214,0)'],[.16,'rgba(181,196,209,.045)'],[.40,'rgba(179,193,206,.38)'],
         [.70,'#b9c6ce'],[1,'#dce4e4']];
    ctx.fillStyle = gradient(ctx,...point(21),...point(74),longLight);
    ctx.fill(outline);
    if (muted) return;
    const glow = point(61,4);
    const satin = ctx.createRadialGradient(...glow,1,...glow,27);
    satin.addColorStop(0,'rgba(255,255,255,.16)');
    satin.addColorStop(1,'rgba(255,255,255,0)');
    ctx.fillStyle = satin;
    ctx.fill(outline);
  }

  function draw(ctx,{view='side',side='left',angle=REST}) {
    const {width,height} = ctx.canvas;
    ctx.setTransform(1,0,0,1,0,0);
    ctx.clearRect(0,0,width,height);
    const scale = Math.min(width/WIDTH,height/HEIGHT);
    ctx.setTransform(scale,0,0,scale,(width-WIDTH*scale)/2,(height-HEIGHT*scale)/2);
    ctx.save();
    if (side === 'right') { ctx.translate(WIDTH,0); ctx.scale(-1,1); }
    const frontal = view === 'side';
    const bodyTone = gradient(ctx,114,103,191,189,[[0,'#8c98a2'],[.45,'#626f7b'],[1,'#333d48']]);
    const headTone = gradient(ctx,133,52,171,101,[[0,'#aab6c0'],[.38,'#8795a1'],[1,'#47525f']]);
    const body = frontal ? frontTorso : profileTorso;
    const head = frontal ? frontHead : profileHead;
    if (frontal) {
      ctx.save();
      ctx.translate(WIDTH,0);
      ctx.scale(-1,1);
      const idleTone = gradient(ctx,117,108,149,175,[[0,'#798590'],[1,'#434d59']]);
      drawArm(ctx,armAt('side',REST),idleTone,true);
      ctx.restore();
    }
    ctx.fillStyle = bodyTone;
    ctx.fill(body);
    ctx.fillStyle = headTone;
    ctx.fill(head);
    const lowerTone = gradient(ctx,0,180,0,228,[[0,'rgba(8,11,16,0)'],[1,'#080b10']]);
    ctx.fillStyle = lowerTone;
    ctx.fill(body);
    drawArm(ctx,armAt(view,angle),bodyTone,false);
    ctx.restore();
  }

  function landmarks(view,side,angle) {
    const arm = armAt(view,angle);
    const project = ([x,y]) => [side==='right'?WIDTH-x:x,y];
    return {shoulder:project(arm.pivot),elbow:project(arm.elbow),
            wrist:project(arm.wrist),hand:project(arm.hand)};
  }

  window.ShoulderFigure = Object.freeze({draw,landmarks,angleAt,REST,PEAK,PERIOD,WIDTH,HEIGHT});
})();
