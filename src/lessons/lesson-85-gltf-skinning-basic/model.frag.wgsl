struct FrameUniforms {
  viewProjectionMatrix: mat4x4f,
  lightDirection: vec3f,
  _padding: f32,
};

@group(0) @binding(0) var<uniform> frameUniforms: FrameUniforms;

struct FragmentInput {
  @location(0) worldNormal: vec3f,
  @location(1) baseColor: vec3f,
};

@fragment
fn fsMain(input: FragmentInput) -> @location(0) vec4f {
  let normal = normalize(input.worldNormal);
  let lightDirection = normalize(frameUniforms.lightDirection);
  let lambert = max(dot(normal, lightDirection), 0.0);
  let ambient = 0.24;
  let lighting = ambient + lambert * 0.76;
  return vec4f(input.baseColor * lighting, 1.0);
}
