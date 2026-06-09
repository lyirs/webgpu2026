struct SceneUniforms {
  viewProjectionMatrix: mat4x4f,
  eyePosition: vec4f,
  lightPosition: vec4f,
  volumeParams: vec4f,
  animationParams: vec4f,
};

struct ObjectUniforms {
  modelMatrix: mat4x4f,
  color: vec4f,
  surfaceParams: vec4f,
};

struct VertexInput {
  @location(0) position: vec3f,
  @location(1) normal: vec3f,
};

struct VertexOutput {
  @builtin(position) clipPosition: vec4f,
  @location(0) worldPosition: vec3f,
  @location(1) worldNormal: vec3f,
  @location(2) localPosition: vec3f,
  @location(3) objectColor: vec4f,
  @location(4) surfaceParams: vec4f,
};

@group(0) @binding(0) var<uniform> sceneUniforms: SceneUniforms;
@group(1) @binding(0) var<uniform> objectUniforms: ObjectUniforms;

@vertex
fn main(input: VertexInput) -> VertexOutput {
  let worldPosition = objectUniforms.modelMatrix * vec4f(input.position, 1.0);
  let worldNormal = normalize((objectUniforms.modelMatrix * vec4f(input.normal, 0.0)).xyz);

  var output: VertexOutput;
  output.clipPosition = sceneUniforms.viewProjectionMatrix * worldPosition;
  output.worldPosition = worldPosition.xyz;
  output.worldNormal = worldNormal;
  output.localPosition = input.position;
  output.objectColor = objectUniforms.color;
  output.surfaceParams = objectUniforms.surfaceParams;
  return output;
}
