struct CocUniforms {
  focusDistance: f32,
  aperture: f32,
  maxBlurRadius: f32,
  reserved0: f32,
};

struct VertexOutput {
  @builtin(position) clipPosition: vec4f,
  @location(0) uv: vec2f,
};

@group(0) @binding(0) var cocSampler: sampler;
@group(0) @binding(1) var viewPositionTexture: texture_2d<f32>;
@group(0) @binding(2) var<uniform> cocUniforms: CocUniforms;

@vertex
fn vsMain(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
  var clip = array(
    vec2f(-1.0, -1.0),
    vec2f(3.0, -1.0),
    vec2f(-1.0, 3.0)
  );

  let clipPosition = clip[vertexIndex];
  var output: VertexOutput;
  output.clipPosition = vec4f(clipPosition, 0.0, 1.0);
  output.uv = clipPosition * vec2f(0.5, -0.5) + vec2f(0.5);
  return output;
}

@fragment
fn fsMain(input: VertexOutput) -> @location(0) vec4f {
  let viewPosition = textureSampleLevel(viewPositionTexture, cocSampler, input.uv, 0.0).xyz;

  if (length(viewPosition) < 0.0001) {
    return vec4f(0.0);
  }

  let depth = -viewPosition.z;
  let normalized =
    clamp(
      (depth - cocUniforms.focusDistance) /
        max(cocUniforms.focusDistance, 0.001) *
        cocUniforms.aperture *
        2.4,
      -1.0,
      1.0
    );
  return vec4f(normalized, abs(normalized), depth, 1.0);
}
