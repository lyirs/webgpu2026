struct Uniforms {
  viewProjectionMatrix: mat4x4f,
  modelMatrix: mat4x4f,
  lightDirection: vec4f,
};

@group(0) @binding(0) var<uniform> uniforms: Uniforms;

struct VertexInput {
  @location(0) position: vec3f,
  @location(1) normal: vec3f,
  @location(2) instanceOffset: vec3f,
  @location(3) instanceColor: vec3f,
};

struct VertexOutput {
  @builtin(position) clipPosition: vec4f,
  @location(0) worldNormal: vec3f,
  @location(1) baseColor: vec3f,
};

@vertex
fn vsMain(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;
  let rotatedPosition = uniforms.modelMatrix * vec4f(input.position, 1.0);
  let worldPosition = vec4f(rotatedPosition.xyz + input.instanceOffset, 1.0);
  output.clipPosition = uniforms.viewProjectionMatrix * worldPosition;
  output.worldNormal = normalize((uniforms.modelMatrix * vec4f(input.normal, 0.0)).xyz);
  output.baseColor = input.instanceColor;
  return output;
}
