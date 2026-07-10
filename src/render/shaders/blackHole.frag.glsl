precision highp float;
precision highp int;

in vec2 vUv;
out vec4 outColor;

uniform vec2 uResolution;
uniform float uTime;
uniform float uMassScale;
uniform float uSpin;
uniform float uDiskHeat;
uniform float uLensing;
uniform vec3 uCamera;
uniform int uDiskSteps;
uniform sampler2D uStarfield;

const float PI = 3.141592653589793;
const float TAU = 6.283185307179586;
const int MAX_DISK_STEPS = 72;

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float valueNoise(vec2 p) {
  vec2 cell = floor(p);
  vec2 local = fract(p);
  local = local * local * (3.0 - 2.0 * local);
  float a = hash21(cell);
  float b = hash21(cell + vec2(1.0, 0.0));
  float c = hash21(cell + vec2(0.0, 1.0));
  float d = hash21(cell + vec2(1.0, 1.0));
  return mix(mix(a, b, local.x), mix(c, d, local.x), local.y);
}

vec3 cameraPosition() {
  float cosPitch = cos(uCamera.y);
  return vec3(
    cosPitch * sin(uCamera.x),
    sin(uCamera.y),
    cosPitch * cos(uCamera.x)
  ) * uCamera.z;
}

vec3 cameraRay(vec2 uv, vec3 origin, vec3 target) {
  vec2 screen = uv * 2.0 - 1.0;
  screen.x *= uResolution.x / max(uResolution.y, 1.0);
  vec3 forward = normalize(target - origin);
  vec3 right = normalize(cross(forward, vec3(0.0, 1.0, 0.0)));
  vec3 up = normalize(cross(right, forward));
  return normalize(forward + screen.x * right * 0.5 + screen.y * up * 0.5);
}

vec3 starField(vec3 rayDirection, sampler2D starTexture) {
  vec3 direction = normalize(rayDirection);
  vec2 uv = vec2(
    atan(direction.z, direction.x) / TAU + 0.5,
    asin(clamp(direction.y, -1.0, 1.0)) / PI + 0.5
  );
  vec3 generatedStars = texture(starTexture, uv).rgb;

  vec2 microCell = floor(uv * vec2(1450.0, 720.0));
  vec2 microLocal = fract(uv * vec2(1450.0, 720.0)) - 0.5;
  float seed = hash21(microCell);
  float microStar = step(0.9968, seed) * exp(-90.0 * dot(microLocal, microLocal));
  vec3 tint = mix(vec3(1.0, 0.72, 0.5), vec3(0.64, 0.79, 1.0), hash21(microCell + 7.3));
  return generatedStars * 1.6 + tint * microStar * 2.8;
}

vec3 temperatureColor(float radius, float heat) {
  float massRadius = sqrt(uMassScale);
  float inner = mix(1.5, 1.08, uSpin) * massRadius;
  float outer = 5.8 * massRadius;
  float energy = pow(1.0 - clamp((radius - inner) / max(outer - inner, 0.1), 0.0, 1.0), 1.65);
  vec3 ember = vec3(1.4, 0.08, 0.012);
  vec3 amber = vec3(1.8, 0.55, 0.11);
  vec3 whiteHot = vec3(2.25, 1.7, 1.12);
  vec3 base = mix(ember, amber, smoothstep(0.0, 0.65, energy));
  return mix(base, whiteHot, clamp(energy * (0.48 + heat * 0.7), 0.0, 1.0));
}

vec3 bendRay(vec3 origin, vec3 direction, float massScale, float lensing) {
  float radius = max(length(origin), 0.28);
  float gravity = 0.095 * massScale * lensing / (radius * radius);
  return normalize(direction - normalize(origin) * gravity);
}

vec3 applyDopplerAndRedshift(vec3 color, vec3 hitPosition, float spin) {
  float radius = max(length(hitPosition.xz), 0.01);
  vec3 tangent = normalize(vec3(-hitPosition.z, 0.0, hitPosition.x));
  vec3 towardObserver = normalize(cameraPosition() - hitPosition);
  float approach = dot(tangent, towardObserver);
  float beaming = pow(1.0 / max(0.36, 1.0 - approach * spin * 0.52), 2.35);
  beaming = clamp(beaming, 0.24, 3.4);
  float redshift = sqrt(clamp(1.0 - (0.74 * sqrt(uMassScale)) / radius, 0.08, 1.0));
  vec3 shifted = color * beaming * redshift;
  shifted *= mix(vec3(1.1, 0.73, 0.52), vec3(0.78, 0.95, 1.18), approach * 0.5 + 0.5);
  return shifted;
}

