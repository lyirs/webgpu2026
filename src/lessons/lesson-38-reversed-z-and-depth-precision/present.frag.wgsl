@group(0) @binding(0) var panelSampler: sampler;
@group(0) @binding(1) var normalDepthTexture: texture_2d<f32>;
@group(0) @binding(2) var reversedDepthTexture: texture_2d<f32>;

@fragment
fn fsMain(@location(0) uv: vec2f) -> @location(0) vec4f {
  let leftPanelUv = vec2f(uv.x * 2.0, uv.y);
  let rightPanelUv = vec2f((uv.x - 0.5) * 2.0, uv.y);
  let leftColor = textureSample(normalDepthTexture, panelSampler, leftPanelUv);
  let rightColor = textureSample(reversedDepthTexture, panelSampler, rightPanelUv);
  var color = select(rightColor, leftColor, uv.x < 0.5);

  let dividerDistance = abs(uv.x - 0.5);
  if (dividerDistance < 0.0025) {
    color = vec4f(1.0, 0.68, 0.22, 1.0);
  }

  return color;
}
