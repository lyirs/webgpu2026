struct CounterUniforms {
  left: f32,
  right: f32,
  maxValue: f32,
  _pad0: f32,
};

struct VertexOut {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
};

@group(0) @binding(0) var<uniform> counters: CounterUniforms;

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
  let panel = min(1u, u32(floor(input.uv.x * 2.0)));
  let localUv = vec2f(fract(input.uv.x * 2.0), input.uv.y);
  let value = select(counters.left, counters.right, panel == 1u);
  let barHeight = clamp(value / max(counters.maxValue, 1.0), 0.0, 1.0);
  let bar = select(0.18, 1.0, localUv.y < barHeight && localUv.x > 0.22 && localUv.x < 0.78);
  let tint = select(vec3f(0.95, 0.5, 0.25), vec3f(0.34, 0.95, 0.78), panel == 1u);
  let grid = step(0.97, fract(localUv.y * 8.0)) * 0.16;
  return vec4f(tint * bar + grid, 1.0);
}
