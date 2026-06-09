struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) color: vec3f,
};

@vertex
fn vsScene(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
  let positions = array<vec2f, 12>(
    vec2f(-0.9, -0.72), vec2f(0.72, -0.35), vec2f(-0.78, -0.48),
    vec2f(-0.78, -0.48), vec2f(0.72, -0.35), vec2f(0.86, -0.12),
    vec2f(-0.42, 0.62), vec2f(0.72, -0.18), vec2f(-0.25, 0.78),
    vec2f(-0.25, 0.78), vec2f(0.72, -0.18), vec2f(0.88, 0.05)
  );
  let colors = array<vec3f, 12>(
    vec3f(0.55, 0.86, 1.0), vec3f(0.55, 0.86, 1.0), vec3f(0.55, 0.86, 1.0),
    vec3f(0.55, 0.86, 1.0), vec3f(0.55, 0.86, 1.0), vec3f(0.55, 0.86, 1.0),
    vec3f(1.0, 0.64, 0.28), vec3f(1.0, 0.64, 0.28), vec3f(1.0, 0.64, 0.28),
    vec3f(1.0, 0.64, 0.28), vec3f(1.0, 0.64, 0.28), vec3f(1.0, 0.64, 0.28)
  );
  var output: VertexOutput;
  output.position = vec4f(positions[vertexIndex], 0.0, 1.0);
  output.color = colors[vertexIndex];
  return output;
}

@fragment
fn fsScene(input: VertexOutput) -> @location(0) vec4f {
  return vec4f(input.color, 1.0);
}
