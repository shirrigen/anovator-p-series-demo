window.ANOVATOR_OXYGEN_MATERIAL = (() => {
function interpolateProfile(rows, x) {
  const end = rows.length - 1;
  const index = Math.min(end - 1, rows.findIndex(row => row[0] >= x) - 1);
  if (index < 0) return rows[x <= rows[0][0] ? 0 : end].slice(1);
  const a = rows[index], b = rows[index + 1];
  const prev = rows[Math.max(0, index - 1)], next = rows[Math.min(end, index + 2)];
  const t = (x - a[0]) / (b[0] - a[0]);
  const delta = b[0] - a[0];
  return a.slice(1).map((value, slot) => {
    const j = slot + 1;
    const m0 = delta * (b[j] - prev[j]) / (b[0] - prev[0]);
    const m1 = delta * (next[j] - a[j]) / (next[0] - a[0]);
    const smooth = value + t * (m0 + t * (3 * (b[j] - value) - 2 * m0 - m1 + t * (2 * (value - b[j]) + m0 + m1)));
    return Math.min(Math.max(value, b[j]), Math.max(Math.min(value, b[j]), smooth));
  });
}

async function localThree() {
  const decoded = key => Uint8Array.from(atob(window.ANOVATOR_OXYGEN_THREE[key]), char => char.charCodeAt(0));
  const core = decoded('core');
  const module = new TextDecoder().decode(decoded('module'));
  const coreUrl = URL.createObjectURL(new Blob([core], { type: 'text/javascript' }));
  const moduleUrl = URL.createObjectURL(new Blob([module.replaceAll('./three.core.js', coreUrl)], { type: 'text/javascript' }));
  try {
    return await import(moduleUrl);
  } finally {
    URL.revokeObjectURL(moduleUrl);
    URL.revokeObjectURL(coreUrl);
  }
}


const sandWidth = 941;
const sandTop = 390;
const sandHeight = 744;
const saturation = v => Math.max(0, Math.min(1, v));
const softRamp = v => { const t = saturation(v); return t * t * (3 - 2 * t); };

async function loadSandPlate(src) {
  const image = new Image();
  image.src = src;
  await image.decode();
  const sheet = document.createElement('canvas');
  sheet.width = sandWidth;
  sheet.height = sandHeight;
  const ctx = sheet.getContext('2d', { alpha: false });
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, sandWidth, sandHeight);
  const height = 967 - sandTop;
  ctx.drawImage(image, 0, sandTop, sandWidth, height, 0, 0, sandWidth, height);
  const edges = ctx.createLinearGradient(0, 0, 0, height);
  edges.addColorStop(0, '#000');
  edges.addColorStop(22 / height, 'transparent');
  edges.addColorStop(1 - 32 / height, 'transparent');
  edges.addColorStop(1, '#000');
  ctx.fillStyle = edges;
  ctx.fillRect(0, 0, sandWidth, height);
  return sheet;
}

function repeatableRandom(seed) {
  return () => {
    seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

// A repeatable, mip-filtered relief tile. The lit cap, matte side and minute
// contact shadow belong to each grain. The grain pattern itself never flickers.
function makeSandTexture() {
  const size = 384;
  const field = new Float32Array(size * size);
  const random = repeatableRandom(491273);
  for (let i = 0; i < field.length; i++) field[i] = 128 + (random() - .5) * 28;
  for (let grain = 0; grain < 38500; grain++) {
    const x = random() * size, y = random() * size;
    const rx = .58 + 1.55 * random() ** 1.6, ry = rx * (.58 + .40 * random());
    const value = 23 + 71 * random(), shadow = 22 + 36 * random();
    for (let iy = Math.floor(y - ry - 1); iy <= y + ry + 1; iy++) {
      for (let ix = Math.floor(x - rx - 1); ix <= x + rx + 1; ix++) {
        const dx = (ix - x) / rx, dy = (iy - y) / ry;
        const body = Math.max(0, 1 - (dx * dx + dy * dy));
        const cap = Math.max(0, 1 - ((dx + .24) ** 2 + (dy + .30) ** 2) * 1.65);
        const foot = Math.max(0, 1 - ((dx - .33) ** 2 + (dy - .48) ** 2));
        const at = ((iy + size) % size) * size + (ix + size) % size;
        field[at] += 12 * body + value * cap - shadow * foot;
      }
    }
  }
  const sheet = document.createElement('canvas');
  sheet.width = sheet.height = size;
  const ctx = sheet.getContext('2d');
  const img = ctx.createImageData(size, size);
  for (let i = 0; i < field.length; i++) {
    const at = i * 4;
    img.data[at] = img.data[at + 1] = img.data[at + 2] = field[i];
    img.data[at + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return sheet;
}

function sandHeights(profile) {
  return Float32Array.from({length:sandWidth+1}, (_,x) => interpolateProfile(profile,x)[0]);
}

function ridgeAt(table, x) {
  const clamped = Math.max(0, Math.min(sandWidth - .0001, x));
  const index = Math.floor(clamped);
  return table[index] + (table[index + 1] - table[index]) * (clamped - index);
}

// Coordinates in the reference image are material coordinates. Both edges of
// that image cut through the ridge. Continue its tangent beyond each edge,
// then fit the complete surface with a single, isotropic camera scale.
const sandLeft = -80;
const sandRight = sandWidth + 96;
const sandLength = sandRight - sandLeft;
const sandMargin = 22;
const sandFit = (sandWidth - 2 * sandMargin) / sandLength;
const sandPivot = 715;
const toScreenX = x => sandMargin + (x - sandLeft) * sandFit;
const toMaterialX = x => sandLeft + (x - sandMargin) / sandFit;
const toScreenY = y => sandPivot + (y - sandPivot) * sandFit;
const toMaterialY = y => sandPivot + (y - sandPivot) / sandFit;

// The illuminated ridge reaches farther than its thick apron and rear veil.
// This depth-dependent edge also lets loose grains finish at different points.
function tipLight(taper, depth) {
  const retreat = .24*softRamp((Math.abs(depth-8)-12)/84)
    + .09*softRamp((-depth-14)/45) + .07*softRamp((depth-28)/78);
  return (.72+.28*taper) * softRamp((taper-retreat)/.39);
}

class SandSurface {
  constructor(profile, plate) {
    this.plate = plate;
    this.heights = sandHeights(profile);
    this.leftSlope = (this.heights[36] - this.heights[0]) / 36;
    this.rightSlope = (this.heights[sandWidth] - this.heights[sandWidth-36]) / 36;
    this.columns = Array.from({length:sandWidth}, (_,x)=>this.section(toMaterialX(x+.5)));
  }

  section(x, out = {}) {
    const side = saturation(Math.min((x-sandLeft)/171,(sandRight-x)/216));
    out.taper = side*(.75 + side*(1.5-1.25*side));
    // A finite fibre spread lets the last few lit strands separate as the
    // apron disappears. Collapsing every layer into one point makes a pinched tip.
    out.thickness = .28 + .72*out.taper;
    out.x = x;
    if (x>=0 && x<=sandWidth) {
      out.sourceX = x;
      out.ridge = out.sourceRidge = ridgeAt(this.heights,x);
      return out;
    }
    const left = x<0;
    const border = left ? 0 : sandWidth;
    const run = left ? -sandLeft : sandRight-sandWidth;
    const distance = Math.abs(x-border);
    const slope = left ? this.leftSlope : this.rightSlope;
    const flatten = left ? .44 : .12;
    out.ridge = this.heights[border] + slope*(x-border)*(1-flatten*Math.min(1,distance/run));
    // Only diffuse lighting is borrowed from the shoulder. The advancing
    // relief and individual grains continue in their own material coordinates.
    const inset = .49*distance*(1-Math.exp(-distance/31));
    out.sourceX = left ? inset : border-inset;
    out.sourceRidge = ridgeAt(this.heights,out.sourceX);
    return out;
  }

  // Sample the same projected cross sections for browsers without WebGL2.
  // The photographic plate is prepared only once per fallback material.
  canvasPlate() {
    const sheet=document.createElement('canvas');
    sheet.width=sandWidth;
    sheet.height=sandHeight;
    const ctx=sheet.getContext('2d',{alpha:false});
    const output=ctx.createImageData(sandWidth,sandHeight);
    const src=this.plate.getContext('2d').getImageData(0,0,sandWidth,sandHeight).data;
    for (const [x,col] of this.columns.entries()) {
      if (col.taper<.001) continue;
      const stretch=sandFit*col.thickness;
      const crest=toScreenY(col.ridge)-sandTop;
      const sampleX=Math.max(0,Math.min(sandWidth-1.001,col.sourceX-.5));
      const sx=Math.floor(sampleX), fx=sampleX-sx;
      const top=Math.max(0,Math.floor(crest+(sandTop-col.sourceRidge)*stretch));
      const bottom=Math.min(sandHeight,Math.ceil(crest+(sandTop+sandHeight-col.sourceRidge)*stretch));
      for (let y=top; y<bottom; y++) {
        const depth=(y+.5-crest)/stretch;
        const sy=col.sourceRidge-sandTop+depth-.5;
        if (sy<0 || sy>=sandHeight-1) continue;
        const iy=Math.floor(sy), fy=sy-iy;
        const a=4*(iy*sandWidth+sx), b=a+4*sandWidth, k=4*(y*sandWidth+x);
        const light=tipLight(col.taper,depth);
        for (let c=0; c<3; c++) {
          const hi=src[a+c]+fx*(src[a+4+c]-src[a+c]);
          const lo=src[b+c]+fx*(src[b+4+c]-src[b+c]);
          output.data[k+c]=light*(hi+fy*(lo-hi));
        }
        output.data[k+3]=255;
      }
    }
    ctx.putImageData(output,0,0);
    return sheet;
  }
}

function surfaceDrift(x, travel) {
  return 4.8 * (Math.sin((x - travel * .88) * .008 + .38) - Math.sin(x * .008 + .38))
    + 2.8 * (Math.sin((x - travel * .68) * .015 - 1.1) - Math.sin(x * .015 - 1.1));
}

// A narrow crest appears at the silver shoulder first. The foreground and
// soft rear material arrive later than the carried grains on that crest.
function inletDelay(x, depth) {
  const along = x < 192 ? (192 - x) * .0018 : (x - 192) * .00102;
  const lane = depth - 6 - 7 * Math.sin(.011 * x + .8);
  const thickness = Math.min(.28, Math.abs(lane) * (lane < 0 ? .0029 : .0021));
  const edge = .012 * Math.sin(.037 * x + .068 * depth) + .013 * Math.sin(.015 * x - .093 * depth);
  return Math.max(.012, .032 + along + thickness + edge);
}

function inletCoverage(birth, delay) {
  return softRamp((1.35 * birth - delay) / .235);
}

// A low-resolution map supplies a continuous soft edge to both renderers.
// The separate black cover is only drawn by the Canvas 2D fallback.
class SandEnvelope {
  constructor(surface) {
    const w = 236, h = 186;
    this.map = document.createElement('canvas');
    this.map.width = w;
    this.map.height = h;
    const ctx = this.map.getContext('2d');
    const data = ctx.createImageData(w, h);
    this.delay = new Float32Array(w * h);
    for (let i = 0; i < w; i++) {
      const x = toMaterialX((i+.5)*sandWidth/w);
      const {ridge,thickness} = surface.section(x);
      for (let j = 0; j < h; j++) {
        const idx = j*w+i;
        const y = sandTop + (j+.5)*sandHeight/h;
        const depth=(toMaterialY(y)-ridge)/Math.max(.01,thickness);
        const delay = inletDelay(x,depth);
        this.delay[idx] = delay;
        const k = idx*4;
        data.data[k] = Math.round(255*delay/1.35);
        data.data[k+3] = 255;
      }
    }
    ctx.putImageData(data, 0, 0);
    this.cover = document.createElement('canvas');
    this.cover.width = w;
    this.cover.height = h;
    this.ctx = this.cover.getContext('2d');
    this.ink = this.ctx.createImageData(w,h);
  }

  shade(ctx, frame) {
    const { birth } = frame;
    if (birth >= 1) return;
    const w = this.cover.width, h = this.cover.height;
    for (let i=0; i<w; i++) {
      for (let j=0; j<h; j++) {
        const idx = j*w+i;
        const entry = inletCoverage(birth, this.delay[idx]);
        this.ink.data[4*idx+3] = Math.round(255*(1-entry));
      }
    }
    this.ctx.putImageData(this.ink,0,0);
    ctx.globalAlpha = 1;
    ctx.drawImage(this.cover,0,0,sandWidth,sandHeight);
  }
}

// Near grains can be followed through the saddle and on into the warm slope.
// Far grains follow the same direction on a more distant, slower sheet.
class SandTracers {
  constructor(surface) {
    this.surface = surface;
    this.section = {};
    const thumbnail = document.createElement('canvas');
    thumbnail.width = 128;
    thumbnail.height = 96;
    const ctx = thumbnail.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(surface.plate, 0, 0, 128, 96);
    this.roomLight = ctx.getImageData(0, 0, 128, 96).data;
    const random = repeatableRandom(19231);
    this.grains = Array.from({ length: Math.round(3150*sandLength/1005) }, () => {
      const rear = random() < .235;
      const lane = random() + random() - 1;
      const depth = rear ? -35 + lane * 26 : 14 + (random() ** 1.3) * 65 + lane * 10;
      return {
        origin: sandLength * random(),
        depth, lane: random() * 6.28,
        speed: (rear ? .40 : .82) + random() * (rear ? .12 : .23),
        size: (rear ? 1.15 : 1.35) + (rear ? 1.55 : 2.1) * random() ** 1.35,
        tone: random(), rear,
      };
    });
    this.xy = new Float32Array(this.grains.length * 3);
    this.paint = new Float32Array(this.grains.length * 3);
    this.sizes = Float32Array.from(this.grains, grain => grain.size);
  }

  place(frame) {
    const depthAtEntry = .53 + .47 * softRamp((frame.birth - .06) / .65);
    for (let i = 0; i < this.grains.length; i++) {
      const grain = this.grains[i];
      const distance = frame.current * grain.speed;
      const baseX = sandLeft + (grain.origin + distance) % sandLength;
      const warmPatch = Math.exp(-(((baseX - 715) / 105) ** 2));
      // Only the shallow warm surface catches the small extra travel per beat.
      const accentWeight = grain.rear ? 0 : warmPatch * Math.exp(-(((grain.depth - 22) / 25) ** 2));
      const x = baseX + frame.accent * accentWeight;
      const col = this.surface.section(x,this.section);
      const curve = grain.rear ? surfaceDrift(x - 85, frame.current * .54) : surfaceDrift(x, frame.current);
      const depth = grain.depth + (grain.rear ? 11 : 7) * Math.sin(.008 * x + grain.lane)
        + 3.5 * Math.sin(.018 * x + grain.lane * 2.4);
      const y = col.ridge + col.thickness*(depth*depthAtEntry + frame.capture*curve);
      const k = 3 * i;
      this.xy[k] = toScreenX(x);
      this.xy[k + 1] = toScreenY(y);
      const tx = Math.min(127, Math.max(0, Math.floor(col.sourceX*128/sandWidth)));
      const ty = Math.min(95, Math.max(0, Math.floor((col.sourceRidge + depth - sandTop)*96/sandHeight)));
      const sample = (128 * ty + tx) * 4;
      const lit = (.25 * this.roomLight[sample] + .65 * this.roomLight[sample+1] + .10 * this.roomLight[sample+2]) / 255;
      const warmth = softRamp((x - 365) / 382);
      const onRim = Math.exp(-(((depth - 12) / 42) ** 2));
      const dark = grain.tone < .43;
      const light = dark ? .026 + .45 * lit : .09 + .71 * Math.sqrt(lit) + .20 * grain.tone;
      const opacity = (grain.rear ? .18 : .62) * (.24+.76*softRamp(lit/.32)) * (.76+.24*onRim);
      this.paint[k] = light;
      this.paint[k + 1] = warmth;
      const advance = grain.rear ? 0 : .026 + .032 * grain.tone;
      const born = frame.birth >= 1 ? 1 : inletCoverage(frame.birth, inletDelay(x,depth)-advance);
      this.paint[k + 2] = opacity * born * tipLight(col.taper,depth);
    }
  }
}

const sandVertex = `
  attribute vec4 crossSection;
  varying vec2 fieldUV;
  varying vec4 section;
  void main() {
    fieldUV = uv;
    section = crossSection;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const sandFragment = `
  precision highp float;
  uniform sampler2D measuringPlate;
  uniform sampler2D sandTile;
  uniform sampler2D inletMap;
  uniform float birth;
  uniform float gain;
  uniform float capture;
  uniform float current;
  uniform float accent;
  uniform vec4 viewFit;
  varying vec2 fieldUV;
  varying vec4 section;
  float bell(float d, float w) { return exp(-d*d/(w*w)); }
  float hash(vec2 v) {
    vec3 p = fract(vec3(v.xyx) * .1031);
    p += dot(p, p.yzx + 33.33);
    return fract((p.x + p.y) * p.z);
  }
  float noise(vec2 p) {
    vec2 a = floor(p), f = fract(p);
    f = f*f*(3.-2.*f);
    return mix(mix(hash(a), hash(a+vec2(1,0)), f.x),
               mix(hash(a+vec2(0,1)), hash(a+vec2(1,1)), f.x), f.y);
  }
  float silhouette(float x, float t) {
    return 4.8*(sin((x-t*.88)*.008+.38)-sin(x*.008+.38))
         + 2.8*(sin((x-t*.68)*.015-1.1)-sin(x*.015-1.1));
  }
  vec2 plateUV(vec2 p) { return vec2(p.x / 941., (p.y - 390.) / 744.); }
  float textureGrains(vec2 p) {
    return (texture2D(sandTile, p/384.).r - .54)*2.;
  }
  void main() {
    // section = ridge height, optical sample x, sample ridge, end taper.
    float taper=section.w;
    if (taper<.001) { gl_FragColor=vec4(0.,0.,0.,1.); return; }
    float thickness=.28+.72*taper;
    vec2 screen=vec2(fieldUV.x*941.,390.+744.*(1.-fieldUV.y));
    float x=viewFit.x+(screen.x-viewFit.z)/viewFit.y;
    float y=viewFit.w+(screen.y-viewFit.w)/viewFit.y;
    float depth=(y-section.x)/thickness;
    vec2 p=vec2(x,section.x+depth);
    float flow = current;
    float warmArea = bell(p.x-715., 108.) * bell(depth-23., 32.);
    float front = flow + accent * warmArea;
    float lean = silhouette(p.x, flow) * capture;
    float spread = mix(.32,1.,smoothstep(.085,.78,birth));
    vec2 mu = plateUV(vec2(section.y, section.z + (depth-lean)/spread));
    vec3 still = texture2D(measuringPlate, mu).rgb;
    vec3 diffuse = texture2D(measuringPlate, mu, 2.75).rgb;
    float h = depth - lean;
    float airborne = bell(h+23., 42.);
    float skin = bell(h-20., h < 20. ? 35. : 78.);
    float rim = bell(h-6., 28.);
    float z = h + 9.*sin(.009*p.x) + 4.*sin(.018*p.x+.8);
    float frontX = p.x - front;
    float middleX = p.x - .69 * flow;
    float rearX = p.x - .42 * flow;

    // Grains and wider, irregular soft flutes advect in surface coordinates.
    // The lighting stays in the room. There is no timed brightness envelope.
    float grains = textureGrains(vec2(frontX+.28*z, z*.98));
    float fine = textureGrains(vec2(middleX*1.31-.45*z, z*1.55)+vec2(92.,74.));
    float longGrains = noise(vec2(frontX/44., (z+7.*sin(frontX*.008))/5.6));
    float shadows = noise(vec2(frontX/20.+4., z/3.7))-.5;
    float broad = noise(vec2(middleX/87., z/13.))-.5;
    float relief = .88*grains+.24*fine+.53*(longGrains-.5)+.26*shadows+.34*broad;
    vec3 layer = diffuse * max(.32, 1. + relief);
    vec3 color = mix(still, layer, capture * min(1., .93*skin+.28*airborne));

    // Loose pearl/smoke sheets behind the crest share a channel of dark air.
    // A broad pocket of grains passes across the middle even where the still
    // has very little diffuse light, keeping the two peaks in one current.
    float tint = smoothstep(350., 769., p.x);
    vec3 pearl = mix(vec3(.89,.88,.86), vec3(.97,.84,.71), tint);
    float backRidge = -33. + 13.*sin((p.x-.42*flow)*.0068-1.4)
      + 9.*(noise(vec2(rearX/164., 8.))-.5);
    float rearDensity = noise(vec2(rearX/86.,(h-backRidge)/10.));
    float sheet = bell(h-backRidge, 8.5 + 5.*rearDensity) * (.14+.86*rearDensity);
    float middleFold = 21. + 9.*sin(middleX*.012+.7) + 14.*(noise(vec2(middleX/136.,4.))-.5);
    float folded = bell(h-middleFold, 12.) * (noise(vec2(middleX/45., z/7.))-.38);
    // One long parcel of more closely packed sand travels from silver through
    // the saddle. Its softer, more open wake reveals the slower sheet behind.
    float localX = p.x - (156. + 1.06*flow);
    float parcelLevel = 13. + .063*localX + 5.*sin(frontX*.017);
    float parcel = bell(localX,localX<0.?110.:81.)*bell(h-parcelLevel,19.);
    float wake = bell(localX + 94.,84.) * bell(h-parcelLevel+4.,22.);
    color *= 1. + capture*(.20*parcel-.14*wake);
    float airGap = bell(h-backRidge-16., 8.) * airborne;
    float edge = .38+.62*bell(p.x-485.,475.);
    color *= 1. - .14*airGap*capture;
    color += pearl * capture * edge * (.082*sheet + .083*folded*skin + .040*parcel*(.5+longGrains));
    float threshold = texture2D(inletMap,plateUV(screen)).r*1.35 + .010*grains;
    float born = birth >= 1. ? 1. : smoothstep(threshold,threshold+.235,birth*1.35);
    float retreat=.24*smoothstep(12.,96.,abs(h-8.))+.09*smoothstep(14.,59.,-h)
                 +.07*smoothstep(28.,106.,h);
    float tip=(.72+.28*taper)*smoothstep(retreat,retreat+.39,taper);
    gl_FragColor = vec4(clamp(color*born*gain*tip,0.,1.),1.);
  }
`;


const tracerVertex = `
  attribute vec3 pigment;
  attribute float grainSize;
  uniform float pixelScale;
  varying vec3 tint;
  varying float opacity;
  void main() {
    float light = pigment.x;
    tint = light * mix(vec3(1.01,1.,.985), vec3(1.055,.97,.87), pigment.y);
    opacity = pigment.z;
    gl_Position = vec4(position.x*2./941.-1., 1.-(position.y-390.)*2./744., 0., 1.);
    gl_PointSize = max(1., grainSize * pixelScale);
  }
`;

const tracerFragment = `
  precision highp float;
  uniform float visibility;
  varying vec3 tint;
  varying float opacity;
  void main() {
    vec2 q = 2.*gl_PointCoord-1.;
    float r = length(q*vec2(.94,1.06));
    float cover = 1.-smoothstep(.28,1.,r);
    float illumination = .78+.22*(1.-smoothstep(.05,1.,length(q+vec2(.28,.28))));
    gl_FragColor = vec4(tint*illumination, opacity*cover*visibility);
  }
`;

function buildThreeGrain(canvas, THREE, surface) {
  const context = canvas.getContext('webgl2', { alpha: false, depth: false, stencil: false, antialias: false, powerPreference: 'low-power' });
  if (!context) throw new Error('WebGL2 is unavailable');
  const renderer = new THREE.WebGLRenderer({ canvas, context, alpha: false, antialias: false, depth: false, stencil: false });
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, .01, 10);
  camera.position.z = 2;
  const scene = new THREE.Scene();
  const texture = (sheet, repeat = false) => {
    const tex = new THREE.CanvasTexture(sheet);
    tex.flipY = false;
    tex.colorSpace = THREE.NoColorSpace;
    if (repeat) tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    return tex;
  };
  const envelope = new SandEnvelope(surface);
  const uniforms = {
    measuringPlate: { value: texture(surface.plate) },
    viewFit: {value:new THREE.Vector4(sandLeft,sandFit,sandMargin,sandPivot)},
    sandTile: { value: texture(makeSandTexture(), true) },
    inletMap: { value: texture(envelope.map) },
    birth: { value: 0 }, gain: { value: 1 }, capture: { value: 0 },
    current: { value: 0 }, accent: { value: 0 },
    pixelScale: { value: 1 }, visibility: { value: 0 },
  };
  const geometry = new THREE.PlaneGeometry(2,2,360,1);
  const positions = geometry.getAttribute('position');
  const sections = new Float32Array(positions.count*4);
  for (let i = 0; i < positions.count; i++) {
    const x=toMaterialX(sandWidth*(positions.getX(i)+1)/2);
    const col=surface.section(x);
    sections.set([col.ridge,col.sourceX,col.sourceRidge,col.taper],4*i);
  }
  geometry.setAttribute('crossSection',new THREE.BufferAttribute(sections,4));
  const field = new THREE.Mesh(geometry, new THREE.ShaderMaterial({
    uniforms, vertexShader: sandVertex, fragmentShader: sandFragment,
    depthTest: false, depthWrite: false, toneMapped: false,
  }));
  field.frustumCulled = false;
  scene.add(field);
  const tracers = new SandTracers(surface);
  const pointsGeometry = new THREE.BufferGeometry();
  const pos = new THREE.BufferAttribute(tracers.xy, 3).setUsage(THREE.DynamicDrawUsage);
  const pigment = new THREE.BufferAttribute(tracers.paint, 3).setUsage(THREE.DynamicDrawUsage);
  pointsGeometry.setAttribute('position', pos);
  pointsGeometry.setAttribute('pigment', pigment);
  pointsGeometry.setAttribute('grainSize', new THREE.BufferAttribute(tracers.sizes, 1));
  const points = new THREE.Points(pointsGeometry, new THREE.ShaderMaterial({
    uniforms, vertexShader: tracerVertex, fragmentShader: tracerFragment,
    transparent: true, depthTest: false, depthWrite: false, toneMapped: false,
  }));
  points.frustumCulled = false;
  points.renderOrder = 1;
  scene.add(points);
  return {
    dispose() {
      for (const uniform of Object.values(uniforms)) if (uniform.value?.isTexture) uniform.value.dispose();
      geometry.dispose(); pointsGeometry.dispose(); field.material.dispose(); points.material.dispose();
      renderer.dispose(); renderer.forceContextLoss();
    },
    kind: 'webgl2', label: 'Three.js r' + THREE.REVISION + ' · WebGL2',
    resize(width) {
      const renderWidth = Math.max(240, Math.min(sandWidth, width));
      renderer.setSize(renderWidth, Math.round(renderWidth * sandHeight / sandWidth), false);
      uniforms.pixelScale.value = sandFit * renderWidth / sandWidth;
    },
    draw(frame) {
      for (const name of ['gain','capture','current','accent','birth']) {
        uniforms[name].value = frame[name];
      }
      uniforms.visibility.value = frame.capture * frame.gain;
      points.visible = uniforms.visibility.value > .002;
      if (points.visible) {
        tracers.place(frame);
        pos.needsUpdate = pigment.needsUpdate = true;
      }
      renderer.render(scene, camera);
    },
  };
}

function buildFallbackGrain(canvas, surface) {
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx || !surface) return { label: '材质不可用', kind: 'unavailable', resize() {}, draw() {} };
  const envelope = new SandEnvelope(surface);
  const particles = new SandTracers(surface);
  const plate = surface.canvasPlate();
  const grainColors = Array.from({length: 6}, (_, hue) =>
    Array.from({length: 16}, (_, v) => {
      const value = Math.round(255 * v / 15), t = hue / 5;
      return 'rgb(' + value + ',' + Math.round(value * (1-.04*t)) + ',' + Math.round(value * (1-.14*t)) + ')';
    }));
  return {
    kind: 'canvas2d', label: 'Canvas 2D · 流沙',
    resize(width) {
      canvas.width = Math.min(sandWidth, width);
      canvas.height = Math.round(canvas.width * sandHeight / sandWidth);
    },
    draw(frame) {
      ctx.setTransform(canvas.width / sandWidth, 0, 0, canvas.height / sandHeight, 0, 0);
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, sandWidth, sandHeight);
      if (frame.birth <= 0) return;
      const spread = .32 + .68 * softRamp((frame.birth-.085)/.695);
      ctx.globalAlpha = frame.gain;
      if (spread >= 1 && frame.capture===0) {
        ctx.drawImage(plate,0,0,sandWidth,sandHeight);
      } else {
        const strip = 4;
        for (let x=0; x<sandWidth; x+=strip) {
          const w=Math.min(strip,sandWidth-x);
          const col=surface.columns[Math.floor(x+w/2)];
          const shift=sandFit*col.thickness*surfaceDrift(col.x,frame.current)*frame.capture;
          const top=(toScreenY(col.ridge)-sandTop)*(1-spread)+shift;
          ctx.drawImage(plate,x,0,w,sandHeight,x,top,w,sandHeight*spread);
        }
      }
      ctx.globalAlpha = 1;
      envelope.shade(ctx,frame);
      const visibility = frame.capture * frame.gain;
      if (visibility > .002) {
        particles.place(frame);
        for (let i = 0; i < particles.grains.length; i++) {
          const k = 3*i, size = sandFit*particles.sizes[i];
          ctx.globalAlpha = visibility * particles.paint[k+2];
          ctx.fillStyle = grainColors[Math.round(5*particles.paint[k+1])][Math.round(15*particles.paint[k])];
          ctx.beginPath();
          ctx.ellipse(particles.xy[k], particles.xy[k+1]-sandTop, .52*size, .42*size, -.2, 0, 2*Math.PI);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
    },
  };
}

let library;
return { softRamp, loadSandPlate, SandSurface, buildThreeGrain, buildFallbackGrain, three:()=>library??=localThree() };
})();
