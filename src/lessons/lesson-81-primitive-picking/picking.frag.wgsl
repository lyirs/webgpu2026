struct ObjectUniforms {
  modelMatrix: mat4x4f,
  baseColor: vec4f,
  pickingColor: vec4f,
  selectionState: vec4f,
}

@group(1) @binding(0) var<uniform> objectUniforms: ObjectUniforms;

@fragment
fn fsMain() -> @location(0) vec4f {
  return objectUniforms.pickingColor;
}
