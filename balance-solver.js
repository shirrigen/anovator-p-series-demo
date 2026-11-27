// BAL-28 tank solver, shared by the worker and the fallback renderer.

export function createLocalTank(postMessage) {
let onmessage;
"use strict";

// 3-D PIC/FLIP in a closed sphere with an air-pressure free surface.
// The translating grid stays aligned with gravity. In a smooth sphere a change
// of shell orientation alone cannot rotate the bulk of the liquid.
const waterline = -.148;
const liquidRadius = .976;
const profileSize = 33;
const radiusMeters = .16;
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

class SphericalFlow {
  constructor() {
    this.n = 22;
    this.m = this.n + 1;
    this.m2 = this.m * this.m;
    this.c = this.n / 2;
    this.r = this.c - 1.04;
    this.wall = this.r - .25;
    const cells = this.n ** 3;
    const faces = this.m ** 3;
    this.solid = new Uint8Array(cells);
    this.count = new Uint16Array(cells);
    this.density = new Float32Array(cells);
    this.wet = new Int32Array(cells);
    this.faceId = new Int32Array(cells);
    this.u = new Float32Array(faces);
    this.v = new Float32Array(faces);
    this.w = new Float32Array(faces);
    this.oldU = new Float32Array(faces);
    this.oldV = new Float32Array(faces);
    this.oldW = new Float32Array(faces);
    this.weightU = new Float32Array(faces);
    this.weightV = new Float32Array(faces);
    this.weightW = new Float32Array(faces);
    this.openU = new Uint8Array(faces);
    this.openV = new Uint8Array(faces);
    this.openW = new Uint8Array(faces);
    this.top = new Float32Array(this.n * this.n);
    this.surfaceSamples = new Float32Array(profileSize * profileSize);
    this.markWalls();

    const seed = [];
    const floor = this.c + this.r * waterline / liquidRadius;
    for (let z = 1.29; z < this.n - 1; z += .65) {
      for (let y = 1.24; y <= floor; y += .65) {
        for (let x = 1.34; x < this.n - 1; x += .65) {
          if ((x - this.c) ** 2 + (y - this.c) ** 2 + (z - this.c) ** 2 > this.wall ** 2) continue;
          seed.push(
            x + .04 * Math.sin(71.9 * x + 58.3 * y + 33.2 * z),
            y + .035 * Math.sin(43.2 * x - 19.3 * y + 78.1 * z),
            z + .04 * Math.cos(28.3 * x + 17.4 * y - 65.4 * z),
          );
        }
      }
    }
    this.rest = Float32Array.from(seed);
    this.p = new Float32Array(this.rest.length);
    this.vel = new Float32Array(this.rest.length);
    this.reset();
  }

  markWalls() {
    const { n, c, r, m, m2 } = this;
    const rowSize = n * n;
    for (let k = 0; k < n; k++) for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const q = k * rowSize + j * n + i;
      this.solid[q] = (i + .5 - c) ** 2 + (j + .5 - c) ** 2 + (k + .5 - c) ** 2 >= r * r;
      this.faceId[q] = k * m2 + j * m + i;
    }
    for (let k = 0; k < n; k++) for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const q = k * rowSize + j * n + i;
      const f = this.faceId[q];
      if (this.solid[q]) continue;
      if (i && !this.solid[q - 1]) this.openU[f] = 1;
      if (j && !this.solid[q - n]) this.openV[f] = 1;
      if (k && !this.solid[q - rowSize]) this.openW[f] = 1;
    }
  }

  markWater() {
    const { count, wet, density, p, n } = this;
    count.fill(0);
    density.fill(0);
    for (let s = 0; s < p.length; s += 3) {
      const x = p[s], y = p[s + 1], z = p[s + 2];
      count[(Math.floor(z) * n + Math.floor(y)) * n + Math.floor(x)]++;
      const i = Math.floor(x - .5), j = Math.floor(y - .5), k = Math.floor(z - .5);
      const fx = x - .5 - i, fy = y - .5 - j, fz = z - .5 - k;
      for (let dz = 0; dz < 2; dz++) for (let dy = 0; dy < 2; dy++) {
        const w = (dz ? fz : 1 - fz) * (dy ? fy : 1 - fy);
        const f = ((k + dz) * n + j + dy) * n + i;
        density[f] += w * (1 - fx);
        density[f + 1] += w * fx;
      }
    }
    this.numWet = 0;
    for (let q = 0; q < count.length; q++) if (count[q] && !this.solid[q]) wet[this.numWet++] = q;
  }

  reset() {
    this.p.set(this.rest);
    this.vel.fill(0);
    this.energy = 0;
    this.markWater();
  }

  deposit(field, weights, open, x, y, z, value) {
    const i = Math.floor(x), j = Math.floor(y), k = Math.floor(z);
    const fx = x - i, fy = y - j, fz = z - k;
    const first = k * this.m2 + j * this.m + i;
    for (let iz = 0; iz < 2; iz++) {
      const depth = iz ? fz : 1 - fz;
      for (let iy = 0; iy < 2; iy++) {
        const f = first + iz * this.m2 + iy * this.m;
        const weight = depth * (iy ? fy : 1 - fy);
        if (open[f]) {
          const w = weight * (1 - fx);
          weights[f] += w;
          field[f] += w * value;
        }
        if (open[f + 1]) {
          const w = weight * fx;
          weights[f + 1] += w;
          field[f + 1] += w * value;
        }
      }
    }
  }

  sample(field, x, y, z) {
    x = clamp(x, 0, this.n - .001);
    y = clamp(y, 0, this.n - .001);
    z = clamp(z, 0, this.n - .001);
    const i = Math.floor(x), j = Math.floor(y), k = Math.floor(z);
    const fx = x - i, fy = y - j, fz = z - k;
    const a = k * this.m2 + j * this.m + i;
    const b = a + this.m;
    const c = a + this.m2;
    const d = c + this.m;
    const p = field[a] + (field[a + 1] - field[a]) * fx;
    const q = field[b] + (field[b + 1] - field[b]) * fx;
    const r = field[c] + (field[c + 1] - field[c]) * fx;
    const s = field[d] + (field[d + 1] - field[d]) * fx;
    const near = p + (q - p) * fy;
    return near + (r + (s - r) * fy - near) * fz;
  }

  transfer(dt, accelX, accelY, accelZ, retention) {
    const { p, vel, u, v, w, weightU, weightV, weightW, openU, openV, openW } = this;
    u.fill(0); v.fill(0); w.fill(0);
    weightU.fill(0); weightV.fill(0); weightW.fill(0);
    for (let k = 0; k < p.length; k += 3) {
      const x = p[k], y = p[k + 1], z = p[k + 2];
      vel[k] *= retention;
      vel[k + 1] *= retention;
      vel[k + 2] *= retention;
      this.deposit(u, weightU, openU, x, y - .5, z - .5, vel[k]);
      this.deposit(v, weightV, openV, x - .5, y, z - .5, vel[k + 1]);
      this.deposit(w, weightW, openW, x - .5, y - .5, z, vel[k + 2]);
    }
    for (let f = 0; f < u.length; f++) {
      if (weightU[f] > .0001) u[f] /= weightU[f];
      if (weightV[f] > .0001) v[f] /= weightV[f];
      if (weightW[f] > .0001) w[f] /= weightW[f];
    }
    this.oldU.set(u); this.oldV.set(v); this.oldW.set(w);
    // Apply body forces to the grid after saving the pre-force velocity.
    // The FLIP increment then includes the projected force at the boundary.
    for (let f = 0; f < u.length; f++) {
      if (openU[f] && weightU[f] > .0001) u[f] += accelX * dt;
      if (openV[f] && weightV[f] > .0001) v[f] += accelY * dt;
      if (openW[f] && weightW[f] > .0001) w[f] += accelZ * dt;
    }
  }

  project(dt) {
    const { u, v, w, openU, openV, openW, wet, numWet, density, faceId, m, m2 } = this;
    for (let step = 0; step < 30; step++) {
      const reverse = step % 2;
      for (let i = 0; i < numWet; i++) {
        const c = wet[reverse ? numWet - i - 1 : i];
        const f = faceId[c];
        const x = f + 1, y = f + m, z = f + m2;
        const faces = openU[f] + openU[x] + openV[f] + openV[y] + openW[f] + openW[z];
        if (!faces) continue;
        const divergence = u[x] - u[f] + v[y] - v[f] + w[z] - w[f];
        const crowding = .30 / dt * clamp(density[c] / 3.74 - 1, 0, 1.2);
        const correction = 1.66 * (divergence - crowding) / faces;
        u[f] += correction * openU[f]; u[x] -= correction * openU[x];
        v[f] += correction * openV[f]; v[y] -= correction * openV[y];
        w[f] += correction * openW[f]; w[z] -= correction * openW[z];
      }
    }
  }

  advance(dt, accelX, accelY, accelZ, retention) {
    this.transfer(dt, accelX, accelY, accelZ, retention);
    this.project(dt);
    const { p, vel, u, v, w, oldU, oldV, oldW, c, wall } = this;
    let kinetic = 0;
    for (let k = 0; k < p.length; k += 3) {
      const x = p[k], y = p[k + 1], z = p[k + 2];
      const ax = this.sample(u, x, y - .5, z - .5);
      const ay = this.sample(v, x - .5, y, z - .5);
      const az = this.sample(w, x - .5, y - .5, z);
      const flip = .94;
      let vx = ax + flip * (vel[k] - this.sample(oldU, x, y - .5, z - .5));
      let vy = ay + flip * (vel[k + 1] - this.sample(oldV, x - .5, y, z - .5));
      let vz = az + flip * (vel[k + 2] - this.sample(oldW, x - .5, y - .5, z));
      const t = Math.max(1, Math.hypot(vx, vy, vz) / 80);
      vx /= t; vy /= t; vz /= t;
      const mx = x + .5 * dt * ax;
      const my = y + .5 * dt * ay;
      const mz = z + .5 * dt * az;
      let px = x + dt * (.72 * this.sample(u, mx, my - .5, mz - .5) + .28 * vx) - c;
      let py = y + dt * (.72 * this.sample(v, mx - .5, my, mz - .5) + .28 * vy) - c;
      let pz = z + dt * (.72 * this.sample(w, mx - .5, my - .5, mz) + .28 * vz) - c;
      const dist = Math.hypot(px, py, pz);
      if (dist > wall) {
        const nx = px / dist, ny = py / dist, nz = pz / dist;
        const flux = Math.max(0, nx * vx + ny * vy + nz * vz);
        vx = .996 * (vx - flux * nx);
        vy = .996 * (vy - flux * ny);
        vz = .996 * (vz - flux * nz);
        px = nx * wall;
        py = ny * wall;
        pz = nz * wall;
      }
      p[k] = c + px;
      p[k + 1] = c + py;
      p[k + 2] = c + pz;
      vel[k] = vx; vel[k + 1] = vy; vel[k + 2] = vz;
      kinetic += vx * vx + vy * vy + vz * vz;
    }
    this.energy = Math.sqrt(kinetic * 3 / p.length);
    this.markWater();
  }

  reconstruct(height) {
    const { n, p, top, c, r, surfaceSamples } = this;
    top.fill(-Infinity);
    for (let k = 0; k < p.length; k += 3) {
      const x = Math.floor(p[k]), z = Math.floor(p[k + 2]);
      const slot = z * n + x;
      top[slot] = Math.max(top[slot], p[k + 1]);
    }
    const ratio = liquidRadius / r;
    const last = profileSize - 1;
    for (let z = 0; z < profileSize; z++) {
      for (let x = 0; x < profileSize; x++) {
        const tx = x / last * 2 - 1;
        const tz = z / last * 2 - 1;
        const bound = Math.max(1, Math.hypot(tx, tz) / .984);
        const gx = c + r * tx / bound;
        const gz = c + r * tz / bound;
        let value = 0, total = 0;
        const i = Math.floor(gx), k = Math.floor(gz);
        for (let iz = Math.max(0, k - 2); iz <= Math.min(n - 1, k + 2); iz++) {
          for (let ix = Math.max(0, i - 2); ix <= Math.min(n - 1, i + 2); ix++) {
            const sample = top[iz * n + ix];
            if (!Number.isFinite(sample)) continue;
            const dx = gx - ix - .5, dz = gz - iz - .5;
            const weight = 1 / (1 + (dx * dx + dz * dz) * .48) ** 2;
            value += sample * weight;
            total += weight;
          }
        }
        const level = total ? ((value / total + .19) - c) * ratio : waterline;
        const q = z * profileSize + x;
        surfaceSamples[q] = clamp(level, -.81, .64);
      }
    }
    // A small surface filter removes the cell-scale noise of the marker envelope.
    for (let z = 0; z < profileSize; z++) for (let x = 0; x < profileSize; x++) {
      const q = z * profileSize + x;
      const up = Math.max(z - 1, 0) * profileSize + x;
      const down = Math.min(z + 1, last) * profileSize + x;
      const left = z * profileSize + Math.max(x - 1, 0);
      const right = z * profileSize + Math.min(x + 1, last);
      const smooth = .44 * surfaceSamples[q] + .14 * (surfaceSamples[up] + surfaceSamples[down] + surfaceSamples[left] + surfaceSamples[right]);
      const restBias = this.restSurface ? this.restSurface[q] - waterline : 0;
      height[q] += (smooth - restBias - height[q]) * .86;
    }
  }

  visibleParticles() {
    const sample = new Float32Array(Math.ceil(this.p.length / 6) * 3);
    const factor = liquidRadius / this.r;
    for (let i = 0, j = 0; i < this.p.length; i += 6, j += 3) {
      sample[j] = (this.p[i] - this.c) * factor;
      sample[j + 1] = (this.p[i + 1] - this.c) * factor;
      sample[j + 2] = (this.p[i + 2] - this.c) * factor;
    }
    return sample;
  }
}

