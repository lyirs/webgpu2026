struct VertexOutput {
  @builtin(position) clipPosition: vec4f,
  @location(0) uv: vec2f,
}

@vertex
fn vsMain(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
  var output: VertexOutput;
  let positions = array(
    vec2f(-1.0, -1.0),
    vec2f(3.0, -1.0),
    vec2f(-1.0, 3.0)
  );
  let clipPosition = positions[vertexIndex];
  output.clipPosition = vec4f(clipPosition, 0.0, 1.0);
  output.uv = clipPosition * vec2f(0.5, -0.5) + vec2f(0.5);
  return output;
}
