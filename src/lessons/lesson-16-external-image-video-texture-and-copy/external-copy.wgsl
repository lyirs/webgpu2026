struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
};

@group(0) @binding(0) var copiedTexture: texture_2d<f32>;
@group(0) @binding(1) var copiedSampler: sampler;
@group(0) @binding(2) var videoTexture: texture_external;

@vertex
fn vsMain(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
  var positions = array<vec2f, 3>(
    vec2f(-1.0, -1.0),
    vec2f(3.0, -1.0),
    vec2f(-1.0, 3.0)
  );

  let position = positions[vertexIndex];
  var output: VertexOutput;
  output.position = vec4f(position, 0.0, 1.0);
  output.uv = position * 0.5 + vec2f(0.5);
  return output;
}

@fragment
fn fsMain(input: VertexOutput) -> @location(0) vec4f {
  let panel = floor(input.uv.x * 3.0);
  let localUv = vec2f(fract(input.uv.x * 3.0), input.uv.y);
  let copied = textureSample(copiedTexture, copiedSampler, localUv);
  let bitmapPanel = vec4f(copied.rgb, 1.0);
  let copyPanel = vec4f(copied.rg * 0.85 + vec2f(0.08, 0.02), copied.b, 1.0);
  let externalPanel = textureSampleBaseClampToEdge(videoTexture, copiedSampler, localUv);
  return select(select(bitmapPanel, copyPanel, panel >= 1.0), externalPanel, panel >= 2.0);
}
