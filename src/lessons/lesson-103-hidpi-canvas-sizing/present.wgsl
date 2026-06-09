struct FullscreenOutput {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
};

@group(0) @binding(0) var presentSampler: sampler;
@group(0) @binding(1) var naiveTexture: texture_2d<f32>;
@group(0) @binding(2) var hidpiTexture: texture_2d<f32>;

@vertex
fn vsFullscreen(@builtin(vertex_index) vertexIndex: u32) -> FullscreenOutput {
  var output: FullscreenOutput;
  let x = f32((vertexIndex << 1u) & 2u);
  let y = f32(vertexIndex & 2u);
  output.uv = vec2f(x, y);
  output.position = vec4f(x * 2.0 - 1.0, 1.0 - y * 2.0, 0.0, 1.0);
  return output;
}

@fragment
fn fsPresent(input: FullscreenOutput) -> @location(0) vec4f {
  let dividerWidth = 0.0018;
  let dividerDistance = abs(input.uv.x - 0.5);
  let dividerMix = clamp(1.0 - dividerDistance / dividerWidth, 0.0, 1.0);

  var color = vec4f(0.0);
  if (input.uv.x < 0.5) {
    color = textureSampleLevel(
      naiveTexture,
      presentSampler,
      vec2f(input.uv.x * 2.0, input.uv.y),
      0.0
    );
  } else {
    color = textureSampleLevel(
      hidpiTexture,
      presentSampler,
      vec2f((input.uv.x - 0.5) * 2.0, input.uv.y),
      0.0
    );
  }

  let dividerColor = vec3f(0.42, 0.66, 0.96);
  let blendedRgb =
    color.rgb * (1.0 - dividerMix * 0.42) + dividerColor * dividerMix * 0.42;
  return vec4f(blendedRgb, color.a);
}
