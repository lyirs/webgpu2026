struct FrameUniforms {
  currentViewProjectionMatrix: mat4x4f,
  previousViewProjectionMatrix: mat4x4f,
  lightDirection: vec4f,
};

struct FragmentInput {
  @location(0) worldNormal: vec3f,
  @location(1) baseColor: vec4f,
  @location(2) velocity: vec2f,
};

struct FragmentOutput {
  @location(0) color: vec4f,
  @location(1) velocity: vec4f,
};

@group(0) @binding(0) var<uniform> frameUniforms: FrameUniforms;

@fragment
fn fsMain(input: FragmentInput) -> FragmentOutput {
  let lightDirection = normalize(-frameUniforms.lightDirection.xyz);
  let ndl = max(dot(normalize(input.worldNormal), lightDirection), 0.0);
  let litColor = input.baseColor.rgb * (0.2 + ndl * 0.8);

  var output: FragmentOutput;
  output.color = vec4f(litColor, 1.0);
  output.velocity = vec4f(input.velocity, length(input.velocity), 1.0);
  return output;
}
