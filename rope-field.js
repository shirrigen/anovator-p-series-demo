// Adapted from S04 Jump Rope Three v04. See the current prototype handoff for source paths.
const testTime = 60000;
const resultDelay = 1080;
const previewStart = 52000;
const receiptWindow = 760;
const visualGap = 820;

const rawIntervals = [820, 1030, 900, 1180, 520, 1360, 1140, 870, 1220, 910, 655, 1305];
let instant = 0;
const simulatedRaw = Array.from({ length: 60 }, (_, index) => {
  instant += rawIntervals[index % rawIntervals.length];
  return instant;
});
const simulatedCounts = simulatedRaw.map((time, index) => ({
  at: Math.round(time * 59410 / simulatedRaw.at(-1)),
  total: index + 1
}));
const batchedCounts = simulatedCounts.filter(event => event.total % 3 === 0);
const packetsByMode = { each: simulatedCounts, batch: batchedCounts, final: [] };

class RopeSession {
  constructor() { this.ready(); }

  ready() {
    this.stage = "ready";
    this.mode = "each";
    this.elapsed = 0;
    this.total = null;
    this.brakeAt = null;
    this.pulseAt = -Infinity;
    this.cursor = 0;
    this.exitReason = null;
  }

  begin(mode = "each", offset = 0) {
    this.ready();
    this.stage = "measuring";
    this.mode = mode;
    this.packets = packetsByMode[mode] ?? packetsByMode.each;
    this.elapsed = offset;
    this.receiveThrough(offset, false);
  }

  receiveThrough(limit, announce) {
    while (this.cursor < this.packets.length && this.packets[this.cursor].at <= limit) {
      const packet = this.packets[this.cursor++];
      if (this.total !== null && packet.total <= this.total) continue;
      this.total = packet.total;
      if (announce && packet.at - this.pulseAt >= visualGap) this.pulseAt = packet.at;
    }
  }

  advance(delta) {
    if (!["measuring", "confirming"].includes(this.stage)) return;
    this.elapsed = Math.min(testTime + resultDelay, this.elapsed + Math.max(0, delta));
    this.receiveThrough(Math.min(this.elapsed, testTime), true);
    if (this.elapsed >= testTime) {
      this.brakeAt = testTime;
      this.stage = "confirming";
    }
    if (this.elapsed >= testTime + resultDelay) {
      this.stage = "result";
      this.total = 61;
    }
  }

  stop() {
    if (this.stage !== "measuring") return;
    this.brakeAt = this.elapsed;
    this.stage = "stopped";
  }

  fail() {
    if (this.stage !== "measuring" && this.stage !== "confirming") return;
    this.brakeAt ??= this.elapsed;
    this.stage = "failed";
  }

  leave(reason) {
    this.stage = "ended";
    this.exitReason = reason;
  }

  snapshot() {
    const pulseAge = this.elapsed - this.pulseAt;
    const lastReceipt = this.stage === "measuring" && pulseAge < receiptWindow;
    const view = this.stage !== "measuring" ? this.stage
      : this.total === null ? "waiting" : lastReceipt ? "receipt" : "live";
    return {
      stage: this.stage, view, mode: this.mode, elapsed: this.elapsed, total: this.total,
      remaining: Math.ceil(Math.max(0, testTime - this.elapsed) / 1000),
      pulseAt: this.pulseAt, pulseAge, lastReceipt, brakeAt: this.brakeAt, exitReason: this.exitReason
    };
  }
}

const fieldWidth = 360;
const fieldHeight = 640;
const cameraDistance = 1380;
const orbitRadius = 234;
const axleHeight = 20;
const handleSpan = 140;
// The Figma layout sets the frontal composition 52 px below the optical center.
const verticalFraming = 52;
const orbitPeriod = 3600;
const settlingTime = 940;
const resultFadeTime = 440;
const turn = 2 * Math.PI;
const startAngle = 0.18;
const angularSpeed = turn / orbitPeriod;
const clamp01 = value => Math.max(0, Math.min(1, value));
const lerp = (a, b, t) => a + (b - a) * t;

function easeBetween(start, end, time) {
  const t = clamp01((time - start) / (end - start));
  return t * t * (3 - 2 * t);
}

// Z runs from handle to handle, +X is body height, and +Y faces the camera.
// A forward turn travels overhead -> toward camera -> below -> away.
function ropePoint(u, phase) {
  const bend = Math.pow(Math.max(0, 1 - u * u), 0.76);
  const radius = orbitRadius * bend;
  const angle = phase - 0.28 * u * u;
  return [axleHeight + radius * Math.cos(angle), radius * Math.sin(angle), handleSpan * u];
}

