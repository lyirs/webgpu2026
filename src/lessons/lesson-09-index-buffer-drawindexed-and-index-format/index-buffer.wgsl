struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) color: vec3f,
};

@vertex
fn vsMain(
  @location(0) position: vec2f,
  @location(1) color: vec3f
) -> VertexOutput {
  var output: VertexOutput;
  output.position = vec4f(position, 0.0, 1.0);
  output.color = color;
  return output;
}

@fragment
fn fsMain(input: VertexOutput) -> @location(0) vec4f {
  let vignette = 0.82 + 0.18 * smoothstep(-0.9, 0.8, input.position.y / 360.0);
  return vec4f(input.color * vignette, 1.0);
}
