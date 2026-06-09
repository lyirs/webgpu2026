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
  let grid = step(0.965, fract(input.uv.x * 10.0)) + step(0.965, fract(input.uv.y * 6.0));
  let glow = 0.5 + 0.5 * sin((input.uv.x + input.uv.y) * 8.0);
  let base = mix(vec3f(0.05, 0.12, 0.22), vec3f(0.18, 0.78, 0.92), glow * 0.6);
  return vec4f(base + grid * vec3f(0.3, 0.58, 0.8), 1.0);
}
