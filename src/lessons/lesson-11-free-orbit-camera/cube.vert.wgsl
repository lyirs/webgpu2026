struct Uniforms {
  modelViewProjectionMatrix: mat4x4f,
  modelMatrix: mat4x4f,
}

struct VertexInput {
  @location(0) position: vec3f,
  @location(1) color: vec3f,
  @location(2) normal: vec3f,
}

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) color: vec3f,
  @location(1) normal: vec3f,
}

@group(0) @binding(0) var<uniform> uniforms: Uniforms;

@vertex
fn vsMain(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;
  output.position = uniforms.modelViewProjectionMatrix * vec4f(input.position, 1.0);
  output.color = input.color;
  output.normal = normalize((uniforms.modelMatrix * vec4f(input.normal, 0.0)).xyz);
  return output;
}
