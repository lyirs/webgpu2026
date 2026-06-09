struct Params {
  time: f32,
  pulse: f32,
  textureIndex: f32,
  padding: f32,
};

@group(0) @binding(0) var<uniform> params: Params;
@group(0) @binding(1) var demoSampler: sampler;
@group(0) @binding(2) var demoTexture: texture_2d<f32>;

struct VertexOut {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
};

@vertex
fn vsMain(@builtin(vertex_index) vertexIndex: u32) -> VertexOut {
  var positions = array<vec2f, 3>(
    vec2f(-1.0, -1.0),
    vec2f(3.0, -1.0),
    vec2f(-1.0, 3.0),
  );
  let position = positions[vertexIndex];
  var out: VertexOut;
  out.position = vec4f(position, 0.0, 1.0);
  out.uv = position * 0.5 + vec2f(0.5);
  return out;
}

@fragment
fn fsMain(input: VertexOut) -> @location(0) vec4f {
  let uv = input.uv;
  let sampleColor = textureSample(demoTexture, demoSampler, uv).rgb;
  let wave = 0.5 + 0.5 * sin(params.time * 4.0 + uv.x * 10.0);
  let tint = mix(sampleColor, vec3f(0.2, 0.85, 1.0), 0.18 + params.pulse * 0.22);
  return vec4f(tint * (0.72 + 0.28 * wave), 1.0);
}
