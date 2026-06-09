struct RestirSettings {
  gridInfo: vec4f,
  reuseInfo: vec4f,
  sceneInfo: vec4f,
};

struct LightData {
  positionRadius: vec4f,
  colorIntensity: vec4f,
};

struct OccluderData {
  rect: vec4f,
  extras: vec4f,
};

struct Reservoir {
  header: vec4u,
  stats: vec4f,
};

@group(0) @binding(0) var<uniform> settings: RestirSettings;
@group(0) @binding(1) var<storage, read> lights: array<LightData>;
@group(0) @binding(2) var<storage, read> occluders: array<OccluderData>;
@group(0) @binding(3) var<storage, read> temporalReservoirs: array<Reservoir>;
@group(0) @binding(4) var<storage, read> currentSurface: array<vec4f>;
@group(0) @binding(5) var<storage, read_write> finalReservoirs: array<Reservoir>;
@group(0) @binding(6) var<storage, read_write> restirValues: array<vec4f>;

fn gridWidth() -> u32 { return u32(settings.gridInfo.x); }
fn gridHeight() -> u32 { return u32(settings.gridInfo.y); }
fn lightCount() -> u32 { return max(u32(settings.gridInfo.z), 1u); }
fn spatialRadius() -> i32 { return i32(round(settings.reuseInfo.x)); }
fn currentOffset() -> f32 { return settings.reuseInfo.y; }
fn frameTime() -> f32 { return settings.reuseInfo.w; }
fn occluderCount() -> u32 { return u32(settings.sceneInfo.x); }

fn emptyReservoir() -> Reservoir {
  var reservoir: Reservoir;
  reservoir.header = vec4u(0u);
  reservoir.stats = vec4f(0.0, 0.0, 0.0, 1.0);
  return reservoir;
}

fn reservoirWeightSum(reservoir: Reservoir) -> f32 { return reservoir.stats.x; }
fn reservoirStreamLength(reservoir: Reservoir) -> f32 { return reservoir.stats.y; }
fn hasReservoirSample(reservoir: Reservoir) -> bool { return reservoirWeightSum(reservoir) > 0.0; }

fn candidateRawWeight(targetValue: f32, proposalPdf: f32) -> f32 {
  if (targetValue <= 0.0 || proposalPdf <= 0.0) {
    return 0.0;
  }
  return targetValue / proposalPdf;
}

fn updateReservoir(
  reservoir: Reservoir,
  sampleIndex: u32,
  targetValue: f32,
  proposalPdf: f32,
  randomValue: f32
) -> Reservoir {
  let rawWeight = candidateRawWeight(targetValue, proposalPdf);
  var result = reservoir;
  result.stats.y = result.stats.y + 1.0;
  if (rawWeight <= 0.0) {
    return result;
  }
  result.stats.x = result.stats.x + rawWeight;
  let accepted = randomValue * result.stats.x < rawWeight;
  if (accepted) {
    result.header.x = sampleIndex;
    result.stats.z = targetValue;
    result.stats.w = proposalPdf;
  }
  return result;
}

fn randomStep(state: ptr<function, u32>) -> f32 {
  var x = (*state) + 0x9E3779B9u;
  x = (x ^ (x >> 16u)) * 0x85EBCA6Bu;
  x = (x ^ (x >> 13u)) * 0xC2B2AE35u;
  x = x ^ (x >> 16u);
  (*state) = x;
  return f32(x & 0x00FFFFFFu) / f32(0x01000000u);
}

fn segmentIntersectsRect(a: vec2f, b: vec2f, rect: vec4f) -> bool {
  let dx = b.x - a.x;
  let dy = b.y - a.y;
  var t0 = 0.0;
  var t1 = 1.0;
  let edges = array<vec2f, 4>(
    vec2f(-dx, a.x - rect.x),
    vec2f(dx, rect.x + rect.z - a.x),
    vec2f(-dy, a.y - rect.y),
    vec2f(dy, rect.y + rect.w - a.y)
  );
  for (var index = 0u; index < 4u; index += 1u) {
    let p = edges[index].x;
    let q = edges[index].y;
    if (abs(p) < 1e-6) {
      if (q < 0.0) { return false; }
      continue;
    }
    let r = q / p;
    if (p < 0.0) {
      if (r > t1) { return false; }
      if (r > t0) { t0 = r; }
    } else {
      if (r < t0) { return false; }
      if (r < t1) { t1 = r; }
    }
  }
  return t1 > t0;
}

