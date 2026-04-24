struct LessonSettings {
  renderSize: vec2f,
  neighborRadius: f32,
  maxNeighbors: f32,
  compatibility: f32,
  time: f32,
  seed: f32,
  _padding: vec2f,
};

struct PresentUniforms {
  displaySize: vec2f,
  sourceSize: vec2f,
};

struct SurfaceInfo {
  depth: f32,
  roughness: f32,
  owner: f32,
};

struct ReservoirState {
  lightIndex: f32,
  selectedTarget: f32,
  weightSum: f32,
  streamLength: f32,
};

@group(0) @binding(0) var<uniform> settings: LessonSettings;

@group(1) @binding(0) var sourceTexture: texture_2d<f32>;
@group(1) @binding(1) var sourceSampler: sampler;
@group(1) @binding(2) var<uniform> presentUniforms: PresentUniforms;

const PANEL_COUNT = 3.0;
const LIGHT_COUNT = 6u;

fn hash11(value: f32) -> f32 {
  return fract(sin(value * 127.1 + 311.7) * 43758.5453123);
}

fn panelInfo(uv: vec2f) -> vec3f {
  let scaled = uv.x * PANEL_COUNT;
  return vec3f(floor(scaled), fract(scaled), uv.y);
}

fn evaluateSurface(uv: vec2f) -> SurfaceInfo {
  var depth = 1.0;
  var roughness = 0.86;
  var owner = -1.0;
  if (uv.x >= 0.18 && uv.x <= 0.31 && uv.y >= 0.16 && uv.y <= 0.7) {
    depth = 0.34;
    roughness = 0.12;
    owner = 0.0;
  } else if (uv.x >= 0.44 && uv.x <= 0.60 && uv.y >= 0.26 && uv.y <= 0.82) {
    depth = 0.5;
    roughness = 0.42;
    owner = 1.0;
  } else if (uv.x >= 0.72 && uv.x <= 0.86 && uv.y >= 0.12 && uv.y <= 0.48) {
    depth = 0.41;
    roughness = 0.22;
    owner = 2.0;
  }
  return SurfaceInfo(depth, roughness, owner);
}

fn candidateLightPosition(index: u32) -> vec2f {
  let t = select(0.5, f32(index) / f32(LIGHT_COUNT - 1u), LIGHT_COUNT > 1u);
  return vec2f(0.1 + t * 0.8, 0.08 + select(0.0, 0.06, index % 2u == 1u));
}

fn candidateStrength(index: u32) -> f32 {
  return 0.8 + hash11(f32(index) * 7.13) * 0.7;
}

fn candidateLightColor(index: u32) -> vec3f {
  if (index % 3u == 0u) {
    return vec3f(1.0, 0.72, 0.38);
  }
  if (index % 3u == 1u) {
    return vec3f(0.58, 0.82, 1.0);
  }
  return vec3f(1.0, 0.58, 0.84);
}

fn surfaceColor(surface: SurfaceInfo, uv: vec2f) -> vec3f {
  let wall = mix(vec3f(0.9, 0.55, 0.25), vec3f(0.19, 0.18, 0.14), smoothstep(0.2, 0.92, uv.y));
  if (surface.owner < 0.0) {
    return wall;
  }
  if (surface.owner < 0.5) {
    return vec3f(0.12, 0.32, 0.34);
  }
  if (surface.owner < 1.5) {
    return vec3f(0.48, 0.16, 0.19);
  }
  return vec3f(0.16, 0.26, 0.45);
}

fn targetValue(uv: vec2f, surface: SurfaceInfo, lightIndex: u32) -> f32 {
  let light = candidateLightPosition(lightIndex);
  let delta = light - uv;
  let distanceSq = max(dot(delta, delta), 0.003);
  let angular = max(normalize(delta).y * 0.7 + (1.0 - surface.roughness) * 0.3, 0.05);
  let ownerBoost = select(0.94, 1.0, surface.owner >= 0.0);
  return candidateStrength(lightIndex) * ownerBoost * angular / max(distanceSq * (10.0 + surface.depth * 6.0), 0.05);
}

fn emptyReservoir() -> ReservoirState {
  return ReservoirState(-1.0, 0.0, 0.0, 0.0);
}

fn updateReservoirState(
  reservoir: ReservoirState,
  lightIndex: u32,
  selectedTarget: f32,
  rawWeight: f32,
  randomValue: f32
) -> ReservoirState {
  var result = reservoir;
  result.streamLength = result.streamLength + 1.0;
  if (rawWeight <= 0.0 || selectedTarget <= 0.0) {
    return result;
  }
  result.weightSum = result.weightSum + rawWeight;
  if (randomValue * result.weightSum < rawWeight) {
    result.lightIndex = f32(lightIndex);
    result.selectedTarget = selectedTarget;
  }
  return result;
}

