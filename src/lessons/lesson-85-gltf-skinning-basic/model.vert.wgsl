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

const MAX_JOINTS = 16u;

struct SkinUniforms {
  jointMatrices: array<mat4x4f, MAX_JOINTS>,
};

@group(0) @binding(0) var<uniform> frameUniforms: FrameUniforms;
@group(1) @binding(0) var<uniform> nodeUniforms: NodeUniforms;
@group(2) @binding(0) var<uniform> skinUniforms: SkinUniforms;

struct VertexInput {
  @location(0) position: vec3f,
  @location(1) normal: vec3f,
  @location(2) joints: vec4u,
  @location(3) weights: vec4f,
};

struct VertexOutput {
  @builtin(position) clipPosition: vec4f,
  @location(0) worldNormal: vec3f,
  @location(1) baseColor: vec3f,
};

@vertex
fn vsMain(input: VertexInput) -> VertexOutput {
  let skinMatrix =
    input.weights.x * skinUniforms.jointMatrices[input.joints.x] +
    input.weights.y * skinUniforms.jointMatrices[input.joints.y] +
    input.weights.z * skinUniforms.jointMatrices[input.joints.z] +
    input.weights.w * skinUniforms.jointMatrices[input.joints.w];

  let skinnedPosition = skinMatrix * vec4f(input.position, 1.0);
  let skinnedNormal = normalize((skinMatrix * vec4f(input.normal, 0.0)).xyz);
  let worldPosition = nodeUniforms.modelMatrix * skinnedPosition;
  let worldNormal = normalize((nodeUniforms.modelMatrix * vec4f(skinnedNormal, 0.0)).xyz);

  var output: VertexOutput;
  output.clipPosition = frameUniforms.viewProjectionMatrix * worldPosition;
  output.worldNormal = worldNormal;
  output.baseColor = nodeUniforms.baseColor;
  return output;
}
