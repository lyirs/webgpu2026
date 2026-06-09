struct TemporalUniforms {
  historyBlend: f32,
  rejectionThreshold: f32,
  disocclusionBias: f32,
  historyValid: f32,
};

struct TemporalOutput {
  @location(0) naive: vec4f,
  @location(1) aware: vec4f,
};

@group(0) @binding(0) var currentColorTexture: texture_2d<f32>;
@group(0) @binding(1) var velocityTexture: texture_2d<f32>;
@group(0) @binding(2) var historyNaiveTexture: texture_2d<f32>;
@group(0) @binding(3) var historyAwareTexture: texture_2d<f32>;
@group(0) @binding(4) var linearSampler: sampler;
@group(0) @binding(5) var<uniform> temporalUniforms: TemporalUniforms;

@group(0) @binding(0) var presentCurrentTexture: texture_2d<f32>;
@group(0) @binding(1) var presentNaiveTexture: texture_2d<f32>;
@group(0) @binding(2) var presentAwareTexture: texture_2d<f32>;
@group(0) @binding(3) var presentSampler: sampler;

fn panelInfo(uv: vec2f, columns: f32) -> vec3f {
  let scaled = uv.x * columns;
  let index = floor(scaled);
  let panelUv = vec2f(fract(scaled), uv.y);
  return vec3f(index, panelUv);
}

fn luma(color: vec3f) -> f32 {
  return dot(color, vec3f(0.299, 0.587, 0.114));
}

@vertex
fn vsFullscreen(@builtin(vertex_index) vertexIndex: u32) -> @builtin(position) vec4f {
  let x = f32((vertexIndex << 1u) & 2u);
  let y = f32(vertexIndex & 2u);
  return vec4f(x * 2.0 - 1.0, 1.0 - y * 2.0, 0.0, 1.0);
}

@fragment
fn accumulateFs(@builtin(position) position: vec4f) -> TemporalOutput {
  let size = vec2f(textureDimensions(currentColorTexture));
  let uv = position.xy / size;
  let currentColor = textureSampleLevel(currentColorTexture, linearSampler, uv, 0.0);
  let velocity = textureSampleLevel(velocityTexture, linearSampler, uv, 0.0).xy;
  let historyUv = clamp(uv - velocity, vec2f(0.001), vec2f(0.999));
  let historyNaive = textureSampleLevel(historyNaiveTexture, linearSampler, historyUv, 0.0);
  let historyAware = textureSampleLevel(historyAwareTexture, linearSampler, historyUv, 0.0);

  if (temporalUniforms.historyValid < 0.5) {
    return TemporalOutput(currentColor, currentColor);
  }

  let naiveColor = mix(currentColor, historyNaive, temporalUniforms.historyBlend);
  let colorDelta = abs(luma(currentColor.rgb) - luma(historyAware.rgb)) +
    distance(currentColor.rgb, historyAware.rgb) * 0.35;
  let rejection = smoothstep(
    temporalUniforms.rejectionThreshold,
    temporalUniforms.rejectionThreshold + temporalUniforms.disocclusionBias,
    colorDelta
  );
  let awareAccumulated = mix(currentColor, historyAware, temporalUniforms.historyBlend);
  let awareColor = mix(awareAccumulated, currentColor, rejection);
  return TemporalOutput(naiveColor, awareColor);
}

@fragment
fn presentFs(@builtin(position) position: vec4f) -> @location(0) vec4f {
  let size = vec2f(textureDimensions(presentCurrentTexture));
  let uv = position.xy / size;
  let info = panelInfo(uv, 3.0);
  let panelIndex = i32(info.x);
  let panelUv = info.yz;

  var color = textureSampleLevel(presentCurrentTexture, presentSampler, panelUv, 0.0).rgb;
  if (panelIndex == 1) {
    color = textureSampleLevel(presentNaiveTexture, presentSampler, panelUv, 0.0).rgb;
  } else if (panelIndex == 2) {
    color = textureSampleLevel(presentAwareTexture, presentSampler, panelUv, 0.0).rgb;
  }

  let separator = smoothstep(0.494, 0.5, abs(fract(uv.x * 3.0) - 0.5));
  color = mix(color, vec3f(1.0, 0.69, 0.4), separator * 0.9);
  return vec4f(color, 1.0);
}