fn reservoirEstimate(reservoir: ReservoirState) -> f32 {
  if (reservoir.streamLength <= 0.0) {
    return 0.0;
  }
  return reservoir.weightSum / reservoir.streamLength;
}

fn buildLocalReservoir(uv: vec2f, surface: SurfaceInfo, seedOffset: f32) -> ReservoirState {
  var reservoir = emptyReservoir();
  for (var candidateIndex = 0u; candidateIndex < 4u; candidateIndex += 1u) {
    let randomValue = hash11(seedOffset + f32(candidateIndex) * 1.71);
    let lightIndex = min(u32(floor(hash11(seedOffset + 10.7 + f32(candidateIndex) * 2.31) * f32(LIGHT_COUNT))), LIGHT_COUNT - 1u);
    let targetWeight = targetValue(uv, surface, lightIndex);
    reservoir = updateReservoirState(reservoir, lightIndex, targetWeight, targetWeight, randomValue);
  }
  return reservoir;
}

fn compatibilityScore(a: SurfaceInfo, b: SurfaceInfo) -> f32 {
  let depthScore = 1.0 - min(abs(a.depth - b.depth) * 3.4, 1.0);
  let roughnessScore = 1.0 - min(abs(a.roughness - b.roughness) * 2.8, 1.0);
  let ownerScore = select(0.12, 1.0, abs(a.owner - b.owner) < 0.01);
  return depthScore * roughnessScore * ownerScore;
}

fn mergeReservoir(
  reservoir: ReservoirState,
  source: ReservoirState,
  targetUv: vec2f,
  targetSurface: SurfaceInfo,
  randomValue: f32
) -> ReservoirState {
  if (source.lightIndex < 0.0 || source.streamLength <= 0.0) {
    return reservoir;
  }
  let lightIndex = u32(source.lightIndex);
  let targetWeight = targetValue(targetUv, targetSurface, lightIndex);
  var adjusted = reservoir;
  adjusted.streamLength = adjusted.streamLength + max(source.streamLength - 1.0, 0.0);
  let effectiveSelectionPdf = source.selectedTarget / max(source.weightSum * max(source.streamLength, 1.0), 1e-4);
  let rawWeight = targetWeight / max(effectiveSelectionPdf, 1e-4);
  return updateReservoirState(adjusted, lightIndex, targetWeight, rawWeight, randomValue);
}

fn heatColor(value: f32) -> vec3f {
  let t = clamp(value, 0.0, 1.0);
  return vec3f(0.18 + t * 0.66, 0.16 + t * 0.44, 0.14 + t * 0.24);
}

fn edgeMask(uv: vec2f, minCorner: vec2f, maxCorner: vec2f) -> f32 {
  let inside =
    uv.x >= minCorner.x &&
    uv.x <= maxCorner.x &&
    uv.y >= minCorner.y &&
    uv.y <= maxCorner.y;
  let edgeDistance = min(
    min(abs(uv.x - minCorner.x), abs(uv.x - maxCorner.x)),
    min(abs(uv.y - minCorner.y), abs(uv.y - maxCorner.y))
  );
  return select(0.0, 1.0 - smoothstep(0.002, 0.012, edgeDistance), inside);
}

fn sceneEdgeMask(uv: vec2f) -> f32 {
  let a = edgeMask(uv, vec2f(0.18, 0.16), vec2f(0.31, 0.7));
  let b = edgeMask(uv, vec2f(0.44, 0.26), vec2f(0.60, 0.82));
  let c = edgeMask(uv, vec2f(0.72, 0.12), vec2f(0.86, 0.48));
  return max(max(a, b), c);
}

fn lightOverlay(uv: vec2f) -> vec3f {
  var color = vec3f(0.0);
  for (var lightIndex = 0u; lightIndex < LIGHT_COUNT; lightIndex += 1u) {
    let light = candidateLightPosition(lightIndex);
    let dx = 1.0 - smoothstep(0.018, 0.04, abs(uv.x - light.x));
    let dy = 1.0 - smoothstep(0.01, 0.028, abs(uv.y - light.y));
    color += candidateLightColor(lightIndex) * dx * dy * candidateStrength(lightIndex);
  }
  return color;
}

