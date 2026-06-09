struct FrameUniforms {
  viewProjectionMatrix: mat4x4f,
  viewMatrix: mat4x4f,
  lightDirection: vec4f,
};

struct ObjectUniforms {
  modelMatrix: mat4x4f,
  color: vec4f,
};

struct VertexInput {
  @location(0) position: vec3f,
  @location(1) normal: vec3f,
};

struct VertexOutput {
  @builtin(position) clipPosition: vec4f,
  @location(0) viewPosition: vec3f,
  @location(1) viewNormal: vec3f,
  @location(2) color: vec4f,
};

@group(0) @binding(0) var<uniform> frameUniforms: FrameUniforms;
@group(1) @binding(0) var<uniform> objectUniforms: ObjectUniforms;

@vertex
fn vsMain(input: VertexInput) -> VertexOutput {
  let worldPosition = objectUniforms.modelMatrix * vec4f(input.position, 1.0);
  let viewPosition = frameUniforms.viewMatrix * worldPosition;
  let viewNormal =
    normalize((frameUniforms.viewMatrix * objectUniforms.modelMatrix * vec4f(input.normal, 0.0)).xyz);

  var output: VertexOutput;
  output.clipPosition = frameUniforms.viewProjectionMatrix * worldPosition;
  output.viewPosition = viewPosition.xyz;
  output.viewNormal = viewNormal;
  output.color = objectUniforms.color;
  return output;
}
