struct ObjectUniforms {
  modelViewProjectionMatrix: mat4x4f,
  modelViewMatrix: mat4x4f,
  baseColor: vec4f,
};

@group(0) @binding(0) var<uniform> objectUniforms: ObjectUniforms;

struct VertexInput {
  @location(0) position: vec3f,
  @location(1) normal: vec3f,
};

struct VertexOutput {
  @builtin(position) clipPosition: vec4f,
  @location(0) viewPosition: vec3f,
  @location(1) viewNormal: vec3f,
  @location(2) baseColor: vec4f,
};

@vertex
fn vsMain(input: VertexInput) -> VertexOutput {
  let localPosition = vec4f(input.position, 1.0);
  let viewPosition = objectUniforms.modelViewMatrix * localPosition;
  let viewNormal =
    normalize((objectUniforms.modelViewMatrix * vec4f(input.normal, 0.0)).xyz);

  var output: VertexOutput;
  output.clipPosition = objectUniforms.modelViewProjectionMatrix * localPosition;
  output.viewPosition = viewPosition.xyz;
  output.viewNormal = viewNormal;
  output.baseColor = objectUniforms.baseColor;
  return output;
}
