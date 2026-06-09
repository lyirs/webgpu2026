struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) color: vec3f,
};

@vertex
fn vsMain(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
  var positions = array<vec2f, 6>(
    vec2f(-0.86, -0.64), vec2f(-0.18, -0.64), vec2f(-0.52, 0.58),
    vec2f(0.12, -0.54), vec2f(0.82, -0.44), vec2f(0.48, 0.72)
  );
  var colors = array<vec3f, 6>(
    vec3f(0.20, 0.76, 1.0), vec3f(0.20, 0.76, 1.0), vec3f(0.86, 0.96, 1.0),
    vec3f(1.0, 0.78, 0.28), vec3f(1.0, 0.78, 0.28), vec3f(1.0, 0.94, 0.64)
  );
  var output: VertexOutput;
  output.position = vec4f(positions[vertexIndex], 0.0, 1.0);
  output.color = colors[vertexIndex];
  return output;
}

@fragment
fn fsMain(input: VertexOutput) -> @location(0) vec4f {
  let stripe = 0.82 + 0.18 * sin(input.position.x * 0.05 + input.position.y * 0.07);
  return vec4f(input.color * stripe, 1.0);
}
