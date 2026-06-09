struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) color: vec4f,
};

@vertex
fn vsMain(
  @location(0) position: vec2f,
  @location(1) color: vec4f,
  @builtin(instance_index) instanceIndex: u32
) -> VertexOutput {
  let instanceLane = f32(instanceIndex % 3u);
  let offset = vec2f((instanceLane - 1.0) * 0.26, f32(instanceIndex / 3u) * 0.16);
  var output: VertexOutput;
  output.position = vec4f(position + offset, 0.0, 1.0);
  output.color = color * (0.72 + 0.10 * f32(instanceIndex));
  return output;
}

@fragment
fn fsMain(input: VertexOutput) -> @location(0) vec4f {
  return vec4f(input.color.rgb, input.color.a);
}
