// BAL-28 vessel and solver from the water-flow review, with host-relative assets and disposal.
"use strict";

const fluidLine = -.148;
const fluidRadius = .976;
const heightSize = 33;
const clampFluid = (value, lower, upper) => Math.min(upper, Math.max(lower, value));

const glassFragment = `
  out vec4 pixel;
  #define gl_FragColor pixel
  #include <common>

  uniform sampler2D heightField;
  uniform highp sampler3D paintDisplacement;
  uniform vec3 cameraOrigin;
  uniform vec2 projection;
  uniform mat3 tankFromWorld;
  uniform vec3 planeNormal;
  uniform bool atRest;
  uniform bool clearWater;
  in vec2 screenUV;

  const float glassIOR = 1.515;
  const float paintIOR = 1.46;
  const float waterIOR = 1.333;
  const float restLevel = ${fluidLine};
  const float insideRadius = ${fluidRadius};
  const vec3 pigment = vec3(.70, .482, .268);

  vec2 sphereSegment(vec3 origin, vec3 dir, float radius) {
    float mid = -dot(origin, dir);
    float square = radius * radius - dot(origin, origin) + mid * mid;
    if (square < 0.) return vec2(-1.);
    float halfLength = sqrt(square);
    return vec2(mid - halfLength, mid + halfLength);
  }

  float dielectric(float cosine, float ratio) {
    cosine = clamp(cosine, 0., 1.);
    float sine2 = (1. - cosine * cosine) / (ratio * ratio);
    if (sine2 >= 1.) return 1.;
    float transmitted = sqrt(1. - sine2);
    float parallel = (ratio * cosine - transmitted) / (ratio * cosine + transmitted);
    float across = (cosine - ratio * transmitted) / (cosine + ratio * transmitted);
    return .5 * (parallel * parallel + across * across);
  }

  float softbox(vec3 ray, vec3 axis, vec2 size, float soft) {
    axis = normalize(axis);
    float facing = dot(ray, axis);
    vec3 side = normalize(cross(vec3(0., 1., 0.), axis));
    vec3 up = cross(axis, side);
    vec2 uv = abs(vec2(dot(ray, side), dot(ray, up)) / max(.15, facing));
    vec2 coverage = 1. - smoothstep(size * .12, size * 1.44 + soft, uv);
    float spread = size.x * size.y / ((size.x + soft) * (size.y + soft));
    return coverage.x * coverage.y * spread * smoothstep(.08, .46, facing);
  }

  vec3 studio(vec3 ray, float soft) {
    // Long diffusion panels and their fill cards, evaluated in linear light.
    ray = transpose(tankFromWorld) * ray;
    float key = softbox(ray, vec3(-.68, .61, -.59), vec2(.83, .082), soft);
    float edge = softbox(ray, vec3(.85, .34, -.77), vec2(.045, .48), soft);
    float back = softbox(ray, vec3(-.21, .106, -1.), vec2(.74, .074), soft);
    float kick = softbox(ray, vec3(.12, -.54, -.88), vec2(.62, .078), soft);
    float fill = softbox(ray, vec3(-.28, .38, 1.), vec2(.91, .73), soft);
    return vec3(.007, .009, .012)
      + key * vec3(10.4, 10.05, 9.6) + edge * vec3(1.2, 1.37, 1.57)
      + back * vec3(.39, .32, .24) + kick * vec3(.73, .64, .49)
      + fill * vec3(.26, .28, .31);
  }

  vec3 surfaceStrip(vec3 point, vec3 ray) {
    // A finite strip box reflected by the liquid. A flat surface still shows the panel's falloff.
    point = transpose(tankFromWorld) * point;
    ray = transpose(tankFromWorld) * ray;
    float distance = (-2.85 - point.z) / min(-.04, ray.z);
    vec2 panel = (point + ray * distance).xy;
    float horizontal = 1. - smoothstep(.12, 1.57, abs(panel.x + .34));
    float hotspot = 1. - smoothstep(.006, .049, abs(panel.y - .078));
    float softEdge = smoothstep(.17, .58, -ray.z);
    return vec3(1.76, 1.39, .94) * horizontal * hotspot * softEdge;
  }

  float fluidHeight(vec2 xz) {
    if (atRest) return restLevel;
    vec2 grid = (xz / (2. * insideRadius) + .5) * 32. + .5;
    return texture(heightField, grid / 33.).r;
  }

  float distanceFromSurface(vec3 p) {
    vec3 world = transpose(tankFromWorld) * p;
    return world.y - fluidHeight(world.xz);
  }

  // Returns the first resolved crossing of the field, or the sphere exit.
  float surfaceCrossing(vec3 origin, vec3 dir, float limit, float side) {
    if (atRest) {
      float vertical = dot(dir, planeNormal);
      if (vertical * side >= -.0001) return limit;
      return clamp((restLevel - dot(planeNormal, origin)) / vertical, 0., limit);
    }
    float previous = 0.;
    for (int i = 1; i <= 16; ++i) {
      float t = float(i) * limit / 16.;
      if (side * distanceFromSurface(origin + t * dir) < 0.) {
        float lo = previous;
        float hi = t;
        for (int j = 0; j < 7; ++j) {
          float mid = (lo + hi) * .5;
          if (side * distanceFromSurface(origin + mid * dir) < 0.) hi = mid;
          else lo = mid;
        }
        return (lo + hi) * .5;
      }
      previous = t;
    }
    return limit;
  }

  vec3 surfaceNormal(vec3 p) {
    if (atRest) return planeNormal;
    const float delta = .066;
    vec2 xz = (transpose(tankFromWorld) * p).xz;
    float dx = fluidHeight(xz + vec2(delta, 0.)) - fluidHeight(xz - vec2(delta, 0.));
    float dz = fluidHeight(xz + vec2(0., delta)) - fluidHeight(xz - vec2(0., delta));
    return tankFromWorld * normalize(vec3(-dx, 2. * delta, -dz));
  }

  vec3 randomCell(vec3 cell) {
    vec3 a = fract(cell * vec3(.1031, .1099, .0877));
    a += dot(a, a.yxz + 19.19);
    return fract((a.xxy + a.yzz) * a.zyx);
  }

  vec2 metalFlake(vec3 p, vec3 view, vec3 normal) {
    p = transpose(tankFromWorld) * p;
    vec3 texel = clamp(p * .48 + .5, .0, 1.);
    vec3 travel = (texture(paintDisplacement, texel).xyz * 255. - 128.) * (.9 / 127.);
    vec3 cell = (p - travel * .88) * 113.;
    vec3 seed = randomCell(floor(cell));
    vec3 center = .23 + .54 * seed;
    float area = 1. - smoothstep(.17, .37, length(fract(cell) - center));
    vec3 tilt = normalize(seed - .501);
    vec3 flakeNormal = normalize(normal + tilt * .82);
    vec3 halfKey = normalize(tankFromWorld * vec3(-.51, .56, .65) + view);
    float glint = pow(max(dot(flakeNormal, halfKey), 0.), 20.);
    return vec2(seed.x - .5, glint * area);
  }

  vec3 paintBulk(vec3 entry, vec3 ray, float path, vec3 normal) {
    const vec3 key = vec3(-.64, .37, .674);
    vec3 view = -ray;
    vec3 worldNormal = transpose(tankFromWorld) * normal;
    float light = pow(max(dot(worldNormal, key), 0.), 2.42);
    float back = pow(max(dot(worldNormal, normalize(vec3(.14, -.95, .29))), 0.), 14.);
    float top = max(0., -distanceFromSurface(entry));
    // Pigment and suspended metal below the interface, with a short optical depth.
    float shallow = exp(-30. * top);
    vec3 mirror = reflect(ray, normal);
    vec3 highlight = studio(mirror, .18);
    float lacquer = softbox(transpose(tankFromWorld) * mirror, vec3(-.65, -.25, .74), vec2(.64, .34), .26);
    vec2 flake = metalFlake(entry + ray * min(path * .55, .011), view, normal);
    vec2 deepFlake = metalFlake(entry + ray * min(path * .79, .045), view, normal);
    float macro = .55 + .35 * light + .24 * back;
    vec3 base = pigment * (.044 + .38 * light + .50 * back + .115 * shallow + .62 * lacquer);
    base += highlight * pigment * .16;
    base *= 1. + macro * (flake.x * .13 + deepFlake.x * .10);
    base += macro * (flake.y * .201 + deepFlake.y * .084) * vec3(.94, .92, .88);
    // A soft near-side reflection at the wet contact, attenuated by depth.
    base += vec3(.91, .69, .44) * shallow * (.17 + .60 * light);
    float opacity = 1. - exp(-12. * path);
    return base * opacity;
  }

  vec3 paintSurface(vec3 point, vec3 ray) {
    vec3 normal = surfaceNormal(point);
    float facing = abs(dot(ray, normal));
    float coat = dielectric(facing, paintIOR);
    vec3 mirror = reflect(ray, normal);
    vec3 glossy = studio(mirror, .086) + surfaceStrip(point, mirror);
    vec3 broad = studio(mirror, .23);
    vec2 flake = metalFlake(point - normal * .012, -ray, normal);
    vec3 base = pigment * (.26 + .31 * broad) * (1. + .15 * flake.x);
    base += vec3(.83, .82, .77) * .15 * flake.y;
    return (1. - coat * .66) * base + coat * (glossy * .66 + broad * .26);
  }

  vec3 rearGlass(vec3 exitPoint, vec3 ray) {
    vec3 normal = normalize(exitPoint);
    vec3 throughGlass = refract(ray, -normal, 1. / glassIOR);
    float outerLimit = sphereSegment(exitPoint, throughGlass, 1.).y;
    vec3 backNormal = normalize(exitPoint + throughGlass * outerLimit);
    vec3 outside = refract(throughGlass, -backNormal, glassIOR);
    vec3 specular = studio(reflect(ray, -normal), .095);
    float rim = dielectric(dot(ray, normal), glassIOR);
    float wall = 1. - dielectric(dot(throughGlass, backNormal), 1. / glassIOR);
    // The reflected studio is visible through a largely dark, clear backdrop.
    return rim * specular * .11 + wall * studio(outside, .55) * vec3(.012, .016, .021);
  }

  // The diffusers are outside the camera crop. Their transmitted image makes the
  // rear wall and the moving water-air interface legible against the black UI.
  vec3 waterBackdrop(vec3 ray) {
    vec3 world = transpose(tankFromWorld) * ray;
    float sheet = softbox(world, vec3(-.52, -.43, -.94), vec2(.36, .26), .14);
    float strip = softbox(world, vec3(.72, -.19, -.82), vec2(.085, .55), .07);
    float horizon = softbox(world, vec3(-.12, .23, -1.), vec2(.74, .023), .045);
    float fill = smoothstep(.04, .60, world.y) * smoothstep(.38, .92, -world.z);
    return vec3(.003, .006, .008) + fill * vec3(.044, .069, .083)
      + sheet * vec3(.32, .40, .49) + strip * vec3(.85, .91, .93)
      + horizon * vec3(.14, .18, .21);
  }

  vec3 transmittedCards(vec3 exitPoint, vec3 direction) {
    vec3 p = transpose(tankFromWorld) * exitPoint;
    vec3 v = transpose(tankFromWorld) * direction;
    if (v.z >= -.03) return vec3(0.);
    float t = (-3.1 - p.z) / v.z;
    vec2 uv = (p + t * v).xy;
    float sideLight = smoothstep(.05, .34, abs(v.x));
    float leftEdge = uv.x + .89 + .23 * uv.y;
    float rightEdge = uv.x - .84 + .12 * uv.y;
    float left = exp(-leftEdge * leftEdge / .043) * exp(-.92 * pow(abs(uv.y - .42), 2.));
    float right = exp(-rightEdge * rightEdge / .011) * exp(-1.32 * pow(abs(uv.y - .37), 2.));
    vec2 baseUV = vec2((uv.x + .26) / .99, (uv.y - .54 - .27 * uv.x) / .25);
    float base = exp(-dot(baseUV, baseUV));
    return vec3(.81, .93, 1.) * sideLight * (.84 * left + .70 * right)
      + vec3(.42, .55, .61) * base * smoothstep(.07, .32, v.y);
  }

  vec3 waterExit(vec3 origin, vec3 ray, float mediumIOR) {
    float lengthInMedium = max(0., sphereSegment(origin, ray, insideRadius).y);
    vec3 wall = origin + lengthInMedium * ray;
    vec3 n = normalize(wall);
    vec3 inGlass = refract(ray, -n, mediumIOR / glassIOR);
    vec3 outer = normalize(wall + inGlass * max(0., sphereSegment(wall, inGlass, 1.).y));
    vec3 outside = refract(inGlass, -outer, glassIOR);
    float reflectance = dielectric(dot(ray, n), glassIOR / mediumIOR);
    vec3 insideBounce = waterBackdrop(reflect(ray, -n));
    vec3 behind = insideBounce;
    if (dot(outside, outside) > .5) {
      float wallReflection = dielectric(dot(inGlass, outer), 1. / glassIOR);
      behind = mix(waterBackdrop(outside) + transmittedCards(outer, outside), insideBounce, wallReflection);
    }
    vec3 light = mix(behind, insideBounce, reflectance);
    return mediumIOR > 1.1 ? light * exp(-vec3(.13, .057, .036) * lengthInMedium) : light;
  }

  vec3 waterInterface(vec3 p, vec3 ray, bool fromWater) {
    float sourceIOR = fromWater ? waterIOR : 1.;
    float destinationIOR = fromWater ? 1. : waterIOR;
    vec3 normal = (fromWater ? -1. : 1.) * surfaceNormal(p);
    normal = faceforward(normal, ray, normal);
    float fresnel = dielectric(-dot(ray, normal), destinationIOR / sourceIOR);
    vec3 mirrored = reflect(ray, normal);
    vec3 reflected = waterExit(p, mirrored, sourceIOR);
    reflected += studio(mirrored, .052) * .31 + surfaceStrip(p, mirrored) * vec3(.64, .78, 1.02);
    vec3 through = refract(ray, normal, sourceIOR / destinationIOR);
    if (dot(through, through) < .5) return reflected;
    return mix(waterExit(p, through, destinationIOR), reflected, fresnel);
  }

  vec3 traceCavity(vec3 entry, vec3 shellRay, bool wet) {
    vec3 innerNormal = normalize(entry);
    float insideIOR = wet ? (clearWater ? waterIOR : paintIOR) : 1.;
    float innerFresnel = dielectric(-dot(shellRay, innerNormal), insideIOR / glassIOR);
    vec3 innerReflection = studio(reflect(shellRay, innerNormal), .041);
    vec3 innerRay = refract(shellRay, innerNormal, glassIOR / insideIOR);
    vec3 inside = innerReflection * innerFresnel * .28;

    if (dot(innerRay, innerRay) > .5) {
      float limit = sphereSegment(entry, innerRay, insideRadius).y;
      if (limit <= 0.) return inside;
      float crossing = surfaceCrossing(entry, innerRay, limit, wet ? -1. : 1.);
      vec3 point = entry + innerRay * crossing;
      vec3 transmitted = vec3(0.);
      if (clearWater) {
        transmitted = waterExit(entry, innerRay, insideIOR);
        float coverage = smoothstep(.0, .035, limit - crossing);
        if (coverage > 0.) {
          vec3 surface = waterInterface(point, innerRay, wet);
          if (wet) surface *= exp(-vec3(.13, .057, .036) * crossing);
          transmitted = mix(transmitted, surface, coverage);
        }
      } else if (wet) {
        transmitted = paintBulk(entry, innerRay, crossing, innerNormal);
        if (crossing + .001 < limit) {
          vec3 upper = paintSurface(point, innerRay);
          transmitted += upper * exp(-17. * crossing) * .12;
        }
      } else {
        float feather = atRest ? clamp(.010 / max(.06, abs(dot(innerRay, planeNormal))), .018, .15) : .045;
        float surfaceCoverage = smoothstep(.0, feather, limit - crossing);
        if (surfaceCoverage < 1.) {
          transmitted += (1. - surfaceCoverage) * rearGlass(entry + limit * innerRay, innerRay);
        }
        if (surfaceCoverage > 0.) transmitted += surfaceCoverage * paintSurface(point, innerRay);
      }
      inside += (1. - innerFresnel) * transmitted;
    }
    return inside;
  }

  vec3 traceVessel(vec3 ray, vec3 outer) {
    vec3 outerNormal = normalize(outer);
    float frontFresnel = dielectric(-dot(ray, outerNormal), glassIOR);
    vec3 outerReflection = studio(reflect(ray, outerNormal), .022);
    vec3 shellRay = refract(ray, outerNormal, 1. / glassIOR);
    float entryDistance = sphereSegment(outer, shellRay, insideRadius).x;
    if (entryDistance <= 0.) return outerReflection * frontFresnel;

    vec3 entry = outer + shellRay * entryDistance;
    float gap = distanceFromSurface(entry);
    float wetCoverage = 1. - smoothstep(-.005, .005, gap);
    vec3 inside = vec3(0.);
    if (wetCoverage > 0.) {
      vec3 under = entry - planeNormal * max(.0, gap);
      inside += wetCoverage * traceCavity(under, shellRay, true);
    }
    if (wetCoverage < 1.) {
      vec3 over = entry + planeNormal * max(.0, -gap);
      inside += (1. - wetCoverage) * traceCavity(over, shellRay, false);
    }
    vec3 glassAbsorption = exp(-entryDistance * vec3(.13, .07, .055));
    return outerReflection * frontFresnel + (1. - frontFresnel) * inside * glassAbsorption;
  }

  void main() {
    vec2 uv = screenUV * 2. - 1.;
    vec3 forward = normalize(-cameraOrigin);
    vec3 right = normalize(cross(forward, vec3(0., 1., 0.)));
    vec3 up = cross(right, forward);
    vec3 direction = normalize(forward + right * (uv.x * projection.x) + up * (uv.y * projection.y));
    vec3 ray = tankFromWorld * direction;
    vec3 origin = tankFromWorld * cameraOrigin;
    float mid = -dot(origin, ray);
    float edge = 1. - dot(origin, origin) + mid * mid;
    vec3 color = vec3(0.);
    if (edge > -.007) {
      float coverage = smoothstep(-.006, .008, edge);
      vec3 outer = origin + ray * (mid - sqrt(max(.0, edge)));
      color = coverage * traceVessel(ray, outer);
    }
    pixel = vec4(color, 1.);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

function heightAt(field, x, z) {
  const grid = heightSize - 1;
  const gx = clampFluid((x / fluidRadius + 1) * grid / 2, 0, grid - .0001);
  const gz = clampFluid((z / fluidRadius + 1) * grid / 2, 0, grid - .0001);
  const ix = Math.floor(gx), iz = Math.floor(gz);
  const i = iz * heightSize + ix;
  const front = field[i] + (field[i + 1] - field[i]) * (gx - ix);
  const back = field[i + heightSize] + (field[i + heightSize + 1] - field[i + heightSize]) * (gx - ix);
  return front + (back - front) * (gz - iz);
}

function makePaintMotion(Three) {
  const side = 14;
  const channels = 4;
  const data = new Uint8Array(side ** 3 * channels).fill(128);
  const accum = new Float32Array(data.length);
  const texture = new Three.Data3DTexture(data, side, side, side);
  texture.format = Three.RGBAFormat;
  texture.minFilter = texture.magFilter = Three.LinearFilter;
  texture.needsUpdate = true;
  let restSamples = null;
  let wasMoving = false;

  function update(samples, quiet) {
    if (quiet || !restSamples) {
      restSamples = samples;
      if (wasMoving) {
        data.fill(128);
        texture.needsUpdate = true;
        wasMoving = false;
      }
      return;
    }
    // Scatter the displacement of the existing solver markers to a low-res 3-D field.
    wasMoving = true;
    accum.fill(0);
    for (let i = 0; i < samples.length; i += 3) {
      const fx = clampFluid((samples[i] * .48 + .5) * side - .5, 0, side - 1.001);
      const fy = clampFluid((samples[i + 1] * .48 + .5) * side - .5, 0, side - 1.001);
      const fz = clampFluid((samples[i + 2] * .48 + .5) * side - .5, 0, side - 1.001);
      const x = Math.floor(fx), y = Math.floor(fy), z = Math.floor(fz);
      const dx = fx - x, dy = fy - y, dz = fz - z;
      const tx = samples[i] - restSamples[i];
      const ty = samples[i + 1] - restSamples[i + 1];
      const tz = samples[i + 2] - restSamples[i + 2];
      for (let oz = 0; oz < 2; oz++) {
        for (let oy = 0; oy < 2; oy++) {
          for (let ox = 0; ox < 2; ox++) {
            const weight = (ox ? dx : 1 - dx) * (oy ? dy : 1 - dy) * (oz ? dz : 1 - dz);
            const k = ((z + oz) * side * side + (y + oy) * side + x + ox) * channels;
            accum[k] += tx * weight;
            accum[k + 1] += ty * weight;
            accum[k + 2] += tz * weight;
            accum[k + 3] += weight;
          }
        }
      }
    }
    for (let i = 0; i < accum.length; i += channels) {
      const factor = (127 / .9) / Math.max(.075, accum[i + 3]);
      for (let c = 0; c < 3; c++) data[i + c] = clampFluid(Math.round(128 + accum[i + c] * factor), 0, 255);
    }
    texture.needsUpdate = true;
  }
  return { texture, update };
}

function writeFluidReadout(canvas, {mesh, stats, quiet, count, roll, pitch}) {
  canvas.dataset.rest = String(quiet);
  canvas.dataset.capSpread = stats.spread.toFixed(7);
  canvas.dataset.residual = stats.residual.toFixed(7);
  canvas.dataset.roll = roll.toFixed(6);
  canvas.dataset.pitch = pitch.toFixed(6);
  canvas.dataset.speed = stats.velocity.toFixed(4);
  canvas.dataset.fill = stats.fill.toFixed(6);
  canvas.dataset.left = heightAt(mesh, -.55, 0).toFixed(5);
  canvas.dataset.right = heightAt(mesh, .55, 0).toFixed(5);
  canvas.dataset.front = heightAt(mesh, 0, .55).toFixed(5);
  canvas.dataset.back = heightAt(mesh, 0, -.55).toFixed(5);
  canvas.dataset.particles = String(count);
  canvas.dataset.frames = String(1 + Number(canvas.dataset.frames || 0));
}

function buildVesselView(Three, canvas, context) {
  const width = 262, height = 251;
  const renderer = new Three.WebGLRenderer({ canvas, context, alpha: false, preserveDrawingBuffer: true, antialias: false });
  renderer.debug.onShaderError = (gl, program) => {
    throw new Error(gl.getProgramInfoLog(program) || "The liquid shader could not be linked.");
  };
  renderer.setPixelRatio(2);
  renderer.setSize(width, height, false);
  renderer.outputColorSpace = Three.SRGBColorSpace;
  renderer.toneMapping = Three.AgXToneMapping;
  renderer.toneMappingExposure = 1.03;

  const heights = new Uint16Array(heightSize ** 2);
  const field = new Three.DataTexture(heights, heightSize, heightSize, Three.RedFormat, Three.HalfFloatType);
  field.minFilter = field.magFilter = Three.LinearFilter;
  const paint = makePaintMotion(Three);

  const cameraOrigin = new Three.Vector3(0, .31, 7.6);
  const cameraRadius = cameraOrigin.length();
  const baseElevation = Math.atan2(cameraOrigin.y, cameraOrigin.z);
  const cone = (height / 226) / Math.sqrt(cameraRadius ** 2 - 1);
  const pitchTransform = new Three.Matrix4();
  const rollTransform = new Three.Matrix4();
  const inverseTank = new Three.Matrix3();
  const planeNormal = new Three.Vector3(0, 1, 0);
  const uniforms = {
    heightField: { value: field },
    paintDisplacement: { value: paint.texture },
    atRest: { value: true },
    clearWater: { value: true },
    cameraOrigin: { value: cameraOrigin },
    projection: { value: new Three.Vector2(cone * width / height, cone) },
    tankFromWorld: { value: inverseTank },
    planeNormal: { value: planeNormal },
  };
  const material = new Three.ShaderMaterial({
    uniforms,
    glslVersion: Three.GLSL3,
    depthTest: false,
    depthWrite: false,
    vertexShader: `
      out vec2 screenUV;
      void main() {
        screenUV = uv;
        gl_Position = vec4(position.xy, 0., 1.);
      }
    `,
    fragmentShader: glassFragment,
  });
  const scene = new Three.Scene();
  scene.add(new Three.Mesh(new Three.PlaneGeometry(2, 2), material));
  const camera = new Three.Camera();
  canvas.dataset.engine = "three.js r" + Three.REVISION;
  function appearance(name) {
    uniforms.clearWater.value = name === "water";
    canvas.dataset.material = name;
  }

  function renderView() {
    renderer.render(scene, camera);
  }

  function update(state) {
    const {mesh, grains, quiet, roll, pitch, up} = state;
    pitchTransform.makeRotationX(pitch).multiply(rollTransform.makeRotationZ(-roll));
    inverseTank.setFromMatrix4(pitchTransform).transpose();
    planeNormal.set(...up);
    for (let i = 0; i < mesh.length; i++) heights[i] = Three.DataUtils.toHalfFloat(mesh[i]);
    field.needsUpdate = true;
    paint.update(grains, quiet);
    uniforms.atRest.value = quiet;
    renderView();
    writeFluidReadout(canvas, state);
  }

  function orbit(azimuth, elevation) {
    const height = baseElevation + elevation;
    const horizontal = cameraRadius * Math.cos(height);
    cameraOrigin.set(horizontal * Math.sin(azimuth), cameraRadius * Math.sin(height), horizontal * Math.cos(azimuth));
    canvas.dataset.azimuth = azimuth.toFixed(6);
    canvas.dataset.elevation = elevation.toFixed(6);
  }

  return { update, orbit, appearance, renderView, dispose() {
    field.dispose(); paint.texture.dispose(); material.dispose(); scene.children[0].geometry.dispose(); renderer.dispose();
  } };
}

"use strict";

// Image-based shading for hosts without WebGL. The free surface is projected
// from the live 3-D solver; the atlas only supplies resting glass and liquid optics.
async function buildCompatibleVessel(canvas) {
  const w = 320, h = 306, azimuths = 8, slices = 17, samples = 89;
  const elevations = [-62, -36, -14, 0, 16, 40, 70];
  const degree = Math.PI / 180;
  const distance = Math.hypot(7.6, .31), baseElevation = Math.atan2(.31, 7.6);
  const radius = h * 113 / 251, focal = radius * Math.sqrt(distance * distance - 1);
  const capRadius = Math.sqrt(fluidRadius * fluidRadius - fluidLine * fluidLine);
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d", {alpha:false});
  if (!ctx) throw new Error("Canvas 2D unavailable");
  canvas.dataset.engine = "Canvas 2D";
  const tile = document.createElement("canvas");
  tile.width = w; tile.height = h;
  const tileCtx = tile.getContext("2d", {alpha:false, willReadFrequently:true});
  const base = ctx.createImageData(w, h), output = ctx.createImageData(w, h);
  const mask = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const r = Math.hypot(x + .5 - w / 2, y + .5 - h / 2) / radius;
    mask[y * w + x] = Math.min(1, Math.max(0, (1 - r) * 65));
  }

  function makeProfile() {
    return { rows: Array.from({length:slices}, () => new Float32Array(w)),
      top: new Float32Array(w), bottom: new Float32Array(w) };
  }
  function projectSurface(out, mesh, azimuth, elevation) {
    const ca = Math.cos(azimuth), sa = Math.sin(azimuth);
    const ce = Math.cos(baseElevation + elevation), se = Math.sin(baseElevation + elevation);
    out.top.fill(Infinity); out.bottom.fill(-Infinity);
    for (let layer = 0; layer < slices; layer++) {
      const row = out.rows[layer], depth = layer * 2 / (slices - 1) - 1;
      let column = 0, prevX = 0, prevY = 0;
      for (let i = 0; i < samples; i++) {
        const theta = Math.PI * i / (samples - 1);
        let side = -capRadius * Math.cos(theta), forward = depth * capRadius * Math.sin(theta);
        let level = fluidLine;
        if (mesh) {
          const worldX = side * ca + forward * sa, worldZ = forward * ca - side * sa;
          level = heightAt(mesh, worldX, worldZ);
          const edge = Math.sqrt(Math.max(.01, fluidRadius ** 2 - level ** 2)) / capRadius;
          side *= edge; forward *= edge;
          level = heightAt(mesh, worldX * edge, worldZ * edge);
        }
        const scale = focal / (distance - level * se - forward * ce);
        const sx = w / 2 + scale * side, sy = h / 2 - scale * (level * ce - forward * se);
        if (!i) { prevX = sx; prevY = sy; }
        while (column < w && column + .5 <= sx) {
          const t = Math.max(0, Math.min(1, (column + .5 - prevX) / Math.max(.0001, sx - prevX)));
          row[column++] = prevY + (sy - prevY) * t;
        }
        prevX = sx; prevY = sy;
      }
      row.fill(prevY, column);
      for (let x = 0; x < w; x++) {
        out.top[x] = Math.min(out.top[x], row[x]);
        out.bottom[x] = Math.max(out.bottom[x], row[x]);
      }
    }
  }

  const reference = elevations.map(elevation => {
    const shape = makeProfile();
    projectSurface(shape, null, 0, elevation * degree);
    return shape;
  });
  const levelView = makeProfile(), moving = makeProfile();
  async function loadAtlas(name) {
    try {
      const img = new Image();
      const loaded = new Promise((resolve, reject) => { img.onload = resolve; img.onerror = reject; });
      img.src = new URL("./assets/motion-ui/balance-" + name + ".webp", import.meta.url).href;
      await loaded;
      return img.naturalWidth === w * azimuths && img.naturalHeight === h * elevations.length ? img : null;
    } catch { return null; }
  }
  const [water, gold] = await Promise.all([loadAtlas("water"), loadAtlas("gold")]);
  const atlas = {water,gold}, cache = new Map();
  canvas.dataset.optics = water && gold ? "atlas" : "local";

  // Draw a neutral optical plate if the host also disables embedded images.
  function drawLocalPlate(name, column, row) {
    const c = tileCtx, cx = w / 2, cy = h / 2, shape = reference[row];
    const shift = Math.sin(column * 2 * Math.PI / azimuths);
    c.fillStyle = "#000"; c.fillRect(0, 0, w, h); c.save();
    c.beginPath(); c.arc(cx, cy, radius, 0, Math.PI * 2); c.clip();
    const glass = c.createRadialGradient(cx - .32 * radius + shift * 15, cy - .42 * radius, 0, cx, cy, radius);
    glass.addColorStop(0,"#222a2e"); glass.addColorStop(.74,"#060a0d");
    glass.addColorStop(.97,"#141a1e"); glass.addColorStop(1,"#8a8a85");
    c.fillStyle = glass; c.fillRect(0, 0, w, h);
    c.beginPath(); c.moveTo(0,h);
    for (let x=0;x<w;x++) c.lineTo(x,shape.top[x]);
    c.lineTo(w,h); c.closePath(); c.save(); c.clip();
    const bulk = c.createLinearGradient(0, cy - .2 * radius, 0, cy + radius);
    bulk.addColorStop(0, name === "water" ? "#74858d" : "#c8ad88");
    bulk.addColorStop(.36, name === "water" ? "#15232a" : "#6e5742");
    bulk.addColorStop(.70, name === "water" ? "#273a44" : "#554234");
    bulk.addColorStop(1, name === "water" ? "#79888b" : "#97816a");
    c.fillStyle = bulk; c.fillRect(0,0,w,h);
    c.beginPath();
    for (let x=0;x<w;x++) { if (x) c.lineTo(x,shape.top[x]); else c.moveTo(x,shape.top[x]); }
    for (let x=w-1;x>=0;x--) c.lineTo(x,shape.bottom[x]);
    c.closePath(); c.fillStyle=name==="water"?"#90a0a5":"#b7a087"; c.fill();
    c.restore(); c.strokeStyle="#a4a29c"; c.lineWidth=1;
    c.beginPath(); c.arc(cx,cy,radius-1,0,Math.PI*2); c.stroke(); c.restore();
  }
  function pixels(name, col, row) {
    const key = name + "/" + col + "/" + row;
    if (cache.has(key)) return cache.get(key);
    if (atlas[name]) tileCtx.drawImage(atlas[name], col*w, row*h, w, h, 0, 0, w, h);
    else drawLocalPlate(name, col, row);
    const data = tileCtx.getImageData(0,0,w,h).data;
    cache.set(key, data);
    if (cache.size > 12) cache.delete(cache.keys().next().value);
    return data;
  }
  function weightOutside(gap, fade) {
    const left = Math.max(0,1-gap/fade);
    return left * left;
  }
  function matchBand(y, top, bottom, refTop, refBottom) {
    if (y < top) return y + (refTop-top) * weightOutside(top-y, radius*.48);
    if (y > bottom) return y + (refBottom-bottom) * weightOutside(y-bottom, radius*.60);
    return refTop + (refBottom-refTop) * (y-top) / Math.max(.25,bottom-top);
  }

  let finish = "water", az = 0, el = 0, state = null, dirty = true;
  function makeBase() {
    projectSurface(levelView, null, az, el);
    const longitude = ((az/(2*Math.PI) % 1 + 1) % 1) * azimuths;
    const c0 = Math.floor(longitude) % azimuths, c1 = (c0 + 1) % azimuths, fx = longitude % 1;
    const latitude = Math.max(elevations[0], Math.min(elevations.at(-1), el/degree));
    let r0 = 0;
    while (r0 < elevations.length - 2 && latitude >= elevations[r0+1]) r0++;
    const fy = (latitude-elevations[r0]) / (elevations[r0+1]-elevations[r0]);
    const plates = [[c0,r0,(1-fx)*(1-fy)],[c1,r0,fx*(1-fy)],[c0,r0+1,(1-fx)*fy],[c1,r0+1,fx*fy]]
      .filter(([, , a]) => a > .00001).map(([c,r,a])=>({data:pixels(finish,c,r), shape:reference[r], a}));
    if (plates.length === 1) { base.data.set(plates[0].data); dirty = false; return; }
    for (let y=0;y<h;y++) for (let x=0;x<w;x++) {
      const p = y*w+x, i=p*4, rim=mask[p];
      let red=0,green=0,blue=0;
      for (const {data,shape,a} of plates) {
        const sy = matchBand(y,levelView.top[x],levelView.bottom[x],shape.top[x],shape.bottom[x]);
        const v = Math.max(0,Math.min(h-1.001,y+(sy-y)*rim)), y0=Math.floor(v), f=v-y0;
        const k=(y0*w+x)*4, j=k+w*4;
        red+=a*(data[k]+(data[j]-data[k])*f);green+=a*(data[k+1]+(data[j+1]-data[k+1])*f);
        blue+=a*(data[k+2]+(data[j+2]-data[k+2])*f);
      }
      base.data[i]=red; base.data[i+1]=green; base.data[i+2]=blue; base.data[i+3]=255;
    }
    dirty = false;
  }
  function renderView() {
    if (!state) return;
    if (dirty) makeBase();
    if (state.quiet) {ctx.putImageData(base,0,0);return;}
    projectSurface(moving,state.mesh,az,el);
    const src=base.data, dst=output.data;
    dst.set(src);
    for (let x=1;x<w-1;x++) {
      const top=moving.top[x], bottom=moving.bottom[x];
      const lo=Math.max(0,Math.floor(top-radius*.48)), hi=Math.min(h-1,Math.ceil(bottom+radius*.60));
      for (let y=lo;y<=hi;y++) {
        const p=y*w+x, rim=mask[p];
        if (!rim) continue;
        // Supersample the thin moving contact strip, where a coverage change
        // between adjacent rows otherwise looks stepped on the enlarged review.
        const taps = y > top-1 && y < bottom+1 ? 3 : 1;
        let red=0, green=0, blue=0;
        for (let tap=0;tap<taps;tap++) {
          const at=y+(tap+.5)/taps-.5;
          let sy=matchBand(at,top,bottom,levelView.top[x],levelView.bottom[x]), gloss=1;
          if (at>=top && at<=bottom) {
            // Nearer folds occlude farther ones when the observer orbits the tank.
            for (let z=slices-1;z>0;z--) {
              const near=moving.rows[z], a=near[x], b=moving.rows[z-1][x];
              if ((at-a)*(at-b)>0 || Math.abs(a-b)<.01) continue;
              const t=(at-a)/(b-a), level=levelView.rows[z];
              sy=level[x]+(levelView.rows[z-1][x]-level[x])*t;
              const slope=.5*((near[x+1]-near[x-1])-(level[x+1]-level[x-1]));
              gloss += Math.max(-.15,Math.min(.22,slope*.27))*rim;
              break;
            }
          }
          const v=Math.max(0,Math.min(h-1.001,at+(sy-at)*rim)), y0=Math.floor(v), f=v-y0;
          const k=(y0*w+x)*4,j=k+w*4;
          red+=(src[k]+(src[j]-src[k])*f)*gloss;
          green+=(src[k+1]+(src[j+1]-src[k+1])*f)*gloss;
          blue+=(src[k+2]+(src[j+2]-src[k+2])*f)*gloss;
        }
        const i=p*4;
        dst[i]=red/taps; dst[i+1]=green/taps; dst[i+2]=blue/taps;
      }
    }
    ctx.putImageData(output,0,0);
  }
  return {
    update(next) {state=next;renderView();writeFluidReadout(canvas,next);},
    orbit(azimuth,elevation) {
      dirty ||= az!==azimuth || el!==elevation;
      az=azimuth;el=elevation;
      canvas.dataset.azimuth=az.toFixed(6);canvas.dataset.elevation=el.toFixed(6);
    },
    appearance(name) {dirty ||= finish!==name;finish=name;canvas.dataset.material=name;},
    renderView,
  };
}

export {buildVesselView,buildCompatibleVessel};
