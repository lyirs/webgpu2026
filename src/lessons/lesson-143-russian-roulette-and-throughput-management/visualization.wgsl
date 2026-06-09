struct LessonSettings {
  canvasSize: vec2f,
  leftRadiance: f32,
  rightRadiance: f32,
  leftPathLength: f32,
  rightPathLength: f32,
  leftThroughput: f32,
  rightThroughput: f32,
  leftRrTerminated: f32,
  rightRrTerminated: f32,
  _padding0: f32,
  _padding1: f32,
  _padding2: f32,
};

@group(0) @binding(0) var<uniform> settings: LessonSettings;
@group(0) @binding(1) var<storage, read> leftHistogram: array<f32>;
@group(0) @binding(2) var<storage, read> rightHistogram: array<f32>;

fn panelInfo(uv: vec2f) -> vec3f {
  let scaled = uv.x * 2.0;
  return vec3f(floor(scaled), fract(scaled), uv.y);
}

fn histogramValue(panelIndex: i32, binIndex: i32) -> f32 {
  let index = u32(clamp(f32(binIndex), 0.0, 12.0));
  return select(leftHistogram[index], rightHistogram[index], panelIndex == 1);
}

fn summaryValue(panelIndex: i32) -> vec4f {
  return select(
    vec4f(settings.leftRadiance, settings.leftPathLength, settings.leftThroughput, settings.leftRrTerminated),
    vec4f(settings.rightRadiance, settings.rightPathLength, settings.rightThroughput, settings.rightRrTerminated),
    panelIndex == 1
  );
}

fn drawHistogram(panelIndex: i32, localUv: vec2f) -> vec3f {
  var color = vec3f(0.05, 0.08, 0.12);
  if (!(localUv.y > 0.12 && localUv.y < 0.58)) {
    return color;
  }
  let chartUv = vec2f(localUv.x, (localUv.y - 0.12) / 0.46);
  let bin = i32(clamp(floor(chartUv.x * 13.0), 0.0, 12.0));
  var maxValue = 1.0;
  for (var index = 0; index < 13; index += 1) {
    maxValue = max(maxValue, histogramValue(panelIndex, index));
  }
  let normalized = histogramValue(panelIndex, bin) / maxValue;
  let inside = chartUv.y >= 1.0 - normalized;
  if (inside) {
    color = select(vec3f(0.78, 0.60, 0.34), vec3f(0.58, 0.9, 1.0), panelIndex == 1);
  } else {
    color = vec3f(0.08, 0.12, 0.18);
  }
  let divider = smoothstep(0.004, 0.0, abs(fract(chartUv.x * 13.0) - 0.5));
  color = mix(color, vec3f(0.12, 0.16, 0.22), divider * 0.16);
  return color;
}

fn drawPatch(panelIndex: i32, localUv: vec2f) -> vec3f {
  var color = vec3f(0.05, 0.08, 0.12);
  if (!(localUv.y > 0.66 && localUv.y < 0.90)) {
    return color;
  }
  let patchUv = vec2f(localUv.x, (localUv.y - 0.66) / 0.24);
  let summary = summaryValue(panelIndex);
  let energy = clamp(summary.x * 0.8, 0.0, 1.2);
  let gradient = mix(0.85, 1.05, patchUv.y) * mix(0.9, 1.1, patchUv.x);
  let tint = select(vec3f(0.84, 0.72, 0.56), vec3f(0.62, 0.84, 1.0), panelIndex == 1);
  color = mix(color, tint, clamp(energy * gradient, 0.0, 1.0));
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
  let uv = position.xy / settings.canvasSize;
  let panel = panelInfo(uv);
  let panelIndex = i32(panel.x);
  let localUv = panel.yz;
  var color = drawHistogram(panelIndex, localUv);
  color = mix(color, drawPatch(panelIndex, localUv), select(0.0, 1.0, localUv.y > 0.66));
  let divider = smoothstep(0.002, 0.0, abs(uv.x - 0.5));
  color = mix(color, vec3f(1.0, 0.72, 0.46), divider * 0.58);
  return vec4f(color, 1.0);
}
