struct Uniforms {
  modelViewProjectionMatrix: mat4x4f,
};

struct VertexInput {
  @location(0) position: vec3f,
  @location(1) color: vec3f,
};

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) color: vec3f,
};

@group(0) @binding(0) var<uniform> uniforms: Uniforms;

@vertex
fn vsMain(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;
  output.position = uniforms.modelViewProjectionMatrix * vec4f(input.position, 1.0);
  output.color = input.color;
  return output;
}

@fragment
fn fsMain(input: VertexOutput) -> @location(0) vec4f {
  return vec4f(input.color, 1.0);
}
