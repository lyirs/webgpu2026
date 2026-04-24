struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) color: vec3f,
};

@vertex
fn vsMain(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
  let positions = array<vec2f, 3>(
    vec2f(0.0, 0.72),
    vec2f(-0.72, -0.58),
    vec2f(0.72, -0.58)
  );

  let colors = array<vec3f, 3>(
    vec3f(1.0, 0.43, 0.29),
    vec3f(0.98, 0.82, 0.28),
    vec3f(0.22, 0.69, 0.95)
  );

  var output: VertexOutput;
  output.position = vec4f(positions[vertexIndex], 0.0, 1.0);
  output.color = colors[vertexIndex];
  return output;
}

@fragment
fn fsMain(input: VertexOutput) -> @location(0) vec4f {
  return vec4f(input.color, 1.0);
}
