struct LessonSettings {
  renderSize: vec2f,
  cameraSpeed: f32,
  historyBlend: f32,
  validationBias: f32,
  time: f32,
  resetHistory: f32,
  _padding: vec2f,
};

struct PresentUniforms {
  displaySize: vec2f,
  sourceSize: vec2f,
};

struct SurfaceInfo {
  depth: f32,
  owner: f32,
  roughness: f32,
  contribution: f32,
};

struct ReservoirInfo {
  sampleIndex: f32,
  selectedTarget: f32,
  weightSum: f32,
  streamLength: f32,
};

struct SceneOutputs {
  @location(0) color: vec4f,
  @location(1) surface: vec4f,
  @location(2) naiveReservoir: vec4f,
  @location(3) validatedReservoir: vec4f,
};

@group(0) @binding(0) var<uniform> settings: LessonSettings;
@group(0) @binding(1) var previousSurfaceTexture: texture_2d<f32>;
@group(0) @binding(2) var previousNaiveTexture: texture_2d<f32>;
@group(0) @binding(3) var previousValidatedTexture: texture_2d<f32>;

@group(0) @binding(0) var sourceTexture: texture_2d<f32>;
@group(0) @binding(1) var sourceSampler: sampler;
@group(0) @binding(2) var<uniform> presentUniforms: PresentUniforms;

const PANEL_COUNT = 3.0;
const LIGHT_COUNT = 24u;
const OWNER_WALL = 20.0;
const OWNER_FLOOR = 21.0;

fn makeSurface(depth: f32, owner: f32, roughness: f32, contribution: f32) -> SurfaceInfo {
  return SurfaceInfo(depth, owner, roughness, contribution);
}

fn emptyReservoir() -> ReservoirInfo {
  return ReservoirInfo(-1.0, 0.0, 0.0, 0.0);
}

fn hash11(value: f32) -> f32 {
  return fract(sin(value * 127.1 + 311.7) * 43758.5453123);
}

fn panelInfo(uv: vec2f) -> vec3f {
  let scaled = uv.x * PANEL_COUNT;
  return vec3f(floor(scaled), fract(scaled), uv.y);
}

fn sceneOffset(time: f32) -> f32 {
  return sin(time * settings.cameraSpeed * 1.28) * 0.11;
}

fn rectContains(uv: vec2f, rect: vec4f) -> bool {
  return uv.x >= rect.x && uv.x <= rect.x + rect.z && uv.y >= rect.y && uv.y <= rect.y + rect.w;
}

fn shiftedRect(base: vec4f, shift: f32) -> vec4f {
  return vec4f(base.x + shift, base.y, base.z, base.w);
}

fn objectRect(index: u32, offset: f32) -> vec4f {
  if (index == 0u) {
    return shiftedRect(vec4f(0.18, 0.18, 0.08, 0.56), -offset * 0.35);
  }
  if (index == 1u) {
    return shiftedRect(vec4f(0.46, 0.16, 0.10, 0.60), -offset * 0.52);
  }
  if (index == 2u) {
    return shiftedRect(vec4f(0.74, 0.18, 0.10, 0.56), -offset * 0.40);
  }
  if (index == 3u) {
    return shiftedRect(vec4f(0.30, 0.60, 0.18, 0.16), -offset * 0.82);
  }
  if (index == 4u) {
    return shiftedRect(vec4f(0.58, 0.56, 0.09, 0.20), -offset * 1.1);
  }
  return shiftedRect(vec4f(0.06, 0.24, 0.12, 0.52), -offset * 1.34);
}

fn motionFactor(owner: f32) -> f32 {
  if (abs(owner - OWNER_WALL) < 0.01 || abs(owner - OWNER_FLOOR) < 0.01) {
    return 0.0;
  }
  if (abs(owner - 0.0) < 0.01) {
    return 0.35;
  }
  if (abs(owner - 1.0) < 0.01) {
    return 0.52;
  }
  if (abs(owner - 2.0) < 0.01) {
    return 0.40;
  }
  if (abs(owner - 3.0) < 0.01) {
    return 0.82;
  }
  if (abs(owner - 4.0) < 0.01) {
    return 1.10;
  }
  return 1.34;
}

