struct Uniforms {
  modelViewProjectionMatrix: mat4x4f,
  modelMatrix: mat4x4f,
  baseColor: vec4f,
  lightDirection: vec4f,
};

@group(0) @binding(0) var<uniform> uniforms: Uniforms;

struct VertexInput {
  @location(0) position: vec3f,
  @location(1) normal: vec3f,
};

struct VertexOutput {
  @builtin(position) clipPosition: vec4f,
  @location(0) worldNormal: vec3f,
  @location(1) color: vec4f,
};

@vertex
fn vsMain(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;
  output.clipPosition =
    uniforms.modelViewProjectionMatrix * vec4f(input.position, 1.0);
  output.worldNormal =
    normalize((uniforms.modelMatrix * vec4f(input.normal, 0.0)).xyz);
  output.color = uniforms.baseColor;
  return output;
}
