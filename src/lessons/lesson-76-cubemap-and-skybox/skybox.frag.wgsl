@group(1) @binding(0) var environmentSampler: sampler;
@group(1) @binding(1) var environmentTexture: texture_cube<f32>;

struct FragmentInput {
  @location(0) sampleDirection: vec3f,
}

@fragment
fn fsMain(input: FragmentInput) -> @location(0) vec4f {
  let color = textureSample(
    environmentTexture,
    environmentSampler,
    normalize(input.sampleDirection)
  ).rgb;
  return vec4f(color, 1.0);
}