const sim = new SphericalFlow();
const fixedStep = 1 / 75;
const gravity = 9.81 * sim.r / radiusMeters;
// Relax the marker packing once. Subtract its stationary sampling bias from
// each column so waking an idle tank does not create a false surface ripple.
for (let i = 0; i < 44; i++) sim.advance(fixedStep, 0, -gravity, 0, .82);
sim.rest.set(sim.p);
sim.reset();
const referenceSurface = new Float32Array(profileSize ** 2).fill(waterline);
for (let i = 0; i < 8; i++) sim.reconstruct(referenceSurface);
sim.restSurface = referenceSurface;
const height = new Float32Array(profileSize * profileSize).fill(waterline);
const equilibrium = height.slice();
const max = profileSize - 1;
const coordinates = Float32Array.from({ length: profileSize }, (_, i) => liquidRadius * (2 * i / max - 1));
const halfDepth = new Float32Array(height.length);
let quiet = true;
let epoch = 0;
let impulse = 0;
let impulseAge = 0;
let age = 0;
let previous = 0;
let accumulator = 0;
let timer = 0;
let settling = 0;
let restartSurface = null, restartTime = 0;
const lastSurface = height.slice();
let paused = false;
let flowRate = 1;
let damping = 1;
let roll = 0, pitch = 0, targetRoll = 0, targetPitch = 0;
let rollSpeed = 0, pitchSpeed = 0;
let centerVX = 0, centerVY = 0, centerVZ = 0;
let upX = 0, upY = 1, upZ = 0;

