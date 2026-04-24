struct ObjectUniforms {
  modelViewProjectionMatrix: mat4x4f,
  modelMatrix: mat4x4f,
  color: vec4f,
  lightDirection: vec4f,
}

@group(0) @binding(0) var<uniform> objectUniforms: ObjectUniforms;

@fragment
fn fsMain() -> @location(0) vec4f {
  return objectUniforms.color;
}
