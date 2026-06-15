requires texture_and_sampler_let;

struct Params {
  frame: f32,
  featureMode: f32,
  transientMode: f32,
  compatibilityMode: f32,
};

struct VertexOut {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
};

struct FragmentOut {
  @location(0) color: vec4f,
  @location(1) transientDebug: vec4f,
};

@group(0) @binding(0) var sourceTexture: texture_2d<f32>;
@group(0) @binding(1) var sourceSampler: sampler;
@group(0) @binding(2) var<uniform> params: Params;

@vertex
fn vsFullscreen(@builtin(vertex_index) vertexIndex: u32) -> VertexOut {
  var positions = array<vec2f, 3>(
    vec2f(-1.0, -1.0),
    vec2f(3.0, -1.0),
    vec2f(-1.0, 3.0)
  );

  let position = positions[vertexIndex];
  var out: VertexOut;
  out.position = vec4f(position, 0.0, 1.0);
  out.uv = position * 0.5 + vec2f(0.5);
  return out;
}

@fragment
fn fsTextureSamplerLet(input: VertexOut) -> FragmentOut {
  if (input.uv.x < 0.5) {
    discard;
  }

  let panelUv = vec2f((input.uv.x - 0.5) * 2.0, input.uv.y);
  let localTexture = sourceTexture;
  let localSampler = sourceSampler;
  let movingUv = vec2f(fract(panelUv.x + params.frame * 0.045), panelUv.y);
  let texel = textureSample(localTexture, localSampler, movingUv).rgb;
  let pulse = 0.5 + 0.5 * sin((panelUv.x - panelUv.y + params.frame * 0.16) * 22.0);
  let color = mix(texel, vec3f(0.24, 0.92, 0.72), pulse * 0.22);

  var out: FragmentOut;
  out.color = vec4f(color, 1.0);
  out.transientDebug = vec4f(0.10, 0.62 + params.transientMode * 0.28, 0.36, 1.0);
  return out;
}
