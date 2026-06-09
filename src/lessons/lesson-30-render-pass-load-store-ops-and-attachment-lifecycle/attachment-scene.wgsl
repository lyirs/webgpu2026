struct SceneUniforms {
  time: f32,
  mode: f32,
  pad0: f32,
  pad1: f32,
};

@group(0) @binding(0) var<uniform> sceneUniforms: SceneUniforms;

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
  let center = vec2f(
    0.5 + 0.28 * sin(sceneUniforms.time * 1.25 + sceneUniforms.mode),
    0.5 + 0.22 * cos(sceneUniforms.time * 1.05 + sceneUniforms.mode * 0.7)
  );
  let distanceToCenter = distance(input.uv, center);
  let disc = smoothstep(0.18, 0.02, distanceToCenter);
  let ring = smoothstep(0.24, 0.20, distanceToCenter) * smoothstep(0.13, 0.17, distanceToCenter);
  let colorA = vec3f(0.22, 0.76, 1.0);
  let colorB = vec3f(1.0, 0.64, 0.22);
  let color = mix(colorA, colorB, sceneUniforms.mode * 0.35) * disc + vec3f(0.8, 0.95, 1.0) * ring;
  return vec4f(color, max(disc, ring) * 0.38);
}