function axisProjection(p) {
  const scale = cameraDistance / (cameraDistance - p[2]);
  return [fieldWidth / 2 + p[1] * scale, fieldHeight / 2 - p[0] * scale];
}

function frontProjection(p) {
  const scale = cameraDistance / (cameraDistance - p[1]);
  return [fieldWidth / 2 + p[2] * scale, fieldHeight / 2 + verticalFraming - p[0] * scale];
}

function stoppedAngle(elapsed, after) {
  const delay = Math.min(Math.max(0, after), settlingTime);
  const coast = delay * (1 - delay / (2 * settlingTime));
  return startAngle + angularSpeed * (elapsed + coast);
}

function brakeAgeAt(s, stageAge) {
  if (s.brakeAt == null) return 0;
  return s.elapsed - s.brakeAt + (s.stage === "stopped" || s.stage === "failed" ? stageAge : 0);
}

function receiptOptics(age) {
  return easeBetween(0, 128, age) * (1 - easeBetween(315, receiptWindow, age));
}

function receiptTextLevels(age, reduced) {
  if (reduced) return age < receiptWindow ? { steady: 0, receipt: 1 } : { steady: 1, receipt: 0 };
  return {
    steady: 1 - easeBetween(0, 66, age) * (1 - easeBetween(655, receiptWindow, age)),
    receipt: easeBetween(70, 168, age) * (1 - easeBetween(470, 652, age))
  };
}

function exposureAt(s, reduced, profile, stageAge) {
  const active = s.stage === "measuring";
  const coasting = ["confirming", "stopped", "failed", "result"].includes(s.stage);
  const marker = s.brakeAt ?? s.elapsed;
  const before = reduced ? 0 : receiptOptics(marker - (s.pulseAt ?? -Infinity));
  const braking = easeBetween(0, settlingTime, brakeAgeAt(s, stageAge));
  const releaseGain = lerp(0.67, 1, before) * easeBetween(0, 460, marker);
  const angle = reduced ? startAngle
    : coasting ? stoppedAngle(marker, brakeAgeAt(s, stageAge))
    : active ? startAngle + angularSpeed * s.elapsed : startAngle;
  const settledGain = s.stage === "result" ? lerp(0.27, 0.17, easeBetween(0, resultFadeTime, stageAge)) : 0.27;
  const gain = active ? (reduced ? 0.62 : releaseGain)
    : coasting ? (reduced ? settledGain : lerp(releaseGain, settledGain, braking)) : 0;
  const receipt = active || coasting ? before * (1 - braking) : 0;
  const separation = lerp(1, 0.46, braking);
  // Blend in the last overhead exposure while the brighter rope crosses the lower half.
  const pastCrown = ((angle % turn) + turn) % turn;
  const crownAge = pastCrown / angularSpeed;
  const crownEcho = reduced ? 0
    : 0.29 * gain * easeBetween(380, 950, crownAge) * (1 - easeBetween(2150, orbitPeriod, crownAge));
  return {
    angle, gain, exposure: receipt,
    crest: ropePoint(0, angle),
    traces: [
      { lag: pastCrown, width: 4.3, strength: crownEcho, tone: [0.62, 0.69, 0.79] },
      { lag: 0.63 * separation, width: 2.3, strength: gain * 0.12, tone: [0.48, 0.56, 0.69] },
      { lag: 0.39 * separation, width: 2.9, strength: gain * (0.18 + 0.065 * receipt), tone: [0.60, 0.67, 0.79] },
      { lag: 0.18 * separation, width: 3.7, strength: gain * (0.25 + 0.07 * receipt), tone: [0.69, 0.74, 0.86] },
      { lag: 0, width: 4.6, strength: gain * (0.86 + 0.14 * receipt) * profile.peakOpacity, tone: [0.94, 0.96, 0.98] }
    ],
    films: [
      { span: 0.63, strength: gain * (0.48 + 0.16 * receipt) * profile.veilOpacity * (1 - braking) }
    ]
  };
}

const foregroundGuard = [
  "float foregroundGuard(vec2 screen) {",
  "  float outer = abs(screen.x - 0.5);",
  "  float center = 1.0 - smoothstep(0.35, 0.47, outer);",
  "  float y = (1.0 - screen.y) * 640.0;",
  "  float heading = 0.43 * exp(-pow((y - 94.0) / 49.0, 2.0));",
  "  float readings = 0.59 * exp(-pow((y - 264.0) / 70.0, 2.0));",
  "  float status = 0.46 * exp(-pow((y - 354.0) / 32.0, 2.0));",
  "  return 1.0 - center * max(readings, max(heading, status));",
  "}"
].join("\n");

