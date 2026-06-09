struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) color: vec4f,
};

@vertex
fn vsMain(
  @location(0) localPosition: vec2f,
  @location(1) localColor: vec4f,
  @location(2) instanceOffsetScale: vec4f,
  @location(3) instanceColor: vec4f,
  @builtin(instance_index) instanceIndex: u32
) -> VertexOutput {
  let wave = 0.035 * sin(f32(instanceIndex) * 1.7);
  let position = localPosition * instanceOffsetScale.zw + instanceOffsetScale.xy + vec2f(0.0, wave);
  var output: VertexOutput;
  output.position = vec4f(position, 0.0, 1.0);
  output.color = localColor * instanceColor;
  return output;
}

@fragment
fn fsMain(input: VertexOutput) -> @location(0) vec4f {
  return vec4f(pow(input.color.rgb, vec3f(0.9)), input.color.a);
}
