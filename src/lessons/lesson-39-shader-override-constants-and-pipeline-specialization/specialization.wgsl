override radius: f32 = 0.42;
override bands: f32 = 6.0;
override lightingMode: f32 = 0.0;

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
};

@vertex
fn vsMain(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
  let positions = array<vec2f, 3>(
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
  let centeredUv = input.uv * 2.0 - vec2f(1.0);
  let distanceFromCenter = length(centeredUv);
  let mask = smoothstep(radius + 0.015, radius - 0.015, distanceFromCenter);
  let stripe = 0.5 + 0.5 * sin((centeredUv.x + centeredUv.y + distanceFromCenter) * bands * 6.28318);

  var base = vec3f(0.14, 0.55, 0.88);
  if (lightingMode > 0.5 && lightingMode < 1.5) {
    base = vec3f(0.95, 0.55, 0.24);
  }
  if (lightingMode > 1.5) {
    base = vec3f(0.42, 0.86, 0.54);
  }

  let grid = 0.08 * step(0.965, max(fract(input.uv.x * 10.0), fract(input.uv.y * 8.0)));
  let color = mix(vec3f(0.035, 0.05, 0.085) + grid, base * (0.55 + stripe * 0.45), mask);
  return vec4f(color, 1.0);
}
