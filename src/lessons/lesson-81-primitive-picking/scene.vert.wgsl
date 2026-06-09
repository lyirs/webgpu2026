struct FrameUniforms {
  viewProjectionMatrix: mat4x4f,
  lightDirection: vec4f,
}

struct ObjectUniforms {
  modelMatrix: mat4x4f,
  baseColor: vec4f,
  pickingColor: vec4f,
  selectionState: vec4f,
}

@group(0) @binding(0) var<uniform> frameUniforms: FrameUniforms;
@group(1) @binding(0) var<uniform> objectUniforms: ObjectUniforms;

struct VertexInput {
  @location(0) position: vec3f,
  @location(1) normal: vec3f,
}

struct VertexOutput {
  @builtin(position) clipPosition: vec4f,
  @location(0) worldNormal: vec3f,
  @location(1) baseColor: vec4f,
  @location(2) selectionState: vec4f,
}

@vertex
fn vsMain(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;
  let worldPosition = objectUniforms.modelMatrix * vec4f(input.position, 1.0);
  output.clipPosition = frameUniforms.viewProjectionMatrix * worldPosition;
  output.worldNormal =
    normalize((objectUniforms.modelMatrix * vec4f(input.normal, 0.0)).xyz);
  output.baseColor = objectUniforms.baseColor;
  output.selectionState = objectUniforms.selectionState;
  return output;
}