for (let z = 0; z < profileSize; z++) for (let x = 0; x < profileSize; x++) {
  halfDepth[z * profileSize + x] = Math.sqrt(Math.max(0, liquidRadius ** 2 - coordinates[x] ** 2 - coordinates[z] ** 2));
}

function volumeAt(mesh, offset) {
  let volume = 0;
  let area = 0;
  for (let i = 0; i < mesh.length; i++) {
    const depth = halfDepth[i];
    if (!depth) continue;
    const level = mesh[i] + offset;
    volume += clamp(level, -depth, depth) + depth;
    if (Math.abs(level) < depth) area++;
  }
  return [volume, area];
}

const nominalVolume = volumeAt(height, 0)[0];

function updateUp() {
  const cp = Math.cos(pitch);
  upX = -Math.sin(roll) * cp;
  upY = Math.cos(roll) * cp;
  upZ = -Math.sin(pitch);
}

// The review camera tracks the centre. A hand tilt describes a short arc about
// a support below it; only the acceleration of that arc drives the water.
function advancePose(dt, force, retention) {
  const response = 24;
  const decay = Math.exp(-response * dt);
  const rollError = roll - targetRoll, pitchError = pitch - targetPitch;
  const rollC = rollSpeed + response * rollError, pitchC = pitchSpeed + response * pitchError;
  roll = targetRoll + (rollError + rollC * dt) * decay;
  pitch = targetPitch + (pitchError + pitchC * dt) * decay;
  rollSpeed = (rollSpeed - response * rollC * dt) * decay;
  pitchSpeed = (pitchSpeed - response * pitchC * dt) * decay;
  const sr = Math.sin(roll), cr = Math.cos(roll), sp = Math.sin(pitch), cp = Math.cos(pitch);
  const lever = .69 * sim.r;
  const vx = lever * cr * rollSpeed;
  const vy = lever * (-sr * cp * rollSpeed - cr * sp * pitchSpeed);
  const vz = lever * (-sr * sp * rollSpeed + cr * cp * pitchSpeed);
  sim.advance(dt, force - (vx - centerVX) / dt, -gravity - (vy - centerVY) / dt,
    -(vz - centerVZ) / dt, retention);
  centerVX = vx; centerVY = vy; centerVZ = vz;
}

