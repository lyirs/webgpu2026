struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
};

@vertex
fn vsMain(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
  var positions = array<vec2f, 3>(
    vec2f(-1.0, -1.0),
    vec2f(3.0, -1.0),
    vec2f(-1.0, 3.0)
  );

  let position = positions[vertexIndex];
  var output: VertexOutput;
  output.position = vec4f(position, 0.0, 1.0);
  output.uv = position * 0.5 + vec2f(0.5);
  return output;
}

@fragment
fn fsMain(input: VertexOutput) -> @location(0) vec4f {
  let center = input.uv - vec2f(0.5, 0.48);
  let disk = 1.0 - smoothstep(0.31, 0.36, length(center));
  let cornerFade = smoothstep(0.08, 0.48, input.uv.x) * smoothstep(0.08, 0.48, input.uv.y);
  let alpha = clamp(disk * cornerFade * 0.76 + 0.16, 0.0, 0.92);
  let gradient = vec3f(0.16 + input.uv.x * 0.52, 0.42 + input.uv.y * 0.35, 0.95);
  let glow = vec3f(0.7, 0.92, 1.0) * disk * 0.34;
  let color = gradient + glow;
  return vec4f(color * alpha, alpha);
}
