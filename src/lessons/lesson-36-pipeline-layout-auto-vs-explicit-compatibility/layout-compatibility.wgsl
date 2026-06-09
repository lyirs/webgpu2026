struct Params {
  color: vec4f,
  mode: vec4f,
};

@group(0) @binding(0) var<uniform> params: Params;

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
  let wave = 0.5 + 0.5 * sin((input.uv.x + input.uv.y + params.mode.x) * 12.0);
  let grid = select(0.0, 0.14, fract(input.uv.x * 12.0) < 0.04 || fract(input.uv.y * 8.0) < 0.04);
  return vec4f(params.color.rgb * (0.55 + wave * 0.45) + grid, 1.0);
}
