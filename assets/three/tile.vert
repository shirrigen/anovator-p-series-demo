varying vec2 tilePosition;
varying vec3 tileNormal;

void main() {
  tilePosition = position.xy;
  tileNormal = normalize(normalMatrix * normal);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