vec4 sampleAccretionDisk(
  vec3 segmentOrigin,
  vec3 segmentDirection,
  float spin,
  float heat,
  float time
) {
  if (abs(segmentDirection.y) < 0.00001) return vec4(0.0);
  float crossing = -segmentOrigin.y / segmentDirection.y;
  if (crossing < 0.0 || crossing > 1.0) return vec4(0.0);

  vec3 hit = segmentOrigin + segmentDirection * crossing;
  float radius = length(hit.xz);
  float massRadius = sqrt(uMassScale);
  float inner = mix(1.5, 1.08, spin) * massRadius;
  float outer = 5.8 * massRadius;
  if (radius < inner || radius > outer) return vec4(0.0);

  float angle = atan(hit.z, hit.x);
  float flow = angle * 3.0 - time * (0.55 + spin * 2.2) / pow(max(radius, 1.0), 0.68);
  float turbulence = valueNoise(vec2(flow * 1.7, radius * 3.9 + time * 0.14));
  turbulence += 0.5 * valueNoise(vec2(flow * 4.3 - time * 0.27, radius * 8.1));
  float radialBands = 0.68 + 0.32 * sin(radius * 18.0 - time * 0.8 + turbulence * 5.0);
  float outerFade = 1.0 - smoothstep(outer * 0.72, outer, radius);
  float innerFade = smoothstep(inner, inner + 0.16 * massRadius, radius);
  float density = clamp((0.58 + turbulence * 0.6) * radialBands * outerFade * innerFade, 0.0, 1.0);
  vec3 color = temperatureColor(radius, heat);
  color = applyDopplerAndRedshift(color, hit, spin);
  float alpha = density * (0.48 + heat * 0.26);
  return vec4(color * (0.7 + density * 1.3), alpha);
}

void main() {
  vec3 origin = cameraPosition();
  vec3 direction = cameraRay(vUv, origin, vec3(0.0));
  vec3 position = origin;
  vec3 diskLight = vec3(0.0);
  float transmittance = 1.0;
  float closestApproach = 1000.0;
  bool captured = false;
  float horizon = 0.78 * sqrt(uMassScale);

  for (int stepIndex = 0; stepIndex < MAX_DISK_STEPS; stepIndex += 1) {
    if (stepIndex >= uDiskSteps) break;
    vec3 previous = position;
    float radiusBefore = length(position);
    float stepSize = mix(0.052, 0.19, smoothstep(0.8, 7.5, radiusBefore));
    direction = bendRay(position, direction, uMassScale, uLensing);
    position += direction * stepSize;
    float radius = length(position);
    closestApproach = min(closestApproach, radius);

    vec4 diskSample = sampleAccretionDisk(previous, position - previous, uSpin, uDiskHeat, uTime);
    diskLight += diskSample.rgb * diskSample.a * transmittance;
    transmittance *= 1.0 - diskSample.a * 0.78;

    if (radius < horizon) {
      captured = true;
      break;
    }
    if (radius > 12.0 && dot(position, direction) > 0.0) break;
  }

  vec3 background = captured ? vec3(0.0) : starField(direction, uStarfield) * transmittance;
  float ringRadius = horizon * 1.17;
  float ringWidth = 0.052 + 0.018 * uLensing;
  float photonRing = exp(-pow((closestApproach - ringRadius) / ringWidth, 2.0));
  photonRing *= captured ? 0.28 : 1.0;
  vec3 ringColor = vec3(2.3, 1.45, 0.72) * photonRing * (0.55 + uDiskHeat * 0.85);

  vec3 color = background + diskLight + ringColor;
  float vignetteShape = max(0.0, 16.0 * vUv.x * vUv.y * (1.0 - vUv.x) * (1.0 - vUv.y));
  float vignette = 0.62 + 0.38 * pow(vignetteShape, 0.18);
  color *= vignette;
  outColor = vec4(color, 1.0);
}
