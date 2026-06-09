@group(0) @binding(0) var textureSampler: sampler;
@group(0) @binding(1) var computedTexture: texture_2d<f32>;

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
};

@vertex
fn vsMain(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
  var positions = array<vec2f, 3>(
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

@fragment
fn fsMain(input: VertexOutput) -> @location(0) vec4f {
  let color = textureSample(computedTexture, textureSampler, input.uv);
  let grid = min(
    smoothstep(0.0, 0.015, abs(fract(input.uv.x * 16.0) - 0.5)),
    smoothstep(0.0, 0.015, abs(fract(input.uv.y * 16.0) - 0.5))
  );
  return vec4f(color.rgb * (0.86 + grid * 0.14), 1.0);
}