const traceVertex = [
  "attribute vec3 aPrevious;",
  "attribute vec3 aNext;",
  "uniform vec2 uViewport;",
  "uniform float uWidth;",
  "varying vec2 vFilm;",
  "varying vec2 vScreen;",
  "varying float vDistance;",
  "void main() {",
  "  mat4 view = projectionMatrix * modelViewMatrix;",
  "  vec4 clip = view * vec4(position, 1.0);",
  "  vec4 a = view * vec4(aPrevious, 1.0);",
  "  vec4 b = view * vec4(aNext, 1.0);",
  "  vec2 tangent = (b.xy / b.w - a.xy / a.w) * uViewport;",
  "  vec2 normal = normalize(vec2(-tangent.y, tangent.x));",
  "  float ends = pow(max(0.0, sin(3.14159265 * uv.x)), 0.24);",
  "  clip.xy += normal * (uv.y * 2.0 - 1.0) * uWidth * mix(0.37, 1.0, ends) * 2.0 * clip.w / uViewport;",
  "  vFilm = uv;",
  "  vDistance = (modelMatrix * vec4(position, 1.0)).y / 234.0;",
  "  vScreen = 0.5 + 0.5 * clip.xy / clip.w;",
  "  gl_Position = clip;",
  "}"
].join("\n");

const traceFragment = [
  "uniform float uEnergy;",
  "uniform vec3 uTone;",
  "varying vec2 vFilm;",
  "varying vec2 vScreen;",
  "varying float vDistance;",
  foregroundGuard,
  "void main() {",
  "  float ends = smoothstep(0.0, 0.21, vFilm.x) * (1.0 - smoothstep(0.79, 1.0, vFilm.x));",
  "  float crown = pow(max(0.0, sin(3.14159265 * vFilm.x)), 0.71);",
  "  float width = abs(vFilm.y - 0.5);",
  "  float edge = 0.86 * exp(-pow(width * 13.2, 2.0));",
  "  float halo = 0.14 * exp(-pow(width * 4.7, 2.0));",
  "  float nearness = smoothstep(-0.77, 0.81, vDistance);",
  "  float alpha = uEnergy * ends * mix(0.53, 1.0, crown) * mix(0.50, 1.0, nearness) * (edge + halo);",
  "  vec3 tone = mix(uTone * vec3(0.65, 0.76, 0.90), uTone, nearness);",
  "  gl_FragColor = vec4(tone, alpha * foregroundGuard(vScreen));",
  "}"
].join("\n");

const filmVertex = [
  "varying vec2 vUv;",
  "varying vec2 vScreen;",
  "varying float vDistance;",
  "void main() {",
  "  vUv = uv;",
  "  vDistance = (modelMatrix * vec4(position, 1.0)).y / 234.0;",
  "  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);",
  "  vScreen = 0.5 + 0.5 * gl_Position.xy / gl_Position.w;",
  "}"
].join("\n");

const filmFragment = [
  "uniform float uEnergy;",
  "varying vec2 vUv;",
  "varying vec2 vScreen;",
  "varying float vDistance;",
  foregroundGuard,
  "void main() {",
  "  float ends = smoothstep(0.05, 0.25, vUv.x) * (1.0 - smoothstep(0.75, 0.95, vUv.x));",
  "  float shutter = smoothstep(0.0, 0.09, vUv.y) * pow(1.0 - vUv.y, 1.64);",
  "  float silver = smoothstep(-0.70, 0.84, vDistance);",
  "  vec3 tint = mix(vec3(0.27, 0.35, 0.49), vec3(0.68, 0.73, 0.82), silver);",
  "  gl_FragColor = vec4(tint, uEnergy * ends * shutter * (0.46 + 0.54 * silver) * foregroundGuard(vScreen));",
  "}"
].join("\n");

const roomVertex = "varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }";
const roomFragment = [
  "uniform float uCrest;",
  "uniform float uNear;",
  "uniform float uEnergy;",
  "varying vec2 vUv;",
  "void main() {",
  "  vec2 p = (vUv - vec2(0.5, uCrest)) / vec2(0.55, 0.235);",
  "  float glow = exp(-dot(p, p));",
  "  float low = exp(-pow((vUv.y - uCrest) / 0.43, 2.0));",
  "  float edge = smoothstep(0.0, 0.21, min(vUv.y, 1.0 - vUv.y));",
  "  float level = uEnergy * (0.024 + low * 0.039 + glow * mix(0.077, 0.136, uNear)) * mix(0.54, 1.0, edge);",
  "  vec3 tone = mix(vec3(0.23, 0.27, 0.37), vec3(0.48, 0.52, 0.60), 0.59 * uNear);",
  "  gl_FragColor = vec4(tone, level);",
  "}"
].join("\n");

