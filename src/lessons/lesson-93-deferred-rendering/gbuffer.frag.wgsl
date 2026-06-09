struct ObjectUniforms {
  modelViewProjectionMatrix: mat4x4f,
  modelMatrix: mat4x4f,
  color: vec4f,
}

struct GBufferOutput {
  @location(0) albedo: vec4f,
  @location(1) normal: vec4f,
  @location(2) worldPosition: vec4f,
}

@group(0) @binding(0) var<uniform> objectUniforms: ObjectUniforms;

@fragment
fn fsMain(
  @location(0) worldPosition: vec3f,
  @location(1) worldNormal: vec3f
) -> GBufferOutput {
  var output: GBufferOutput;
  output.albedo = objectUniforms.color;
  output.normal = vec4f(normalize(worldNormal), 1.0);
  output.worldPosition = vec4f(worldPosition, 1.0);
  return output;
}
