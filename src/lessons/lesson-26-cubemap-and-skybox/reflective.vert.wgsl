struct FrameUniforms {
  viewProjectionMatrix: mat4x4f,
  skyboxViewProjectionMatrix: mat4x4f,
  cameraPosition: vec4f,
  lightDirection: vec4f,
}

struct ObjectUniforms {
  modelMatrix: mat4x4f,
  baseColor: vec4f,
  materialParams: vec4f,
}

@group(0) @binding(0) var<uniform> frameUniforms: FrameUniforms;
@group(2) @binding(0) var<uniform> objectUniforms: ObjectUniforms;

struct VertexInput {
  @location(0) position: vec3f,
  @location(1) normal: vec3f,
}

struct VertexOutput {
  @builtin(position) clipPosition: vec4f,
  @location(0) worldPosition: vec3f,
  @location(1) worldNormal: vec3f,
}

@vertex
fn vsMain(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;
  let worldPosition = objectUniforms.modelMatrix * vec4f(input.position, 1.0);
  let worldNormal = normalize((objectUniforms.modelMatrix * vec4f(input.normal, 0.0)).xyz);

  output.clipPosition = frameUniforms.viewProjectionMatrix * worldPosition;
  output.worldPosition = worldPosition.xyz;
  output.worldNormal = worldNormal;
  return output;
}
