@group(0) @binding(0) var panelSampler: sampler;
@group(0) @binding(1) var clearPanel: texture_2d<f32>;
@group(0) @binding(2) var loadPanel: texture_2d<f32>;
@group(0) @binding(3) var debugPanel: texture_2d<f32>;

struct VertexOut {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
};

@vertex
fn vsMain(@builtin(vertex_index) vertexIndex: u32) -> VertexOut {
  var positions = array<vec2f, 3>(
    vec2f(-1.0, -1.0),
    vec2f(3.0, -1.0),
    vec2f(-1.0, 3.0),
  );
  let position = positions[vertexIndex];
  var out: VertexOut;
  out.position = vec4f(position, 0.0, 1.0);
  out.uv = position * 0.5 + vec2f(0.5);
  return out;
}

@fragment
fn fsMain(input: VertexOut) -> @location(0) vec4f {
  let panel = min(2u, u32(floor(input.uv.x * 3.0)));
  let localUv = vec2f(fract(input.uv.x * 3.0), input.uv.y);
  let clearColor = textureSample(clearPanel, panelSampler, localUv).rgb;
  let loadColor = textureSample(loadPanel, panelSampler, localUv).rgb;
  let debugColor = textureSample(debugPanel, panelSampler, localUv).rgb;
  let color = select(select(debugColor, loadColor, panel == 1u), clearColor, panel == 0u);
  let border = step(localUv.x, 0.02) + step(localUv.y, 0.02) + step(0.98, localUv.x) + step(0.98, localUv.y);
  return vec4f(mix(color, vec3f(1.0), min(border, 1.0) * 0.35), 1.0);
}
