@group(0) @binding(0) var presentSampler: sampler;
@group(0) @binding(1) var originalSceneTexture: texture_2d<f32>;
@group(0) @binding(2) var blurredSceneTexture: texture_2d<f32>;

struct FullscreenInput {
  @location(0) uv: vec2f,
};

@fragment
fn fsMain(input: FullscreenInput) -> @location(0) vec4f {
  let original = textureSample(originalSceneTexture, presentSampler, input.uv);
  let blurred = textureSample(blurredSceneTexture, presentSampler, input.uv);

  if (abs(input.uv.x - 0.5) < 0.0025) {
    return vec4f(0.97, 0.62, 0.38, 1.0);
  }

  if (input.uv.x < 0.5) {
    return original;
  }

  let highlight = vec3f(1.06, 1.04, 1.02);
  return vec4f(blurred.rgb * highlight, 1.0);
}
