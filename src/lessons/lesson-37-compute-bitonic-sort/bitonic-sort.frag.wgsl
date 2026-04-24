struct FragmentInput {
  @location(0) color: vec4f,
  @location(1) columnShade: f32,
};

@fragment
fn fsMain(input: FragmentInput) -> @location(0) vec4f {
  let shade = mix(0.75, 1.08, input.columnShade);
  return vec4f(input.color.rgb * shade, 1.0);
}
