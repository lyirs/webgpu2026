struct Params {
  time: f32,
  pad0: f32,
  pad1: f32,
  pad2: f32,
};

struct VertexOut {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
};

@group(0) @binding(0) var<uniform> params: Params;
@group(0) @binding(1) var<storage, read> palette: array<vec4f>;

@vertex
fn vsMain(@builtin(vertex_index) vertexIndex: u32) -> VertexOut {
  let positions = array<vec2f, 3>(
    vec2f(-1.0, -1.0),
    vec2f(3.0, -1.0),
    vec2f(-1.0, 3.0)
  );
  let position = positions[vertexIndex];
  var out: VertexOut;
  out.position = vec4f(position, 0.0, 1.0);
  out.uv = position * 0.5 + vec2f(0.5);
  return out;
}

@fragment
fn fsMain(input: VertexOut) -> @location(0) vec4f {
  let bands = floor(input.uv.x * 4.0);
  let index = u32(clamp(bands, 0.0, 3.0));
  let pulse = 0.72 + sin(params.time * 2.0 + f32(index)) * 0.18;
  let grid = step(0.98, fract(input.uv.x * 12.0)) + step(0.98, fract(input.uv.y * 8.0));
  let base = palette[index].rgb * pulse;
  return vec4f(mix(base, vec3f(1.0), min(grid, 1.0) * 0.2), 1.0);
}
