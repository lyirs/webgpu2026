struct FrameUniforms {
  viewProjectionMatrix: mat4x4f,
  lightDirection: vec4f,
};

@group(0) @binding(0) var<uniform> frameUniforms: FrameUniforms;

struct FragmentInput {
  @location(0) worldNormal: vec3f,
};

@fragment
fn fsMain(input: FragmentInput) -> @location(0) vec4f {
  let normal = normalize(input.worldNormal);
  let lightDirection = normalize(frameUniforms.lightDirection.xyz);
  let diffuse = max(dot(normal, lightDirection), 0.0);
  let ambient = 0.18;
  let baseColor = vec3f(0.82, 0.84, 0.9);
  let lighting = ambient + diffuse * 0.82;
  return vec4f(baseColor * lighting, 1.0);
}
