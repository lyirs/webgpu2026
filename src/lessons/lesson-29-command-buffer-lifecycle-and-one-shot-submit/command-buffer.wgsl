struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) color: vec3f,
};

@vertex
fn vsMain(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
  var positions = array<vec2f, 3>(
    vec2f(-0.72, -0.58),
    vec2f(0.78, -0.36),
    vec2f(-0.08, 0.72)
  );
  var colors = array<vec3f, 3>(
    vec3f(0.24, 0.75, 1.0),
    vec3f(1.0, 0.78, 0.26),
    vec3f(0.55, 0.96, 0.62)
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
