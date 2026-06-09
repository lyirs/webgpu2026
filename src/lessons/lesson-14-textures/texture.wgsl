struct VertexInput {
  @location(0) position: vec2f,
  @location(1) uv: vec2f,
}

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
}

@group(0) @binding(0) var textureSampler: sampler;
@group(0) @binding(1) var textureData: texture_2d<f32>;

@vertex
fn vsMain(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;
  output.position = vec4f(input.position, 0.0, 1.0);
  output.uv = input.uv;
  return output;
}

@fragment
fn fsMain(input: VertexOutput) -> @location(0) vec4f {
  return textureSample(textureData, textureSampler, input.uv);
}
