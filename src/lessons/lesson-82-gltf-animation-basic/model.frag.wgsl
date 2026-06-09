struct FrameUniforms {
  viewProjectionMatrix: mat4x4f,
  lightDirection: vec3f,
  _padding: f32,
};

@group(0) @binding(0) var<uniform> frameUniforms: FrameUniforms;

@fragment
fn fsMain(
  @location(0) worldNormal: vec3f,
  @location(1) baseColor: vec3f,
) -> @location(0) vec4f {
  let normal = normalize(worldNormal);
  let lightDirection = normalize(frameUniforms.lightDirection);
  let diffuse = max(dot(normal, lightDirection), 0.0);
  let ambient = 0.22;
  let shadedColor = baseColor * (ambient + diffuse * 0.78);
  return vec4f(shadedColor, 1.0);
}