fn baseColor(owner: f32, uv: vec2f) -> vec3f {
  if (abs(owner - OWNER_FLOOR) < 0.01) {
    return mix(vec3f(0.15, 0.18, 0.22), vec3f(0.22, 0.26, 0.32), clamp((uv.y - 0.72) * 2.8, 0.0, 1.0));
  }
  if (abs(owner - OWNER_WALL) < 0.01) {
    return mix(vec3f(0.10, 0.13, 0.18), vec3f(0.14, 0.17, 0.22), uv.y);
  }
  if (abs(owner - 0.0) < 0.01) {
    return vec3f(0.43, 0.58, 0.68);
  }
  if (abs(owner - 1.0) < 0.01) {
    return vec3f(0.74, 0.54, 0.42);
  }
  if (abs(owner - 2.0) < 0.01) {
    return vec3f(0.62, 0.64, 0.45);
  }
  if (abs(owner - 3.0) < 0.01) {
    return vec3f(0.24, 0.30, 0.36);
  }
  if (abs(owner - 4.0) < 0.01) {
    return vec3f(0.28, 0.26, 0.22);
  }
  return vec3f(0.12, 0.11, 0.10);
}

fn evaluateSurface(uv: vec2f, offset: f32) -> SurfaceInfo {
  var surface = makeSurface(0.96, OWNER_WALL, 0.92, 0.18);

  if (uv.y > 0.72) {
    surface = makeSurface(0.88, OWNER_FLOOR, 0.84, 0.24);
  }

  if (rectContains(uv, objectRect(0u, offset))) {
    surface = makeSurface(0.68, 0.0, 0.18, 0.58);
  }
  if (rectContains(uv, objectRect(1u, offset))) {
    surface = makeSurface(0.62, 1.0, 0.32, 0.62);
  }
  if (rectContains(uv, objectRect(2u, offset))) {
    surface = makeSurface(0.70, 2.0, 0.22, 0.56);
  }
  if (rectContains(uv, objectRect(3u, offset))) {
    surface = makeSurface(0.46, 3.0, 0.48, 0.72);
  }
  if (rectContains(uv, objectRect(4u, offset))) {
    surface = makeSurface(0.28, 4.0, 0.60, 0.78);
  }
  if (rectContains(uv, objectRect(5u, offset))) {
    surface = makeSurface(0.18, 5.0, 0.78, 0.82);
  }

  return surface;
}

