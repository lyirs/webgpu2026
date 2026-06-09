struct Uniforms {
  modelViewProjectionMatrix: mat4x4f,
}

struct VertexInput {
  @location(0) position: vec3f,
  @location(1) color: vec3f,
  @location(2) uv: vec2f,
}

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) color: vec3f,
  @location(1) uv: vec2f,
}

@group(0) @binding(0) var<uniform> uniforms: Uniforms;

@vertex
fn vsMain(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;
  output.position = uniforms.modelViewProjectionMatrix * vec4f(input.position, 1.0);
  output.color = input.color;
  output.uv = input.uv;
  return output;
}
