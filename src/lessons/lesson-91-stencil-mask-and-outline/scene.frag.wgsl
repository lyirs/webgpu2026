struct ObjectUniforms {
  modelViewProjectionMatrix: mat4x4f,
  modelMatrix: mat4x4f,
  color: vec4f,
  lightDirection: vec4f,
}

@group(0) @binding(0) var<uniform> objectUniforms: ObjectUniforms;

@fragment
fn fsMain(@location(0) worldNormal: vec3f) -> @location(0) vec4f {
  let normal = normalize(worldNormal);
  let lightDirection = normalize(objectUniforms.lightDirection.xyz);
  let lambert = max(dot(normal, lightDirection), 0.0);
  let ambient = 0.2;
  let diffuse = ambient + lambert * 0.8;
  return vec4f(objectUniforms.color.rgb * diffuse, objectUniforms.color.a);
}
