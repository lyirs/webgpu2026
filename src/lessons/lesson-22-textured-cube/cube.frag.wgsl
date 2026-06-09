struct FragmentInput {
  @location(0) color: vec3f,
  @location(1) uv: vec2f,
}

@group(0) @binding(1) var textureSampler: sampler;
@group(0) @binding(2) var textureData: texture_2d<f32>;

@fragment
fn fsMain(input: FragmentInput) -> @location(0) vec4f {
  let sampled = textureSample(textureData, textureSampler, input.uv);
  let blendedColor = input.color * (1.0 - sampled.a) + sampled.rgb * sampled.a;
  return vec4f(blendedColor, 1.0);
}