function localRopePoint(u, angle) {
  const [x, y, z] = ropePoint(u, angle);
  return [x - axleHeight, y, z];
}

function traceGeometry(THREE) {
  const segments = 180;
  const positions = [], previous = [], next = [], coordinates = [], indices = [];
  const point = i => localRopePoint(-1 + 2 * i / segments, 0);
  for (let i = 0; i <= segments; i++) {
    const p = point(i);
    const a = point(Math.max(0, i - 1));
    const b = point(Math.min(segments, i + 1));
    positions.push(...p, ...p);
    previous.push(...a, ...a);
    next.push(...b, ...b);
    coordinates.push(i / segments, 0, i / segments, 1);
    if (i < segments) {
      const n = 2 * i;
      indices.push(n, n + 1, n + 2, n + 2, n + 1, n + 3);
    }
  }
  const mesh = new THREE.BufferGeometry();
  mesh.setIndex(indices);
  mesh.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  mesh.setAttribute("aPrevious", new THREE.Float32BufferAttribute(previous, 3));
  mesh.setAttribute("aNext", new THREE.Float32BufferAttribute(next, 3));
  mesh.setAttribute("uv", new THREE.Float32BufferAttribute(coordinates, 2));
  return mesh;
}

function filmGeometry(THREE, span) {
  const columns = 144;
  const rows = 16;
  const positions = [], coordinates = [], indices = [];
  for (let i = 0; i <= columns; i++) {
    const t = i / columns;
    for (let j = 0; j <= rows; j++) {
      const s = j / rows;
      positions.push(...localRopePoint(-1 + 2 * t, -span * s));
      coordinates.push(t, s);
      if (i < columns && j < rows) {
        const n = i * (rows + 1) + j;
        const b = n + rows + 1;
        indices.push(n, n + 1, b, b, n + 1, b + 1);
      }
    }
  }
  const mesh = new THREE.BufferGeometry();
  mesh.setIndex(indices);
  mesh.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  mesh.setAttribute("uv", new THREE.Float32BufferAttribute(coordinates, 2));
  return mesh;
}

function buildThreeField(canvas, THREE) {
  const context = canvas.getContext("webgl2", {
    depth: false, stencil: false, alpha: true, antialias: true, preserveDrawingBuffer: true
  });
  if (!context) throw new Error("WebGL2 unavailable");
  const renderer = new THREE.WebGLRenderer({ canvas, context, alpha: true });
  renderer.setClearColor(0, 0);
  renderer.setPixelRatio(Math.min(Math.max(devicePixelRatio, 1.5), 2));
  renderer.setSize(fieldWidth, fieldHeight, false);
  renderer.toneMapping = THREE.NoToneMapping;

  const scene = new THREE.Scene();
  const fov = 2 * Math.atan((fieldHeight / 2) / cameraDistance) * 180 / Math.PI;
  const camera = new THREE.PerspectiveCamera(fov, fieldWidth / fieldHeight, 0.1, 2400);
  camera.position.set(0, cameraDistance, 0);
  camera.up.set(1, 0, 0);
  camera.lookAt(0, 0, 0);
  camera.setViewOffset(fieldWidth, fieldHeight, 0, -verticalFraming, fieldWidth, fieldHeight);

  const room = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
    vertexShader: roomVertex, fragmentShader: roomFragment, transparent: true, depthWrite: false, depthTest: false,
    uniforms: { uCrest: { value: 0.5 }, uNear: { value: 0.5 }, uEnergy: { value: 0 } }
  }));
  room.renderOrder = 0;
  room.frustumCulled = false;
  scene.add(room);

  function addExposure(mesh, vertexShader, fragmentShader, uniforms, order) {
    const material = new THREE.ShaderMaterial({
      vertexShader, fragmentShader, uniforms, transparent: true, depthTest: false, depthWrite: false, side: THREE.DoubleSide
    });
    const object = new THREE.Mesh(mesh, material);
    object.position.x = axleHeight;
    object.renderOrder = order;
    object.frustumCulled = false;
    scene.add(object);
    return object;
  }

  const look = exposureAt({ stage: "ready", elapsed: 0, pulseAge: Infinity }, false, { peakOpacity: 1, veilOpacity: 1 }, 0);
  const veils = look.films.map((entry, i) => addExposure(filmGeometry(THREE, entry.span), filmVertex, filmFragment,
    { uEnergy: { value: 0 } }, 1 + i));
  const shared = traceGeometry(THREE);
  const traces = look.traces.map((spec, i) => addExposure(shared, traceVertex, traceFragment, {
    uWidth: { value: spec.width }, uEnergy: { value: 0 }, uViewport: { value: new THREE.Vector2(fieldWidth, fieldHeight) },
    uTone: { value: new THREE.Vector3(...spec.tone) }
  }, 2 + i));

  function place(mesh, angle, amount) {
    mesh.visible = amount > 0.001;
    mesh.rotation.z = angle % turn;
    mesh.material.uniforms.uEnergy.value = amount;
  }
  return {
    type: "three",
    label: "Three.js r" + THREE.REVISION + " · WebGL2",
    canvas,
    dispose() {
      scene.traverse(mesh => { mesh.geometry?.dispose(); mesh.material?.dispose(); });
      renderer.dispose();
    },
    draw(frame) {
      room.material.uniforms.uCrest.value = 1 - frontProjection(frame.crest)[1] / fieldHeight;
      room.material.uniforms.uNear.value = 0.5 + 0.5 * frame.crest[1] / orbitRadius;
      room.material.uniforms.uEnergy.value = frame.gain;
      veils.forEach((mesh, i) => place(mesh, frame.angle, frame.films[i].strength));
      traces.forEach((mesh, i) => place(mesh, frame.angle - frame.traces[i].lag, frame.traces[i].strength));
      renderer.render(scene, camera);
    }
  };
}

