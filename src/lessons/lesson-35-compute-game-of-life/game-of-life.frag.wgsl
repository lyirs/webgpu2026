struct FragmentInput {
  @location(0) alive: f32,
  @location(1) localUv: vec2f,
};

@fragment
fn fsMain(input: FragmentInput) -> @location(0) vec4f {
  let edgeDistance = max(
    abs(input.localUv.x * 2.0 - 1.0),
    abs(input.localUv.y * 2.0 - 1.0)
  );
  let edgeShadow = smoothstep(0.74, 1.0, edgeDistance);
  let aliveColor = vec3f(0.32, 0.92, 0.46);
  let deadColor = vec3f(0.1, 0.14, 0.2);
  let baseColor = mix(deadColor, aliveColor, input.alive);
  let shadedColor = mix(baseColor, baseColor * 0.72, edgeShadow);
  let alpha = mix(0.16, 1.0, input.alive);
  return vec4f(shadedColor, alpha);
}
