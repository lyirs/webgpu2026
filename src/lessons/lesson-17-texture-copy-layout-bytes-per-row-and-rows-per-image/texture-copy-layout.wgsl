struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
};

@group(0) @binding(0) var textureSampler: sampler;
@group(0) @binding(1) var copiedTexture: texture_2d<f32>;

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

fn grid(uv: vec2f, cells: vec2f) -> f32 {
  let local = min(fract(uv.x * cells.x), fract(uv.y * cells.y));
  return 1.0 - smoothstep(0.0, 0.03, local);
}

@fragment
fn fsMain(input: VertexOutput) -> @location(0) vec4f {
  let panel = min(u32(input.uv.x * 3.0), 2u);
  let panelUv = vec2f(fract(input.uv.x * 3.0), input.uv.y);
  let sampled = textureSample(copiedTexture, textureSampler, panelUv).rgb;

  let tightRows = vec3f(0.09, 0.18, 0.30) + grid(panelUv, vec2f(8.0, 6.0)) * vec3f(0.14, 0.27, 0.42);
  let copyRows = sampled;
  let paddedWidth = 0.75;
  let inPayload = panelUv.x < paddedWidth;
  let paddingStripe = vec3f(0.42, 0.19, 0.12) + grid(panelUv, vec2f(12.0, 6.0)) * vec3f(0.18, 0.08, 0.02);
  let payload = vec3f(0.10, 0.30, 0.24) + sampled * 0.75;
  let paddedRows = select(paddingStripe, payload, inPayload);

  var color = select(tightRows, copyRows, panel == 1u);
  color = select(color, paddedRows, panel == 2u);
  let border = step(panelUv.x, 0.012) + step(0.988, panelUv.x);
  color += border * vec3f(0.9, 0.58, 0.28);
  return vec4f(color, 1.0);
}
