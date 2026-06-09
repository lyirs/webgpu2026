struct LessonSettings {
  canvasSize: vec2f,
  roughness: f32,
  sampleCount: f32,
  lightSize: f32,
  time: f32,
  freezeSeed: f32,
  _padding: vec2f,
};

@group(0) @binding(0) var<uniform> settings: LessonSettings;

fn hash21(value: vec2f) -> f32 {
  return fract(sin(dot(value, vec2f(127.1, 311.7))) * 43758.5453123);
}

fn panelInfo(uv: vec2f) -> vec3f {
  let scaled = uv.x * 3.0;
  return vec3f(floor(scaled), fract(scaled), uv.y);
}

fn highlightCenter() -> vec2f {
  return vec2f(0.72, 0.3);
}

fn highlightValue(p: vec2f, roughness: f32, lightSize: f32) -> f32 {
  let delta = p - highlightCenter();
  let radius = roughness * 0.28 + lightSize * 0.16;
  return exp(-dot(delta, delta) / max(radius * radius, 1e-4));
}

fn drawLobe(panelIndex: i32, localUv: vec2f) -> vec3f {
  var color = vec3f(0.05, 0.08, 0.12);
  if (!(localUv.y > 0.12 && localUv.y < 0.55)) {
    return color;
  }
  let lobeUv = vec2f(localUv.x, (localUv.y - 0.12) / 0.43);
  let center = vec2f(0.5, 0.9);
  let radial = distance(lobeUv, center);
  if (radial > 0.82) {
    return color;
  }

  let highlight = highlightValue(lobeUv, settings.roughness, settings.lightSize);
  let noise = hash21(lobeUv * (settings.sampleCount * 0.75 + 12.0) + vec2f(settings.time, f32(panelIndex))) - 0.5;
  var intensity = 0.0;
  if (panelIndex == 0) {
    intensity = 0.25 + max(lobeUv.y, 0.0) * 0.18 + noise * 0.18;
  } else if (panelIndex == 1) {
    intensity = highlight + noise * (0.28 - settings.roughness * 0.18);
  } else {
    intensity = mix(0.25 + max(lobeUv.y, 0.0) * 0.12, highlight, 0.58) + noise * 0.08;
  }
  intensity = clamp(intensity, 0.0, 1.1);
  let base = select(
    vec3f(0.72, 0.56, 0.32),
    select(vec3f(0.72, 0.74, 0.82), vec3f(0.58, 0.88, 1.0), panelIndex == 2),
    panelIndex > 0
  );
  return mix(color, base, intensity);
}

fn glossyPatch(panelIndex: i32, localUv: vec2f) -> vec3f {
  var color = vec3f(0.05, 0.08, 0.12);
  if (!(localUv.y > 0.62 && localUv.y < 0.92)) {
    return color;
  }
  let patchUv = vec2f(localUv.x, (localUv.y - 0.62) / 0.30);
  let gloss = highlightValue(patchUv, settings.roughness, settings.lightSize);
  let variance = 1.0 / max(settings.sampleCount, 1.0);
  let stochastic = (hash21(patchUv * 133.0 + vec2f(settings.time * 9.0, f32(panelIndex) * 7.0)) - 0.5);
  var noiseScale = 0.24;
  if (panelIndex == 1) {
    noiseScale = 0.18 - settings.roughness * 0.08;
  } else if (panelIndex == 2) {
    noiseScale = 0.10 - settings.roughness * 0.04;
  }
  let energy = select(
    0.18 + gloss * 0.56,
    select(0.14 + gloss * 0.92, 0.18 + gloss * 0.84, panelIndex == 2),
    panelIndex > 0
  );
  let value = clamp(energy + stochastic * noiseScale + variance * 0.4, 0.0, 1.2);
  let tint = select(
    vec3f(0.74, 0.60, 0.34),
    select(vec3f(0.74, 0.80, 0.92), vec3f(0.58, 0.9, 1.0), panelIndex == 2),
    panelIndex > 0
  );
  return mix(color, tint, value);
}

@vertex
fn vsFullscreen(@builtin(vertex_index) vertexIndex: u32) -> @builtin(position) vec4f {
  let x = f32((vertexIndex << 1u) & 2u);
  let y = f32(vertexIndex & 2u);
  return vec4f(x * 2.0 - 1.0, 1.0 - y * 2.0, 0.0, 1.0);
}

@fragment
fn fsVisualize(@builtin(position) position: vec4f) -> @location(0) vec4f {
  let uv = position.xy / settings.canvasSize;
  let panel = panelInfo(uv);
  let panelIndex = i32(panel.x);
  let localUv = panel.yz;
  var color = drawLobe(panelIndex, localUv);
  color = mix(color, glossyPatch(panelIndex, localUv), select(0.0, 1.0, localUv.y > 0.62));
  let dividerA = smoothstep(0.002, 0.0, abs(uv.x - 1.0 / 3.0));
  let dividerB = smoothstep(0.002, 0.0, abs(uv.x - 2.0 / 3.0));
  color = mix(color, vec3f(1.0, 0.72, 0.46), clamp(dividerA + dividerB, 0.0, 1.0) * 0.54);
  return vec4f(color, 1.0);
}
