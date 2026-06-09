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
  let stripe = step(0.92, fract((input.uv.x + input.uv.y) * 12.0));
  let color = mix(vec3f(0.07, 0.18, 0.28), vec3f(0.22, 0.82, 0.72), input.uv.x);
  return vec4f(color + stripe * vec3f(0.8, 0.48, 0.15), 1.0);
}
