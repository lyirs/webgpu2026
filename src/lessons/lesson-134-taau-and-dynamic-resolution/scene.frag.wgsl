struct FrameUniforms {
  currentViewProjectionMatrix: mat4x4f,
  previousViewProjectionMatrix: mat4x4f,
  lightDirection: vec4f,
};

struct FragmentOutput {
  @location(0) color: vec4f,
  @location(1) velocity: vec4f,
};

@group(0) @binding(0) var<uniform> frameUniforms: FrameUniforms;

fn clipToUv(clipPosition: vec4f) -> vec2f {
  let ndc = clipPosition.xy / max(clipPosition.w, 0.0001);
  return vec2f(ndc.x * 0.5 + 0.5, ndc.y * -0.5 + 0.5);
}

@fragment
fn fsMain(
  @location(0) color: vec4f,
  @location(1) normal: vec3f,
  @location(2) currentClip: vec4f,
  @location(3) previousClip: vec4f
) -> FragmentOutput {
  let diffuse = max(dot(normalize(normal), -normalize(frameUniforms.lightDirection.xyz)), 0.0);
  let litColor = color.rgb * (0.24 + diffuse * 0.86);
  let currentUv = clipToUv(currentClip);
  let previousUv = clipToUv(previousClip);

  var output: FragmentOutput;
  output.color = vec4f(litColor, 1.0);
  output.velocity = vec4f(currentUv - previousUv, 0.0, 1.0);
  return output;
}
