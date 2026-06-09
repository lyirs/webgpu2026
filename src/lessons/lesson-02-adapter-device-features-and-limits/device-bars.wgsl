struct VertexOut {
  @builtin(position) position: vec4f,
  @location(0) color: vec3f,
};

@vertex
fn vsMain(@builtin(vertex_index) vertexIndex: u32) -> VertexOut {
  let bar = vertexIndex / 6u;
  let corner = vertexIndex % 6u;
  let x0 = -0.72 + f32(bar) * 0.48;
  let x1 = x0 + 0.28;
  let heights = array<f32, 3>(0.42, 0.72, 0.56);
  let colors = array<vec3f, 3>(
    vec3f(0.25, 0.72, 1.0),
    vec3f(0.55, 0.91, 0.57),
    vec3f(1.0, 0.68, 0.32)
  );
  let y0 = -0.66;
  let y1 = y0 + heights[bar] * 1.32;
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
  out.color = colors[bar];
  return out;
}

@fragment
fn fsMain(input: VertexOut) -> @location(0) vec4f {
  return vec4f(input.color, 1.0);
}
