struct FragmentInput {
  @location(0) worldNormal: vec3f,
  @location(1) baseColor: vec4f,
  @location(2) selectionState: vec4f,
}

struct FrameUniforms {
  viewProjectionMatrix: mat4x4f,
  lightDirection: vec4f,
}

@group(0) @binding(0) var<uniform> frameUniforms: FrameUniforms;

@fragment
fn fsMain(input: FragmentInput) -> @location(0) vec4f {
  let normal = normalize(input.worldNormal);
  let lightDirection = normalize(-frameUniforms.lightDirection.xyz);
  let lambert = max(dot(normal, lightDirection), 0.0);
  let baseColor = input.baseColor.rgb * (0.24 + lambert * 0.76);
  let highlight = vec3f(1.0, 0.86, 0.36) * input.selectionState.x;
  let finalColor = baseColor + highlight * 0.48;
  return vec4f(finalColor, 1.0);
}
