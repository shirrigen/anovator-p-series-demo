uniform float lit;
uniform float recorded;
uniform float press;
uniform float reflection;
uniform float checkStroke;
varying vec2 tilePosition;
varying vec3 tileNormal;

float grainAt(vec2 p) {
  return fract(sin(dot(p, vec2(27.43, 63.97))) * 28566.813);
}

float segmentDistance(vec2 p, vec2 a, vec2 b) {
  vec2 d = b - a;
  float t = clamp(dot(p - a, d) / max(dot(d, d), .001), 0.0, 1.0);
  return length(p - a - d * t);
}

void main() {
  vec2 normalized = tilePosition / 40.0;
  vec3 normal = normalize(tileNormal);
  vec2 corner = abs(tilePosition) - vec2(30.4);
  float contour = length(max(corner, 0.0)) + min(max(corner.x, corner.y), 0.0) - 9.65;
  float upperLeft = smoothstep(-1.1, 1.1, dot(normalized, vec2(-.58, .8)));
  float bevel = 1.0 - smoothstep(.55, .99, normal.z);
  float silverEdge = pow(max(dot(normal, normalize(vec3(-.62, .86, .91))), 0.0), 12.0);
  float seam = 1.0 - smoothstep(.12, .78, abs(contour + 1.42));
  float outerEdge = 1.0 - smoothstep(.12, .92, abs(contour - .06));
  float grain = (grainAt(floor(tilePosition * 5.4)) - .5) * .012;

  // A fixed strip light and a fine secondary seam. The pattern is identical
  // for every tile and remains still until a target is shown.
  float lightAxis = dot(normalized, vec2(.57, -.82));
  float stripWidth = (lightAxis + .63) * 2.65;
  float softStrip = exp(-stripWidth * stripWidth);
  float brushed = sin(tilePosition.x * 14.6 + tilePosition.y * 9.1) * .0019;
  vec3 charcoal = vec3(.060, .065, .071) + .025 * upperLeft + .024 * softStrip + grain + brushed;
  vec3 metal = vec3(.109, .115, .126) + .20 * silverEdge + .10 * upperLeft;
  vec3 idle = mix(charcoal, metal, .18 + .72 * bevel);
  idle += outerEdge * vec3(.047, .051, .055) * (.35 + .65 * upperLeft);
  idle -= seam * .020;

  // The cue is a single full-face change. Both materials use the same geometry.
  vec3 enamel = vec3(.924, .913, .883) + .039 * upperLeft + .012 * softStrip + grain * .42;
  vec3 enamelEdge = vec3(.65, .619, .56) + .21 * upperLeft + .075 * silverEdge;
  vec3 lamp = mix(enamel, enamelEdge, bevel * .9);
  lamp -= seam * .025;
  vec3 color = mix(idle, lamp, lit);

  // Once recorded, the surface drops in depth and the light resolves at the edge.
  float panelLight = .31 * reflection * (.72 + .28 * softStrip);
  vec3 pressed = mix(idle * 1.57 + vec3(.014, .016, .017), enamel, panelLight);
  pressed += (bevel + .35 * outerEdge) * upperLeft * .09;
  pressed -= press * seam * (.04 + .12 * upperLeft);
  color = mix(color, pressed, recorded);

  if (recorded > .5 && checkStroke > .0) {
    vec2 p = tilePosition;
    vec2 a = vec2(-10.5, .4);
    vec2 knee = vec2(-3.0, -7.1);
    vec2 b = vec2(11.9, 8.5);
    float early = clamp(checkStroke / .36, 0.0, 1.0);
    float late = clamp((checkStroke - .36) / .64, 0.0, 1.0);
    float d = segmentDistance(p, a, mix(a, knee, early));
    if (late > .0) d = min(d, segmentDistance(p, knee, mix(knee, b, late)));
    float mark = (1.0 - smoothstep(1.4, 2.05, d)) * smoothstep(.04, .35, checkStroke);
    color = mix(color, vec3(.960, .950, .919), mark);
  }
  gl_FragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
}
