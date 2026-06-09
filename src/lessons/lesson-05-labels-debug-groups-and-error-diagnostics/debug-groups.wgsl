struct VertexOut {
  @builtin(position) position: vec4f,
  @location(0) color: vec3f,
};

@vertex
fn vsMain(@builtin(vertex_index) vertexIndex: u32) -> VertexOut {
  var positions = array<vec2f, 3>(
    vec2f(0.0, 0.62),
    vec2f(-0.64, -0.48),
    vec2f(0.64, -0.48),
  );
  var colors = array<vec3f, 3>(
    vec3f(0.35, 0.86, 1.0),
    vec3f(1.0, 0.67, 0.27),
    vec3f(0.67, 1.0, 0.52),
  );

  var out: VertexOut;
  out.position = vec4f(positions[vertexIndex], 0.0, 1.0);
  out.color = colors[vertexIndex];
  return out;
}

@fragment
fn fsMain(input: VertexOut) -> @location(0) vec4f {
  return vec4f(input.color, 1.0);
}
