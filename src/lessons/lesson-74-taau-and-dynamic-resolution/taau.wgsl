struct TaauUniforms {
  internalInvTexelSize: vec2f,
  historyBlend: f32,
  sharpen: f32,
  historyValid: f32,
  _padding: vec3f,
};

@group(0) @binding(0) var lowColorTexture: texture_2d<f32>;
@group(0) @binding(1) var lowVelocityTexture: texture_2d<f32>;
@group(0) @binding(2) var historyTexture: texture_2d<f32>;
@group(0) @binding(3) var linearSampler: sampler;
@group(0) @binding(4) var<uniform> taauUniforms: TaauUniforms;

@group(0) @binding(0) var presentLowColorTexture: texture_2d<f32>;
@group(0) @binding(1) var presentTaauTexture: texture_2d<f32>;
@group(0) @binding(2) var presentSampler: sampler;

fn panelInfo(uv: vec2f, columns: f32) -> vec3f {
  let scaled = uv.x * columns;
  let index = floor(scaled);
  let panelUv = vec2f(fract(scaled), uv.y);
  return vec3f(index, panelUv);
}

@vertex
fn vsFullscreen(@builtin(vertex_index) vertexIndex: u32) -> @builtin(position) vec4f {
  let x = f32((vertexIndex << 1u) & 2u);
  let y = f32(vertexIndex & 2u);
  return vec4f(x * 2.0 - 1.0, 1.0 - y * 2.0, 0.0, 1.0);
}

fn neighborhoodClamp(uv: vec2f, candidate: vec3f) -> vec3f {
  let offsets = array<vec2f, 5>(
    vec2f(0.0, 0.0),
    vec2f(-1.0, 0.0),
    vec2f(1.0, 0.0),
    vec2f(0.0, -1.0),
    vec2f(0.0, 1.0),
  );
  var minColor = vec3f(1000.0);
  var maxColor = vec3f(-1000.0);
  for (var index = 0u; index < 5u; index += 1u) {
    let sampleUv = clamp(
      uv + offsets[index] * taauUniforms.internalInvTexelSize,
      vec2f(0.001),
      vec2f(0.999),
    );
    let sampleColor = textureSampleLevel(lowColorTexture, linearSampler, sampleUv, 0.0).rgb;
    minColor = min(minColor, sampleColor);
    maxColor = max(maxColor, sampleColor);
  }
  return clamp(candidate, minColor, maxColor);
}

@fragment
fn taauFs(@builtin(position) position: vec4f) -> @location(0) vec4f {
  let displaySize = vec2f(textureDimensions(historyTexture));
  let uv = position.xy / displaySize;
  let current = textureSampleLevel(lowColorTexture, linearSampler, uv, 0.0).rgb;
  let velocity = textureSampleLevel(lowVelocityTexture, linearSampler, uv, 0.0).xy;
  let historyUv = clamp(uv - velocity, vec2f(0.001), vec2f(0.999));
  let history = textureSampleLevel(historyTexture, linearSampler, historyUv, 0.0).rgb;

  var accumulated = current;
  if (taauUniforms.historyValid > 0.5) {
    let clampedHistory = neighborhoodClamp(uv, history);
    accumulated = mix(current, clampedHistory, taauUniforms.historyBlend);
  }

  let blurred = (
    textureSampleLevel(lowColorTexture, linearSampler, clamp(uv + vec2f(-1.0, 0.0) * taauUniforms.internalInvTexelSize, vec2f(0.001), vec2f(0.999)), 0.0).rgb +
    textureSampleLevel(lowColorTexture, linearSampler, clamp(uv + vec2f(1.0, 0.0) * taauUniforms.internalInvTexelSize, vec2f(0.001), vec2f(0.999)), 0.0).rgb +
    textureSampleLevel(lowColorTexture, linearSampler, clamp(uv + vec2f(0.0, -1.0) * taauUniforms.internalInvTexelSize, vec2f(0.001), vec2f(0.999)), 0.0).rgb +
    textureSampleLevel(lowColorTexture, linearSampler, clamp(uv + vec2f(0.0, 1.0) * taauUniforms.internalInvTexelSize, vec2f(0.001), vec2f(0.999)), 0.0).rgb
  ) * 0.25;
  let sharpened = accumulated + (current - blurred) * taauUniforms.sharpen * 0.6;
  return vec4f(max(sharpened, vec3f(0.0)), 1.0);
}

@fragment
fn presentFs(@builtin(position) position: vec4f) -> @location(0) vec4f {
  let size = vec2f(textureDimensions(presentTaauTexture));
  let uv = position.xy / size;
  let info = panelInfo(uv, 2.0);
  let panelIndex = i32(info.x);
  let panelUv = info.yz;
  var color = textureSampleLevel(presentLowColorTexture, presentSampler, panelUv, 0.0).rgb;
  if (panelIndex == 1) {
    color = textureSampleLevel(presentTaauTexture, presentSampler, panelUv, 0.0).rgb;
  }
  let separator = smoothstep(0.494, 0.5, abs(fract(uv.x * 2.0) - 0.5));
  color = mix(color, vec3f(1.0, 0.69, 0.4), separator * 0.9);
  return vec4f(color, 1.0);
}