fn evaluateLightContribution(world: vec2f, owner: f32, modulation: f32, lightIndex: u32) -> f32 {
  let light = lights[lightIndex];
  let lightPosition = light.positionRadius.xy;
  for (var index = 0u; index < occluderCount(); index += 1u) {
    if (owner >= 0.0 && abs(owner - f32(index)) < 0.5) {
      continue;
    }
    if (segmentIntersectsRect(world, lightPosition, occluders[index].rect)) {
      return 0.0;
    }
  }
  let delta = lightPosition - world;
  let distanceSq = dot(delta, delta);
  let falloff = 1.0 / max(distanceSq * 12.0, 0.03);
  let luminance = dot(light.colorIntensity.xyz, vec3f(0.3, 0.59, 0.11));
  return light.positionRadius.w * falloff * luminance * (0.74 + light.positionRadius.z * 3.2) * modulation;
}

fn reuseReservoirSampleAtPixel(
  reservoirSample: Reservoir,
  source: Reservoir,
  world: vec2f,
  owner: f32,
  modulation: f32,
  randomValue: f32,
  scale: f32
) -> Reservoir {
  if (!hasReservoirSample(source)) {
    return reservoirSample;
  }
  let sampleIndex = source.header.x;
  if (sampleIndex >= lightCount()) {
    return reservoirSample;
  }
  let contribution = evaluateLightContribution(world, owner, modulation, sampleIndex);
  if (contribution <= 0.0) {
    return reservoirSample;
  }
  let reuseWeight = max(scale, 0.0);
  return updateReservoir(reservoirSample, sampleIndex, contribution * reuseWeight, 1.0, randomValue);
}

fn estimateReservoirLighting(reservoir: Reservoir) -> f32 {
  if (!hasReservoirSample(reservoir)) {
    return 0.0;
  }
  return reservoirWeightSum(reservoir) / max(reservoirStreamLength(reservoir), 1.0);
}

@compute @workgroup_size(8, 8, 1)
fn buildSpatialMain(@builtin(global_invocation_id) globalId: vec3u) {
  if (globalId.x >= gridWidth() || globalId.y >= gridHeight()) {
    return;
  }

  let index = globalId.y * gridWidth() + globalId.x;
  let surface = currentSurface[index];
  let world = vec2f(
    clamp(f32(globalId.x) / max(f32(gridWidth() - 1u), 1.0) + currentOffset(), 0.04, 0.96),
    mix(0.24, 0.9, f32(globalId.y) / max(f32(gridHeight() - 1u), 1.0))
  );

  var rngState = index * 2791u + u32(frameTime()) * 23u + 11u;
  var finalReservoir = temporalReservoirs[index];
  let radius = max(spatialRadius(), 0);

  for (var offsetY = -radius; offsetY <= radius; offsetY += 1) {
    for (var offsetX = -radius; offsetX <= radius; offsetX += 1) {
      if (offsetX == 0 && offsetY == 0) {
        continue;
      }
      let nx = i32(globalId.x) + offsetX;
      let ny = i32(globalId.y) + offsetY;
      if (nx < 0 || ny < 0 || nx >= i32(gridWidth()) || ny >= i32(gridHeight())) {
        continue;
      }
      let neighborIndex = u32(ny) * gridWidth() + u32(nx);
      let neighborSurface = currentSurface[neighborIndex];
      let depthCompatible = abs(surface.x - neighborSurface.x) <= 0.16;
      let modulationCompatible = abs(surface.y - neighborSurface.y) <= 0.18;
      let ownerCompatible = surface.z == neighborSurface.z || (surface.z < 0.0 && neighborSurface.z < 0.0);
      if (!(depthCompatible && modulationCompatible && ownerCompatible)) {
        continue;
      }

      let distance = length(vec2f(f32(offsetX), f32(offsetY)));
      let scale = 0.72 / max(1.0, distance);
      finalReservoir = reuseReservoirSampleAtPixel(
        finalReservoir,
        temporalReservoirs[neighborIndex],
        world,
        surface.z,
        surface.y,
        randomStep(&rngState),
        scale
      );
    }
  }

  finalReservoirs[index] = finalReservoir;
  restirValues[index] = vec4f(estimateReservoirLighting(finalReservoir), 0.0, 0.0, 0.0);
}
