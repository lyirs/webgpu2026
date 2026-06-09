struct FragmentInput {
  @location(0) color: vec4f,
  @location(1) facingAmount: f32,
};

@fragment
fn fsMain(input: FragmentInput) -> @location(0) vec4f {
  let frontLight = smoothstep(-0.8, 1.2, input.facingAmount);
  let finalColor = mix(input.color.rgb * 0.62, input.color.rgb, frontLight);
  return vec4f(finalColor, 1.0);
}
