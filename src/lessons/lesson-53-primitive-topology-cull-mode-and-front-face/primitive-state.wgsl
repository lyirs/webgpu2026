struct VertexInput {
  @location(0) position: vec3f,
  @location(1) color: vec3f,
};

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) color: vec3f,
  @location(1) localPosition: vec2f,
};

@vertex
fn vsMain(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;
  output.position = vec4f(input.position, 1.0);
  output.color = input.color;
  output.localPosition = input.position.xy;
  return output;
}

@fragment
fn fsMain(input: VertexOutput, @builtin(front_facing) frontFacing: bool) -> @location(0) vec4f {
  let grid = 0.08 * step(0.965, max(fract((input.localPosition.x + 1.0) * 5.0), fract((input.localPosition.y + 1.0) * 4.0)));
  let faceTint = select(vec3f(0.36, 0.18, 0.12), vec3f(1.0, 1.0, 1.0), frontFacing);
  let color = input.color * faceTint + grid;
  return vec4f(color, 1.0);
}
