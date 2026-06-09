struct FragmentInput {
  @location(0) particleColor: vec3f,
  @location(1) localUv: vec2f,
};

@fragment
fn fsMain(input: FragmentInput) -> @location(0) vec4f {
  let centeredUv = input.localUv * 2.0 - vec2f(1.0, 1.0);
  let radius = length(centeredUv);
  let alpha = 1.0 - smoothstep(0.42, 1.0, radius);
  return vec4f(input.particleColor, alpha);
}
