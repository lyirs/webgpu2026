struct FragmentInput {
  @location(0) worldPosition: vec3f,
  @location(1) worldNormal: vec3f,
  @location(2) baseColor: vec4f,
}

struct FragmentOutput {
  @location(0) albedo: vec4f,
  @location(1) normal: vec4f,
  @location(2) worldPosition: vec4f,
}

@fragment
fn fsMain(input: FragmentInput) -> FragmentOutput {
  var output: FragmentOutput;
  output.albedo = input.baseColor;
  output.normal = vec4f(normalize(input.worldNormal), 1.0);
  output.worldPosition = vec4f(input.worldPosition, 1.0);
  return output;
}
