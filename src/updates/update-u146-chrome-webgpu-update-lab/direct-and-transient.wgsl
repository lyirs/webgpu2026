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

fn sampleUpdatePattern(uv: vec2f) -> vec3f {
  let movingUv = vec2f(fract(uv.x + params.frame * 0.045), uv.y);
  let texel = textureSample(sourceTexture, sourceSampler, movingUv).rgb;
  let bands = 0.5 + 0.5 * sin((uv.x + uv.y + params.frame * 0.12) * 24.0);
  return mix(texel, vec3f(0.10, 0.48, 0.92), bands * 0.18);
}

@fragment
fn fsDirect(input: VertexOut) -> FragmentOut {
  if (input.uv.x > 0.5) {
    discard;
  }

  let panelUv = vec2f(input.uv.x * 2.0, input.uv.y);
  let color = sampleUpdatePattern(panelUv);

  var out: FragmentOut;
  out.color = vec4f(color * vec3f(0.82, 0.92, 1.0), 1.0);
  out.transientDebug = vec4f(0.08, 0.30 + params.transientMode * 0.50, 0.84, 1.0);
  return out;
}

@fragment
fn fsFallbackRight(input: VertexOut) -> FragmentOut {
  if (input.uv.x < 0.5) {
    discard;
  }

  let panelUv = vec2f((input.uv.x - 0.5) * 2.0, input.uv.y);
  let color = sampleUpdatePattern(panelUv);
  let compatibilityTint = vec3f(0.82, 0.62 + params.compatibilityMode * 0.22, 0.28);

  var out: FragmentOut;
  out.color = vec4f(mix(color, compatibilityTint, 0.22), 1.0);
  out.transientDebug = vec4f(0.42, 0.28 + params.transientMode * 0.42, 0.12, 1.0);
  return out;
}
