struct FragmentInput {
  @location(0) color: vec3f,
  @location(1) normal: vec3f,
}

@fragment
fn fsMain(input: FragmentInput) -> @location(0) vec4f {
  let lightDirection = normalize(vec3f(0.35, 0.8, 0.45));
  let lambert = max(dot(normalize(input.normal), lightDirection), 0.0);
  let ambient = 0.22;
  let diffuse = ambient + lambert * 0.78;

  return vec4f(input.color * diffuse, 1.0);
}
