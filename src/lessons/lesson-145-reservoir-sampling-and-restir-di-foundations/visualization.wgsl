struct LessonSettings {
  renderSize: vec2f,
  lightCount: f32,
  candidatesPerFrame: f32,
  seed: f32,
  receiverX: f32,
  receiverY: f32,
  time: f32,
  _padding: f32,
};

struct PresentUniforms {
  displaySize: vec2f,
  sourceSize: vec2f,
};

struct Light {
  position: vec2f,
  radius: f32,
  intensity: f32,
  color: vec3f,
  _padding: f32,
};

struct Occluder {
  rect: vec4f,
  depth: f32,
  roughness: f32,
  index: f32,
  _padding: f32,
};

@group(0) @binding(0) var<uniform> settings: LessonSettings;
@group(0) @binding(1) var<storage, read> lights: array<Light>;
@group(0) @binding(2) var<storage, read> occluders: array<Occluder>;

@group(0) @binding(0) var sourceTexture: texture_2d<f32>;
@group(0) @binding(1) var sourceSampler: sampler;
@group(0) @binding(2) var<uniform> presentUniforms: PresentUniforms;

const PANEL_COUNT = 3.0;
const ROOM_MIN = vec2f(0.0, 0.0);
const ROOM_MAX = vec2f(1.0, 1.0);

struct EstimateResult {
  selectedIndex: u32,
  estimate: f32,
  confidence: f32,
  maxIndex: u32,
  maxContribution: f32,
};

fn hash11(value: f32) -> f32 {
  return fract(sin(value * 127.1 + 311.7) * 43758.5453123);
}

fn hash21(value: vec2f) -> f32 {
  return fract(sin(dot(value, vec2f(127.1, 311.7))) * 43758.5453123);
}

fn panelInfo(uv: vec2f) -> vec3f {
  let scaled = uv.x * PANEL_COUNT;
  let panel = floor(scaled);
  return vec3f(panel, fract(scaled), uv.y);
}

fn checkAxis(p: f32, q: f32, t0Value: ptr<function, f32>, t1Value: ptr<function, f32>) -> bool {
  if (abs(p) < 1e-6) {
    return q >= 0.0;
  }
  let r = q / p;
  if (p < 0.0) {
    if (r > (*t1Value)) {
      return false;
    }
    if (r > (*t0Value)) {
      (*t0Value) = r;
    }
  } else {
    if (r < (*t0Value)) {
      return false;
    }
    if (r < (*t1Value)) {
      (*t1Value) = r;
    }
  }
  return true;
}

fn segmentIntersectsRect(a: vec2f, b: vec2f, rect: vec4f) -> bool {
  let dir = b - a;
  var t0 = 0.0;
  var t1 = 1.0;

  if (!checkAxis(-dir.x, a.x - rect.x, &t0, &t1)) {
    return false;
  }
  if (!checkAxis(dir.x, rect.x + rect.z - a.x, &t0, &t1)) {
    return false;
  }
  if (!checkAxis(-dir.y, a.y - rect.y, &t0, &t1)) {
    return false;
  }
  if (!checkAxis(dir.y, rect.y + rect.w - a.y, &t0, &t1)) {
    return false;
  }
  return t1 > t0;
}

fn evaluateContribution(receiver: vec2f, lightIndex: u32) -> f32 {
  let light = lights[lightIndex];
  for (var index = 0u; index < 6u; index += 1u) {
    let occluder = occluders[index];
    if (segmentIntersectsRect(receiver, light.position, occluder.rect)) {
      return 0.0;
    }
  }
  let delta = light.position - receiver;
  let distanceSq = max(dot(delta, delta), 0.0001);
  let distance = sqrt(distanceSq);
  let normalDot = clamp((receiver.y - light.position.y) / -max(distance, 1e-4), 0.05, 1.0);
  let luminance = dot(light.color, vec3f(0.3, 0.59, 0.11));
  return (light.intensity * luminance * normalDot * (0.7 + light.radius * 6.0)) / max(distanceSq * 18.0, 0.02);
}

fn buildEstimate(receiver: vec2f) -> EstimateResult {
  var maxContribution = 0.0;
  var maxIndex = 0u;
  for (var index = 0u; index < u32(settings.lightCount); index += 1u) {
    let contribution = evaluateContribution(receiver, index);
    if (contribution > maxContribution) {
      maxContribution = contribution;
      maxIndex = index;
    }
  }

  let uniformIndex = u32(floor(hash11(settings.seed + 0.37) * settings.lightCount));
  var selectedIndex = uniformIndex;
  var selectedContribution = 0.0;
  var weightSum = 0.0;
  for (var candidateIndex = 0u; candidateIndex < u32(settings.candidatesPerFrame); candidateIndex += 1u) {
    let lightIndex = u32(
      floor(hash11(settings.seed + f32(candidateIndex) * 1.71 + 0.23) * settings.lightCount)
    );
    let contribution = evaluateContribution(receiver, lightIndex);
    let rawWeight = contribution * settings.lightCount;
    if (rawWeight <= 0.0) {
      continue;
    }
    weightSum += rawWeight;
    let pick = hash11(settings.seed + f32(candidateIndex) * 2.13 + 0.91);
    if (pick * weightSum < rawWeight) {
      selectedIndex = lightIndex;
      selectedContribution = contribution;
    }
  }

  let estimate = weightSum / max(settings.candidatesPerFrame, 1.0);
  let confidence = weightSum / max(settings.candidatesPerFrame, 1.0);
  return EstimateResult(selectedIndex, estimate, confidence, maxIndex, maxContribution);
}

