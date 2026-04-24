struct VertexOutput {
  @builtin(position) clipPosition: vec4f,
  @location(0) viewPosition: vec3f,
  @location(1) viewNormal: vec3f,
  @location(2) baseColor: vec4f,
};

struct GBufferOutput {
  @location(0) albedo: vec4f,
  @location(1) normal: vec4f,
  @location(2) viewPosition: vec4f,
};

@fragment
fn fsMain(input: VertexOutput) -> GBufferOutput {
  var output: GBufferOutput;
  output.albedo = input.baseColor;
  output.normal = vec4f(normalize(input.viewNormal) * 0.5 + 0.5, 1.0);
  output.viewPosition = vec4f(input.viewPosition, 1.0);
  return output;
}
