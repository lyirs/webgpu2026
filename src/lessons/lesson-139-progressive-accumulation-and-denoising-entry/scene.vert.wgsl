struct FrameUniforms {
  viewProjectionMatrix: mat4x4f,
  viewMatrix: mat4x4f,
};

struct ObjectUniforms {
  modelMatrix: mat4x4f,
};

struct VertexInput {
  @location(0) position: vec3f,
  @location(1) normal: vec3f,
};

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) worldNormal: vec3f,
  @location(1) viewDepth: f32,
};

@group(0) @binding(0) var<uniform> frameUniforms: FrameUniforms;
@group(0) @binding(1) var<uniform> objectUniforms: ObjectUniforms;

@vertex
fn vsMain(input: VertexInput) -> VertexOutput {
  let worldPosition = objectUniforms.modelMatrix * vec4f(input.position, 1.0);
  let viewPosition = frameUniforms.viewMatrix * worldPosition;
  let worldNormal = normalize((objectUniforms.modelMatrix * vec4f(input.normal, 0.0)).xyz);

  var output: VertexOutput;
  output.position = frameUniforms.viewProjectionMatrix * worldPosition;
  output.worldNormal = worldNormal;
  output.viewDepth = -viewPosition.z;
  return output;
}
