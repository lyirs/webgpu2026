struct FrameUniforms {
  viewProjectionMatrix: mat4x4f,
  lightDirection: vec3f,
  _padding: f32,
};

struct NodeUniforms {
  modelMatrix: mat4x4f,
  baseColor: vec3f,
  _padding: f32,
};

@group(0) @binding(0) var<uniform> frameUniforms: FrameUniforms;
@group(1) @binding(0) var<uniform> nodeUniforms: NodeUniforms;

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
  let worldPosition = nodeUniforms.modelMatrix * vec4f(input.position, 1.0);
  let worldNormal = normalize((nodeUniforms.modelMatrix * vec4f(input.normal, 0.0)).xyz);

  var output: VertexOutput;
  output.clipPosition = frameUniforms.viewProjectionMatrix * worldPosition;
  output.worldNormal = worldNormal;
  output.baseColor = nodeUniforms.baseColor;
  return output;
}