fn lightPosition(index: u32) -> vec2f {
  let t = select(0.5, f32(index) / f32(LIGHT_COUNT - 1u), LIGHT_COUNT > 1u);
  return vec2f(0.1 + t * 0.8, 0.08 + select(0.0, 0.04, index % 2u == 1u));
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

fn occluded(uv: vec2f, owner: f32, light: vec2f, offset: f32) -> bool {
  for (var index = 0u; index < 6u; index += 1u) {
    if (abs(owner - f32(index)) < 0.01) {
      continue;
    }
    if (segmentIntersectsRect(uv, light, objectRect(index, offset))) {
      return true;
    }
  }
  return false;
}

fn targetValue(uv: vec2f, surface: SurfaceInfo, offset: f32, lightIndex: u32) -> f32 {
  let light = lightPosition(lightIndex);
  if (occluded(uv, surface.owner, light, offset)) {
    return 0.0;
  }
  let delta = light - uv;
  let distanceSq = max(dot(delta, delta), 0.002);
  let direction = normalize(delta);
  let angular = max(direction.y * 0.8 + (1.0 - surface.roughness) * 0.2, 0.08);
  let modulation = 0.82 + hash11(f32(lightIndex) * 5.17) * 0.36;
  return surface.contribution * angular * modulation / max(distanceSq * 12.0, 0.05);
}

fn updateReservoirState(
  reservoir: ReservoirInfo,
  lightIndex: u32,
  selectedTarget: f32,
  rawWeight: f32,
  randomValue: f32
) -> ReservoirInfo {
  var result = reservoir;
  result.streamLength = result.streamLength + 1.0;
  if (selectedTarget <= 0.0 || rawWeight <= 0.0) {
    return result;
  }
  result.weightSum = result.weightSum + rawWeight;
  if (randomValue * result.weightSum < rawWeight) {
    result.sampleIndex = f32(lightIndex);
    result.selectedTarget = selectedTarget;
  }
  return result;
}

fn hasReservoirHistory(reservoir: ReservoirInfo) -> bool {
  return reservoir.sampleIndex >= 0.0 && reservoir.streamLength > 0.0 && reservoir.weightSum > 0.0;
}

fn buildLocalReservoir(uv: vec2f, surface: SurfaceInfo, offset: f32, seed: f32) -> ReservoirInfo {
  var reservoir = emptyReservoir();
  for (var candidateIndex = 0u; candidateIndex < 4u; candidateIndex += 1u) {
    let randomValue = hash11(seed + f32(candidateIndex) * 2.13);
    let lightIndex = u32(floor(randomValue * f32(LIGHT_COUNT)));
    let selectedTarget = targetValue(uv, surface, offset, lightIndex);
    reservoir = updateReservoirState(reservoir, lightIndex, selectedTarget, selectedTarget, randomValue);
  }
  return reservoir;
}

fn reservoirEstimate(reservoir: ReservoirInfo) -> f32 {
  if (reservoir.streamLength <= 0.0) {
    return 0.0;
  }
  return reservoir.weightSum / reservoir.streamLength;
}

fn mergeReservoirSample(
  reservoir: ReservoirInfo,
  source: ReservoirInfo,
  targetUv: vec2f,
  targetSurface: SurfaceInfo,
  offset: f32,
  randomValue: f32
) -> ReservoirInfo {
  if (!hasReservoirHistory(source) || settings.historyBlend <= 0.0) {
    return reservoir;
  }
  let lightIndex = min(u32(source.sampleIndex), LIGHT_COUNT - 1u);
  let selectedTarget = targetValue(targetUv, targetSurface, offset, lightIndex);
  var adjusted = reservoir;
  let blendedStreamLength = max(source.streamLength - 1.0, 0.0) * settings.historyBlend;
  adjusted.streamLength = adjusted.streamLength + blendedStreamLength;
  let effectiveSelectionPdf = source.selectedTarget / max(source.weightSum * max(source.streamLength, 1.0), 1e-4);
  let rawWeight = selectedTarget / max(effectiveSelectionPdf, 1e-4) * settings.historyBlend;
  return updateReservoirState(adjusted, lightIndex, selectedTarget, rawWeight, randomValue);
}

fn historyCompatible(currentSurface: SurfaceInfo, previousSurface: vec4f) -> bool {
  return
    abs(currentSurface.depth - previousSurface.x) < (0.05 + settings.validationBias * 0.1) &&
    abs(currentSurface.owner - previousSurface.y) < 0.01;
}

fn hasHistory(previousSurface: vec4f) -> bool {
  return previousSurface.x > 0.01;
}

fn applyLighting(base: vec3f, estimate: f32, uv: vec2f) -> vec3f {
  let ambient = 0.34 + (1.0 - uv.y) * 0.12;
  let lit = ambient + clamp(estimate, 0.0, 1.0) * 1.3;
  return base * lit;
}

fn previousSampleUv(
  panelIndex: i32,
  panelUv: vec2f,
  owner: f32,
  currentOffsetValue: f32,
  previousOffsetValue: f32
) -> vec2f {
  let shift = (currentOffsetValue - previousOffsetValue) * motionFactor(owner);
  let shiftedLocalUv = clamp(panelUv + vec2f(shift, 0.0), vec2f(0.0), vec2f(0.9995, 0.9995));
  return vec2f((f32(panelIndex) + shiftedLocalUv.x) / PANEL_COUNT, shiftedLocalUv.y);
}

fn readHistory(textureData: texture_2d<f32>, uv: vec2f) -> vec4f {
  let clampedUv = clamp(uv, vec2f(0.0), vec2f(0.9995, 0.9995));
  let texel = vec2i(clampedUv * settings.renderSize);
  return textureLoad(textureData, texel, 0);
}

fn readReservoir(textureData: texture_2d<f32>, uv: vec2f) -> ReservoirInfo {
  let reservoir = readHistory(textureData, uv);
  return ReservoirInfo(reservoir.x, reservoir.y, reservoir.z, reservoir.w);
}

@vertex
fn vsFullscreen(@builtin(vertex_index) vertexIndex: u32) -> @builtin(position) vec4f {
  let x = f32((vertexIndex << 1u) & 2u);
  let y = f32(vertexIndex & 2u);
  return vec4f(x * 2.0 - 1.0, 1.0 - y * 2.0, 0.0, 1.0);
}

@fragment
fn fsVisualize(@builtin(position) position: vec4f) -> SceneOutputs {
  let uv = position.xy / settings.renderSize;
  let info = panelInfo(uv);
  let panelIndex = i32(info.x);
  let panelUv = info.yz;

  let currentOffsetValue = sceneOffset(settings.time);
  let previousOffsetValue = sceneOffset(max(settings.time - 0.28, 0.0));
  let currentSurface = evaluateSurface(panelUv, currentOffsetValue);
  let currentReservoir = buildLocalReservoir(
    panelUv,
    currentSurface,
    currentOffsetValue,
    settings.time * 1.87 + f32(panelIndex) * 9.1
  );
  let currentEstimate = reservoirEstimate(currentReservoir);

  var previousSurface = vec4f(0.0);
  var previousNaiveReservoir = emptyReservoir();
  var previousValidatedReservoir = emptyReservoir();
  if (settings.resetHistory < 0.5) {
    let historyUv = previousSampleUv(
      panelIndex,
      panelUv,
      currentSurface.owner,
      currentOffsetValue,
      previousOffsetValue
    );
    previousSurface = readHistory(previousSurfaceTexture, historyUv);
    previousNaiveReservoir = readReservoir(previousNaiveTexture, historyUv);
    previousValidatedReservoir = readReservoir(previousValidatedTexture, historyUv);
  }

  let historyEnabled = settings.resetHistory < 0.5 && hasHistory(previousSurface);
  var naiveReservoir = currentReservoir;
  if (historyEnabled) {
    naiveReservoir = mergeReservoirSample(
      naiveReservoir,
      previousNaiveReservoir,
      panelUv,
      currentSurface,
      currentOffsetValue,
      hash11(settings.time * 7.1 + panelUv.x * 19.7 + panelUv.y * 23.9)
    );
  }
  var validatedReservoir = currentReservoir;
  if (historyEnabled && historyCompatible(currentSurface, previousSurface)) {
    validatedReservoir = mergeReservoirSample(
      validatedReservoir,
      previousValidatedReservoir,
      panelUv,
      currentSurface,
      currentOffsetValue,
      hash11(settings.time * 9.4 + panelUv.x * 17.3 + panelUv.y * 29.1)
    );
  }

  let naiveEstimate = reservoirEstimate(naiveReservoir);
  let validatedEstimate = reservoirEstimate(validatedReservoir);

  var estimate = currentEstimate;
  if (panelIndex == 1) {
    estimate = naiveEstimate;
  } else if (panelIndex == 2) {
    estimate = validatedEstimate;
  }

  var color = applyLighting(baseColor(currentSurface.owner, panelUv), estimate, panelUv);

  let ceilingBand = smoothstep(0.12, 0.0, abs(panelUv.y - 0.08));
  color += vec3f(0.12, 0.08, 0.04) * ceilingBand * 0.35;

  for (var lightIndex = 0u; lightIndex < LIGHT_COUNT; lightIndex += 1u) {
    let light = lightPosition(lightIndex);
    let glow = smoothstep(0.028, 0.0, distance(panelUv, light));
    color = mix(color, vec3f(1.0, 0.88, 0.7), glow * 0.32);
  }

  let wallGrid = smoothstep(0.025, 0.0, abs(fract(panelUv.x * 12.0) - 0.5));
  let floorGrid = smoothstep(0.028, 0.0, abs(fract(panelUv.y * 7.0) - 0.5));
  color = mix(color, color * 0.88, max(wallGrid, floorGrid) * 0.12);

  let divider = smoothstep(0.006, 0.0, abs(fract(uv.x * PANEL_COUNT)));
  color = mix(color, vec3f(0.95, 0.7, 0.48), divider * 0.55);

  var outputs: SceneOutputs;
  outputs.color = vec4f(color, 1.0);
  outputs.surface = vec4f(currentSurface.depth, currentSurface.owner, currentSurface.roughness, currentSurface.contribution);
  outputs.naiveReservoir = vec4f(
    naiveReservoir.sampleIndex,
    naiveReservoir.selectedTarget,
    naiveReservoir.weightSum,
    naiveReservoir.streamLength
  );
  outputs.validatedReservoir = vec4f(
    validatedReservoir.sampleIndex,
    validatedReservoir.selectedTarget,
    validatedReservoir.weightSum,
    validatedReservoir.streamLength
  );
  return outputs;
}

@fragment
fn fsPresent(@builtin(position) position: vec4f) -> @location(0) vec4f {
  let uv = position.xy / presentUniforms.displaySize;
  let color = textureSampleLevel(sourceTexture, sourceSampler, uv, 0.0).rgb;
  return vec4f(color, 1.0);
}