fn shadeEstimate(value: f32, surface: SurfaceInfo, uv: vec2f) -> vec3f {
  let radiance = clamp(log2(1.0 + value * 0.9) / 2.15, 0.0, 1.0);
  let base = surfaceColor(surface, uv);
  let warmBounce = vec3f(1.0, 0.66, 0.32) * pow(radiance, 1.4) * 0.42;
  let lit = base * (0.36 + radiance * 1.28) + warmBounce;
  return pow(clamp(lit, vec3f(0.0), vec3f(1.0)), vec3f(0.86));
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
  let surface = evaluateSurface(panelUv);
  let baseSeed = settings.seed * 0.37 + settings.time * 3.1;
  let localReservoir = buildLocalReservoir(panelUv, surface, baseSeed + panelUv.x * 11.0 + panelUv.y * 17.0);

  var naiveReservoir = localReservoir;
  var validatedReservoir = localReservoir;
  let radius = max(i32(settings.neighborRadius), 0);
  var accepted = 0.0;
  var validatedAccepted = 0.0;
  var incompatibleReuse = 0.0;

  for (var offsetY = -radius; offsetY <= radius; offsetY += 1) {
    for (var offsetX = -radius; offsetX <= radius; offsetX += 1) {
      if (offsetX == 0 && offsetY == 0) {
        continue;
      }
      if (accepted >= settings.maxNeighbors && validatedAccepted >= settings.maxNeighbors) {
        continue;
      }
      let neighborUv = clamp(
        panelUv + vec2f(f32(offsetX) / 26.0, f32(offsetY) / 18.0),
        vec2f(0.0),
        vec2f(0.9995)
      );
      let neighborSurface = evaluateSurface(neighborUv);
      let neighborReservoir = buildLocalReservoir(
        neighborUv,
        neighborSurface,
        baseSeed + neighborUv.x * 19.0 + neighborUv.y * 23.0
      );
      let score = compatibilityScore(surface, neighborSurface);
      if (accepted < settings.maxNeighbors) {
        naiveReservoir = mergeReservoir(
          naiveReservoir,
          neighborReservoir,
          panelUv,
          surface,
          hash11(baseSeed + f32(offsetX) * 5.1 + f32(offsetY) * 7.3)
        );
        accepted += 1.0;
        incompatibleReuse += select(1.0, 0.0, score >= settings.compatibility);
      }
      if (validatedAccepted < settings.maxNeighbors && score >= settings.compatibility) {
        validatedReservoir = mergeReservoir(
          validatedReservoir,
          neighborReservoir,
          panelUv,
          surface,
          hash11(baseSeed + 31.0 + f32(offsetX) * 3.7 + f32(offsetY) * 5.9)
        );
        validatedAccepted += 1.0;
      }
    }
  }

  var value = reservoirEstimate(localReservoir);
  if (panelIndex == 1) {
    value = reservoirEstimate(naiveReservoir);
  } else if (panelIndex == 2) {
    value = reservoirEstimate(validatedReservoir);
  }

  var color = shadeEstimate(value, surface, panelUv);
  if (panelIndex == 1) {
    let pollution = clamp(incompatibleReuse / max(settings.maxNeighbors, 1.0), 0.0, 1.0);
    color = mix(color, vec3f(1.0, 0.32, 0.14), pollution * 0.42);
  } else if (panelIndex == 2) {
    let stableReuse = clamp(validatedAccepted / max(settings.maxNeighbors, 1.0), 0.0, 1.0);
    color = mix(color, vec3f(0.46, 0.78, 0.92), stableReuse * 0.12);
  }
  color += lightOverlay(panelUv) * 0.6;
  color = mix(color, vec3f(1.0), sceneEdgeMask(panelUv) * 0.48);
  let grid = 1.0 - smoothstep(0.0, 0.03, abs(fract(panelUv.x * 28.0) - 0.5));
  let rowGrid = 1.0 - smoothstep(0.0, 0.03, abs(fract(panelUv.y * 20.0) - 0.5));
  color = mix(color, color * 0.72, max(grid, rowGrid) * 0.12);
  let divider = 1.0 - smoothstep(0.0, 0.006, abs(fract(uv.x * PANEL_COUNT)));
  color = mix(color, vec3f(0.95, 0.7, 0.48), divider * 0.55);
  return vec4f(clamp(color, vec3f(0.0), vec3f(1.0)), 1.0);
}

@fragment
fn fsPresent(@builtin(position) position: vec4f) -> @location(0) vec4f {
  let uv = position.xy / presentUniforms.displaySize;
  let color = textureSampleLevel(sourceTexture, sourceSampler, uv, 0.0).rgb;
  return vec4f(color, 1.0);
}
