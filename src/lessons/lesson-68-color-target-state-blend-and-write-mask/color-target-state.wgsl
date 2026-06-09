struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) color: vec4f,
};

@vertex
fn vsMain(
  @location(0) position: vec2f,
  @location(1) color: vec4f
) -> VertexOutput {
  var output: VertexOutput;
  output.position = vec4f(position, 0.0, 1.0);
  output.color = color;
  return output;
}

@fragment
fn fsMain(input: VertexOutput) -> @location(0) vec4f {
  return input.color;
}