function constrainedMesh(settleAmount) {
  const mesh = Float32Array.from(height, (y, i) => y + (equilibrium[i] - y) * settleAmount);
  let offset = 0;
  for (let n = 0; n < 4; n++) {
    const [volume, area] = volumeAt(mesh, offset);
    offset += (nominalVolume - volume) / Math.max(1, area);
  }
  if (offset) for (let i = 0; i < mesh.length; i++) mesh[i] += offset;
  return mesh;
}

function statistics(mesh) {
  let low = Infinity, high = -Infinity;
  let residualMin = Infinity, residualMax = -Infinity;
  for (let z = 0; z < profileSize; z++) for (let x = 0; x < profileSize; x++) {
    if (coordinates[x] ** 2 + coordinates[z] ** 2 > .53) continue;
    const h = mesh[z * profileSize + x];
    const difference = h - equilibrium[z * profileSize + x];
    low = Math.min(low, h);
    high = Math.max(high, h);
    residualMin = Math.min(residualMin, difference);
    residualMax = Math.max(residualMax, difference);
  }
  return { spread: high - low, residual: residualMax - residualMin, velocity: sim.energy, fill: volumeAt(mesh, 0)[0] / nominalVolume };
}

function send(mesh) {
  lastSurface.set(mesh);
  const stats = statistics(mesh);
  const grains = sim.visibleParticles();
  postMessage({
    epoch, mesh, grains, stats, quiet, count: sim.p.length / 3,
    roll, pitch, up: [upX, upY, upZ],
  }, [mesh.buffer, grains.buffer]);
}

