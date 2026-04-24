struct FragmentInput {
  @location(0) uv: vec2f,
}

@group(0) @binding(0) var panelSampler: sampler;
@group(0) @binding(1) var leftSceneTexture: texture_2d<f32>;
@group(0) @binding(2) var rightSceneTexture: texture_2d<f32>;

@fragment
fn fsMain(input: FragmentInput) -> @location(0) vec4f {
  let isRight = input.uv.x >= 0.5;
  let panelUv = vec2f(
    select(input.uv.x * 2.0, (input.uv.x - 0.5) * 2.0, isRight),
    input.uv.y
  );

  let leftColor = textureSample(leftSceneTexture, panelSampler, panelUv);
  let rightColor = textureSample(rightSceneTexture, panelSampler, panelUv);
  let divider = abs(input.uv.x - 0.5) < 0.0025;
  let splitColor = select(leftColor, rightColor, isRight);
  return select(splitColor, vec4f(1.0, 0.72, 0.25, 1.0), divider);
}
