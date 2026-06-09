struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
};

@group(0) @binding(0) var copiedTexture: texture_2d<f32>;
@group(0) @binding(1) var copiedSampler: sampler;

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
  let color = textureSample(copiedTexture, copiedSampler, localUv);
  let copyTint = vec4f(color.rgb, 1.0);
  let bitmapTint = vec4f(color.rg * 0.85 + vec2f(0.08, 0.02), color.b, 1.0);
  let fallbackTint = vec4f(color.bgr * 0.8 + vec3f(0.12, 0.08, 0.02), 1.0);
  return select(select(copyTint, bitmapTint, panel >= 1.0), fallbackTint, panel >= 2.0);
}
