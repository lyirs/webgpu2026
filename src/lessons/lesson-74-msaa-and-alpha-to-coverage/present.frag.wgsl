@group(0) @binding(0) var panelSampler: sampler;
@group(0) @binding(1) var leftSceneTexture: texture_2d<f32>;
@group(0) @binding(2) var rightSceneTexture: texture_2d<f32>;

struct FragmentInput {
  @location(0) uv: vec2f,
};

@fragment
fn fsMain(input: FragmentInput) -> @location(0) vec4f {
  let divider = 0.5;
  let isLeft = input.uv.x < divider;
  let sampleUv = vec2f(
    select((input.uv.x - divider) / (1.0 - divider), input.uv.x / divider, isLeft),
    input.uv.y
  );

  let color = select(
    textureSample(rightSceneTexture, panelSampler, sampleUv),
    textureSample(leftSceneTexture, panelSampler, sampleUv),
    isLeft
  );

  let dividerMask = smoothstep(0.0, 0.004, abs(input.uv.x - divider));
  let dividerColor = vec3f(0.96, 0.66, 0.24);
  let finalColor = mix(dividerColor, color.rgb, dividerMask);
  return vec4f(finalColor, 1.0);
}
