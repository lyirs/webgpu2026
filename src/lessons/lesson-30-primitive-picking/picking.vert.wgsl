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
}

@vertex
fn vsMain(input: VertexInput) -> @builtin(position) vec4f {
  let worldPosition = objectUniforms.modelMatrix * vec4f(input.position, 1.0);
  return frameUniforms.viewProjectionMatrix * worldPosition;
}