function stableFrame() {
  quiet = true;
  settling = 0;
  restartSurface = null;
  impulse = 0;
  roll = targetRoll;
  pitch = targetPitch;
  rollSpeed = pitchSpeed = centerVX = centerVY = centerVZ = 0;
  updateUp();
  sim.reset();
  height.set(equilibrium);
  send(height.slice());
}

function step() {
  timer = 0;
  if (paused) return;
  const now = performance.now();
  const delta = (previous ? clamp((now - previous) / 1000, 0, .065) : 1 / 60) * flowRate;
  previous = now;
  accumulator += delta;
  const dt = fixedStep;
  const retention = Math.exp(-.58 * damping * dt);
  while (accumulator >= dt) {
    age += dt;
    impulseAge += dt;
    const progress = impulseAge / .54;
    const force = progress < 1 ? impulse * 160 * Math.sin(progress * Math.PI) : 0;
    advancePose(dt, force, retention);
    if (restartSurface) restartTime += dt;
    accumulator -= dt;
  }

  updateUp();
  sim.reconstruct(height);
  const mesh = constrainedMesh(0);
  const stats = statistics(mesh);
  const turning = Math.hypot(targetRoll - roll, targetPitch - pitch) > .002;
  const timeScale = Math.pow(damping, -.65);
  const lowEnergy = age > 1.45 * timeScale && stats.residual < .09 && stats.velocity < 6;
  if (!turning && (settling > 0 || lowEnergy)) settling += delta;
  const ease = clamp(settling / (.61 * timeScale), 0, 1);
  if (ease === 1) {
    previous = 0;
    accumulator = 0;
    stableFrame();
    return;
  }
  const output = ease ? constrainedMesh(ease * ease * (3 - 2 * ease)) : mesh;
  if (restartSurface) {
    const t = clamp(restartTime / .13, 0, 1);
    const weight = t * t * (3 - 2 * t);
    for (let i = 0; i < output.length; i++) output[i] = restartSurface[i] + (output[i] - restartSurface[i]) * weight;
    if (t === 1) restartSurface = null;
  }
  send(output);
  timer = setTimeout(step, Math.max(0, 21 - (performance.now() - now)));
}

