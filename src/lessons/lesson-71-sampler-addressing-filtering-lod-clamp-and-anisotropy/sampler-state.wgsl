struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
};

@group(0) @binding(0) var demoTexture: texture_2d<f32>;
@group(0) @binding(1) var repeatNearestSampler: sampler;
@group(0) @binding(2) var clampLinearSampler: sampler;
@group(0) @binding(3) var lodClampSampler: sampler;
@group(0) @binding(4) var anisotropicSampler: sampler;

@vertex
fn vsMain(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
  let positions = array<vec2f, 3>(
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
  let panel = min(u32(input.uv.x * 4.0), 3u);
  let panelUv = vec2f(fract(input.uv.x * 4.0), input.uv.y);
  let repeatedUv = panelUv * vec2f(3.4, 2.2) + vec2f(-0.45, -0.15);
  let minifiedUv = (panelUv - 0.5) * vec2f(7.0, 3.2) + vec2f(0.5);

  let repeatNearest = textureSample(demoTexture, repeatNearestSampler, repeatedUv).rgb;
  let clampLinear = textureSample(demoTexture, clampLinearSampler, repeatedUv).rgb;
  let lodClamp = textureSample(demoTexture, lodClampSampler, minifiedUv).rgb;
  let anisotropic = textureSample(demoTexture, anisotropicSampler, minifiedUv).rgb;

  var color = select(repeatNearest, clampLinear, panel == 1u);
  color = select(color, lodClamp, panel == 2u);
  color = select(color, anisotropic, panel == 3u);
  let border = step(panelUv.x, 0.012) + step(0.988, panelUv.x);
  color += border * vec3f(0.9, 0.58, 0.28);
  return vec4f(color, 1.0);
}
