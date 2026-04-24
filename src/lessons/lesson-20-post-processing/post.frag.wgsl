@group(0) @binding(0) var sceneTextureSampler: sampler;
@group(0) @binding(1) var sampledSceneTexture: texture_2d<f32>;

struct FullscreenInput {
  @location(0) uv: vec2f,
};

@fragment
fn fsMain(input: FullscreenInput) -> @location(0) vec4f {
  let sceneColor = textureSample(sampledSceneTexture, sceneTextureSampler, input.uv);

  if (abs(input.uv.x - 0.5) < 0.0025) {
    return vec4f(0.97, 0.62, 0.38, 1.0);
  }

  if (input.uv.x < 0.5) {
    return sceneColor;
  }

  let luminance = dot(sceneColor.rgb, vec3f(0.2126, 0.7152, 0.0722));
  let grayscale = vec3f(luminance, luminance, luminance);
  let centeredUv = input.uv * 2.0 - vec2f(1.0, 1.0);
  let vignette = clamp(1.0 - dot(centeredUv, centeredUv) * 0.28, 0.0, 1.0);
  let processed = (grayscale * 0.76 + sceneColor.rgb * 0.24) * vignette;
  return vec4f(processed, 1.0);
}
