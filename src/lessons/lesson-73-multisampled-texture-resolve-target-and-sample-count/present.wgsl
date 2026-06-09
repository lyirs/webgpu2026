@group(0) @binding(0) var sceneSampler: sampler;
@group(0) @binding(1) var singleTexture: texture_2d<f32>;
@group(0) @binding(2) var resolvedTexture: texture_2d<f32>;

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

@fragment
fn fsMain(input: VertexOutput) -> @location(0) vec4f {
  let singleUv = vec2f(input.uv.x * 2.0, input.uv.y);
  let resolvedUv = vec2f((input.uv.x - 0.5) * 2.0, input.uv.y);
  let singleColor = textureSample(singleTexture, sceneSampler, singleUv).rgb;
  let resolvedColor = textureSample(resolvedTexture, sceneSampler, resolvedUv).rgb;
  var color = select(singleColor, resolvedColor, input.uv.x >= 0.5);
  let divider = step(abs(input.uv.x - 0.5), 0.0025);
  color = mix(color, vec3f(0.95, 0.65, 0.38), divider);
  return vec4f(color, 1.0);
}
