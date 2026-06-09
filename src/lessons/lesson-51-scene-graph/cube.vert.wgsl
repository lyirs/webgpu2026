struct Uniforms {
  viewProjectionMatrix: mat4x4f,
  worldMatrix: mat4x4f,
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
  @location(1) baseColor: vec3f,
};

@vertex
fn vsMain(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;
  let worldPosition = uniforms.worldMatrix * vec4f(input.position, 1.0);
  output.clipPosition = uniforms.viewProjectionMatrix * worldPosition;
  output.worldNormal = normalize((uniforms.worldMatrix * vec4f(input.normal, 0.0)).xyz);
  output.baseColor = uniforms.baseColor.xyz;
  return output;
}
