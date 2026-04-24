@group(0) @binding(0) var blurSampler: sampler;
@group(0) @binding(1) var blurSource: texture_2d<f32>;

struct BlurParams {
  direction: vec4f,
};

@group(0) @binding(2) var<uniform> blurParams: BlurParams;

struct FullscreenInput {
  @location(0) uv: vec2f,
};

@fragment
fn fsMain(input: FullscreenInput) -> @location(0) vec4f {
  let offset = blurParams.direction.xy;
  var color = textureSample(blurSource, blurSampler, input.uv) * 0.227027027;
  color += textureSample(blurSource, blurSampler, input.uv + offset * 1.3846153846) * 0.3162162162;
  color += textureSample(blurSource, blurSampler, input.uv - offset * 1.3846153846) * 0.3162162162;
  color += textureSample(blurSource, blurSampler, input.uv + offset * 3.2307692308) * 0.0702702703;
  color += textureSample(blurSource, blurSampler, input.uv - offset * 3.2307692308) * 0.0702702703;
  return vec4f(color.rgb, 1.0);
}