function buildCanvasField(canvas) {
  const scale = Math.min(Math.max(devicePixelRatio, 1.5), 2);
  canvas.width = fieldWidth * scale;
  canvas.height = fieldHeight * scale;
  const ctx = canvas.getContext("2d");
  const points = phase => Array.from({ length: 145 }, (_, i) => frontProjection(ropePoint(-1 + 2 * i / 144, phase)));
  return {
    type: "canvas",
    label: "Canvas 2D · 兼容模式",
    canvas,
    draw(frame) {
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      ctx.clearRect(0, 0, fieldWidth, fieldHeight);
      if (frame.gain === 0) return;
      const [center, crest] = frontProjection(frame.crest);
      const atmosphere = ctx.createRadialGradient(center, crest, 18, center, crest, 330);
      atmosphere.addColorStop(0, "rgba(111,125,151," + frame.gain * 0.12 + ")");
      atmosphere.addColorStop(1, "rgba(34,39,54,0)");
      ctx.fillStyle = atmosphere;
      ctx.fillRect(0, 0, fieldWidth, fieldHeight);

      for (const spec of frame.films) {
        const front = points(frame.angle);
        const back = points(frame.angle - spec.span).reverse();
        const gradient = ctx.createLinearGradient(38, 0, 322, 0);
        gradient.addColorStop(0, "rgba(128,148,177,0)");
        gradient.addColorStop(0.5, "rgba(128,148,177," + spec.strength * 0.65 + ")");
        gradient.addColorStop(1, "rgba(128,148,177,0)");
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.moveTo(...front[0]);
        for (const point of [...front.slice(1), ...back]) ctx.lineTo(...point);
        ctx.closePath();
        ctx.fill();
      }
      for (const spec of frame.traces) {
        const phase = frame.angle - spec.lag;
        const line = points(phase);
        const rgb = spec.tone.map(v => Math.round(v * 255)).join(",");
        const close = 0.51 + 0.49 * (0.5 + 0.5 * Math.sin(phase));
        const dim = Math.exp(-Math.pow((crest - 322) / 54, 2)) * 0.47;
        const light = spec.strength * close * (1 - dim);
        const ink = ctx.createLinearGradient(line[0][0], 0, line.at(-1)[0], 0);
        const shade = alpha => "rgba(" + rgb + "," + light * alpha + ")";
        ink.addColorStop(0, shade(0));
        ink.addColorStop(0.18, shade(0.55));
        ink.addColorStop(0.5, shade(1));
        ink.addColorStop(0.82, shade(0.55));
        ink.addColorStop(1, shade(0));
        ctx.strokeStyle = ink;
        ctx.lineWidth = spec.width * 0.48;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(...line[0]);
        for (const point of line.slice(1)) ctx.lineTo(...point);
        ctx.stroke();
      }
    }
  };
}

export {RopeSession, testTime, resultDelay, exposureAt, buildThreeField, buildCanvasField};
export const opticalProfile={
  "crestY": 191,
  "crestLuma": 216.96,
  "innerLuma": 42.52,
  "peakOpacity": 0.9271783119658119,
  "veilOpacity": 0.23489396032144652
};