function wake() {
  if (settling > 0) {
    restartSurface = lastSurface.slice();
    restartTime = 0;
  }
  quiet = false;
  age = 0;
  settling = 0;
  if (!paused && !timer) timer = setTimeout(step, 0);
}

onmessage = ({ data }) => {
  if (data.type === "reset") {
    clearTimeout(timer);
    timer = 0;
    epoch = data.epoch;
    previous = 0;
    accumulator = 0;
    paused = false;
    targetRoll = 0;
    targetPitch = 0;
    stableFrame();
    return;
  }
  if (data.epoch !== epoch) return;
  if (data.type === "tune") {
    flowRate = clamp(data.rate, .5, 1.4);
    damping = clamp(data.damping, .65, 1.75);
    return;
  }
  if (data.type === "pause") {
    paused = data.value;
    clearTimeout(timer);
    timer = 0;
    previous = 0;
    if (!paused && !quiet) timer = setTimeout(step, 0);
    return;
  }
  if (data.type === "turn") {
    // The height field can follow a tilted plane through this bounded range.
    const angleLimit = Math.PI * 27 / 180;
    const scale = Math.min(1, angleLimit / Math.max(.00001, Math.hypot(data.roll, data.pitch)));
    const nextRoll = data.roll * scale, nextPitch = data.pitch * scale;
    if (Math.hypot(nextRoll - targetRoll, nextPitch - targetPitch) < .0004) return;
    targetRoll = nextRoll;
    targetPitch = nextPitch;
    impulse = 0;
    wake();
    return;
  }
  if (data.type === "release") {
    impulse = 0;
    return;
  }
  if (data.type === "push") {
    impulse = clamp(data.value, -1, 1);
    impulseAge = 0;
    wake();
  }
};

return data => onmessage({data});
}
