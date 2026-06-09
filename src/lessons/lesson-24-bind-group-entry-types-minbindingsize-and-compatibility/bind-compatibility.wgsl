struct Params {
  pulse: f32,
  captured: f32,
  pad0: f32,
  pad1: f32,
};

@group(0) @binding(0) var<uniform> params: Params;
@group(0) @binding(1) var<storage, read> weights: array<f32>;
@group(0) @binding(2) var colorSampler: sampler;
@group(0) @binding(3) var colorTexture: texture_2d<f32>;

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
};

@vertex
fn vsMain(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
  let positions = array<vec2f, 3>(
    vec2f(-1.0, -1.0),
    vec2f(3.0, -1.0),
    vec2f(-1.0, 3.0)
  );
  let position = positions[vertexIndex];
  var output: VertexOutput;
  output.position = vec4f(position, 0.0, 1.0);
  output.uv = position * 0.5 + vec2f(0.5);
  return output;
}

fn barMask(uv: vec2f, index: u32) -> f32 {
  let x0 = 0.12 + f32(index) * 0.19;
  let x1 = x0 + 0.12;
  let height = 0.22 + weights[index] * 0.58;
  let insideX = step(x0, uv.x) * step(uv.x, x1);
  let insideY = step(0.16, uv.y) * step(uv.y, 0.16 + height);
  return insideX * insideY;
}

@fragment
fn fsMain(input: VertexOutput) -> @location(0) vec4f {
  let sample = textureSample(colorTexture, colorSampler, input.uv).rgb;
  var bars = 0.0;
  for (var i = 0u; i < 4u; i += 1u) {
    bars += barMask(input.uv, i);
  }
  let capturedTint = vec3f(0.95, 0.42, 0.22) * params.captured;
  let color = sample * 0.55 + bars * vec3f(0.32, 0.86, 1.0) + capturedTint * (0.35 + 0.15 * sin(params.pulse));
  return vec4f(color, 1.0);
}
