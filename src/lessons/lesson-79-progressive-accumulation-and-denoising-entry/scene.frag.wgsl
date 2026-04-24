struct FragmentInput {
  @location(0) worldNormal: vec3f,
  @location(1) viewDepth: f32,
};

struct FragmentOutput {
  @location(0) normal: vec4f,
  @location(1) linearDepth: vec4f,
};

@fragment
fn fsMain(input: FragmentInput) -> FragmentOutput {
  var output: FragmentOutput;
  output.normal = vec4f(normalize(input.worldNormal) * 0.5 + 0.5, 1.0);
  output.linearDepth = vec4f(input.viewDepth, 0.0, 0.0, 1.0);
  return output;
}
