@group(0) @binding(0) var<storage, read> timeline: array<vec4f>;

struct VertexOut {
  @builtin(position) position: vec4f,
  @location(0) color: vec3f,
};

@vertex
fn vsMain(@builtin(vertex_index) vertexIndex: u32) -> VertexOut {
  let bar = vertexIndex / 6u;
  let corner = vertexIndex % 6u;
  let data = timeline[bar];
  let x0 = -0.94 + f32(bar) * 0.118;
  let x1 = x0 + 0.074;
  let y0 = -0.76;
  let y1 = y0 + data.a * 1.48;
  let positions = array<vec2f, 6>(
    vec2f(x0, y0),
    vec2f(x1, y0),
    vec2f(x0, y1),
    vec2f(x0, y1),
    vec2f(x1, y0),
    vec2f(x1, y1)
  );

  var out: VertexOut;
  out.position = vec4f(positions[corner], 0.0, 1.0);
  out.color = data.rgb;
  return out;
}

@fragment
fn fsMain(input: VertexOut) -> @location(0) vec4f {
  return vec4f(input.color, 1.0);
}
