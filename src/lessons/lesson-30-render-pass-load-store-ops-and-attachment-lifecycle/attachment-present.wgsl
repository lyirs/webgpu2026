struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
};

@group(0) @binding(0) var panelSampler: sampler;
@group(0) @binding(1) var clearTexture: texture_2d<f32>;
@group(0) @binding(2) var loadTexture: texture_2d<f32>;

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

fn grid(uv: vec2f) -> f32 {
  let line = min(fract(uv.x * 18.0), fract(uv.y * 10.0));
  return 1.0 - smoothstep(0.0, 0.025, line);
}

@fragment
fn fsMain(input: VertexOutput) -> @location(0) vec4f {
  let panel = min(u32(input.uv.x * 3.0), 2u);
  let panelUv = vec2f(fract(input.uv.x * 3.0), input.uv.y);
  let border = step(panelUv.x, 0.012) + step(0.988, panelUv.x);
  let base = vec3f(0.025, 0.04, 0.07) + grid(panelUv) * vec3f(0.03, 0.05, 0.075);

  let clearColor = textureSample(clearTexture, panelSampler, panelUv).rgb;
  let loadColor = textureSample(loadTexture, panelSampler, panelUv).rgb;
  let discardPreview = base + vec3f(0.18, 0.12, 0.04) * smoothstep(0.12, 0.72, panelUv.y);
  let stripe = step(0.48, fract((panelUv.x + panelUv.y) * 11.0));
  let transientColor = discardPreview + stripe * vec3f(0.08, 0.06, 0.03);

  var color = select(clearColor, loadColor, panel == 1u);
  color = select(color, transientColor, panel == 2u);
  color += border * vec3f(0.9, 0.58, 0.28);
  return vec4f(color, 1.0);
}