fn candidateMatch(lightIndex: u32) -> bool {
  for (var candidateIndex = 0u; candidateIndex < u32(settings.candidatesPerFrame); candidateIndex += 1u) {
    let candidate = u32(
      floor(hash11(settings.seed + f32(candidateIndex) * 1.71 + 0.23) * settings.lightCount)
    );
    if (candidate == lightIndex) {
      return true;
    }
  }
  return false;
}

fn circleMask(uv: vec2f, center: vec2f, radius: f32) -> f32 {
  let d = length(uv - center);
  return smoothstep(radius, radius - 0.008, d);
}

fn roomColor(panelIndex: i32, roomUv: vec2f, estimate: EstimateResult) -> vec3f {
  var color = vec3f(0.05, 0.09, 0.15);
  for (var index = 0u; index < 6u; index += 1u) {
    let occluder = occluders[index];
    if (
      roomUv.x >= occluder.rect.x &&
      roomUv.x <= occluder.rect.x + occluder.rect.z &&
      roomUv.y >= occluder.rect.y &&
      roomUv.y <= occluder.rect.y + occluder.rect.w
    ) {
      color = vec3f(0.16, 0.24, 0.34);
    }
  }

  let receiver = vec2f(settings.receiverX, settings.receiverY);
  color = mix(color, vec3f(1.0, 0.84, 0.56), circleMask(roomUv, receiver, 0.012));

  for (var lightIndex = 0u; lightIndex < u32(settings.lightCount); lightIndex += 1u) {
    let light = lights[lightIndex];
    let contribution = evaluateContribution(receiver, lightIndex);
    let normalized = contribution / max(estimate.maxContribution, 1e-4);
    let base = vec3f(0.18, 0.24, 0.32) + light.color * (0.18 + normalized * 0.42);
    let selected =
      (panelIndex == 0 && lightIndex == u32(floor(hash11(settings.seed + 0.37) * settings.lightCount))) ||
      (panelIndex == 1 && lightIndex == estimate.selectedIndex) ||
      (panelIndex == 2 && lightIndex == estimate.maxIndex);
    let mask = circleMask(roomUv, light.position, 0.018 + light.radius * 0.35);
    color = mix(color, select(base, vec3f(1.0, 0.94, 0.72), selected), mask);

    if (panelIndex == 1 && candidateMatch(lightIndex)) {
      let ring = smoothstep(0.026, 0.023, abs(length(roomUv - light.position) - (0.024 + light.radius * 0.35)));
      color = mix(color, vec3f(0.48, 0.86, 1.0), ring);
    }
  }

  return color;
}

fn barsColor(panelIndex: i32, localUv: vec2f, estimate: EstimateResult) -> vec3f {
  var color = vec3f(0.05, 0.08, 0.12);
  let index = u32(clamp(floor(localUv.x * settings.lightCount), 0.0, settings.lightCount - 1.0));
  let contribution = evaluateContribution(vec2f(settings.receiverX, settings.receiverY), index);
  let barHeight = contribution / max(estimate.maxContribution, 1e-4);
  let insideBar = localUv.y >= 1.0 - barHeight;
  let selected =
    (panelIndex == 0 && index == u32(floor(hash11(settings.seed + 0.37) * settings.lightCount))) ||
    (panelIndex == 1 && index == estimate.selectedIndex) ||
    (panelIndex == 2 && index == estimate.maxIndex);
  let candidate = panelIndex == 1 && candidateMatch(index);
  if (insideBar) {
    if (selected) {
      color = vec3f(1.0, 0.94, 0.72);
    } else if (candidate) {
      color = vec3f(0.5, 0.86, 1.0);
    } else {
      color = vec3f(0.35, 0.44, 0.58);
    }
  }
  let divider = smoothstep(0.003, 0.0, abs(fract(localUv.x * settings.lightCount) - 0.5));
  color = mix(color, vec3f(0.1, 0.14, 0.18), divider * 0.2);
  return color;
}

@vertex
fn vsFullscreen(@builtin(vertex_index) vertexIndex: u32) -> @builtin(position) vec4f {
  let x = f32((vertexIndex << 1u) & 2u);
  let y = f32(vertexIndex & 2u);
  return vec4f(x * 2.0 - 1.0, 1.0 - y * 2.0, 0.0, 1.0);
}

@fragment
fn fsVisualize(@builtin(position) position: vec4f) -> @location(0) vec4f {
  let uv = position.xy / settings.renderSize;
  let panel = panelInfo(uv);
  let panelIndex = i32(panel.x);
  let panelUv = panel.yz;
  let receiver = vec2f(settings.receiverX, settings.receiverY);
  let estimate = buildEstimate(receiver);
  var color = vec3f(0.03, 0.05, 0.08);

  if (panelUv.y < 0.6) {
    let localUv = vec2f(panelUv.x, panelUv.y / 0.6);
    color = roomColor(panelIndex, localUv, estimate);
  } else {
    let localUv = vec2f(panelUv.x, (panelUv.y - 0.66) / 0.26);
    color = barsColor(panelIndex, clamp(localUv, vec2f(0.0), vec2f(1.0)), estimate);
  }

  let divider = smoothstep(0.006, 0.0, abs(fract(uv.x * PANEL_COUNT) - 0.0));
  color = mix(color, vec3f(0.95, 0.7, 0.48), divider * 0.55);
  return vec4f(color, 1.0);
}

@fragment
fn fsPresent(@builtin(position) position: vec4f) -> @location(0) vec4f {
  let uv = position.xy / presentUniforms.displaySize;
  let color = textureSampleLevel(sourceTexture, sourceSampler, uv, 0.0).rgb;
  return vec4f(color, 1.0);
}
