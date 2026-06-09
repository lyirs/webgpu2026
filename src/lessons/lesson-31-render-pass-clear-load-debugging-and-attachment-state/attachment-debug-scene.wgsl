struct SceneParams {
  mode: f32,
  time: f32,
  padding0: f32,
  padding1: f32,
};

@group(0) @binding(0) var<uniform> params: SceneParams;

struct VertexOut {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
};

@vertex
fn vsMain(@builtin(vertex_index) vertexIndex: u32) -> VertexOut {
  var positions = array<vec2f, 3>(
    vec2f(-1.0, -1.0),
    vec2f(3.0, -1.0),
    vec2f(-1.0, 3.0),
  );
  let position = positions[vertexIndex];
  var out: VertexOut;
  out.position = vec4f(position, 0.0, 1.0);
  out.uv = position * 0.5 + vec2f(0.5);
  return out;
}

@fragment
fn fsMain(input: VertexOut) -> @location(0) vec4f {
  let uv = input.uv;
  if (params.mode < 0.5) {
    let grid = select(0.0, 1.0, (u32(floor(uv.x * 10.0)) + u32(floor(uv.y * 6.0))) % 2u == 0u);
    let color = mix(vec3f(0.05, 0.11, 0.20), vec3f(0.12, 0.34, 0.48), grid);
    return vec4f(color + vec3f(uv.x * 0.18, uv.y * 0.12, 0.0), 1.0);
  }
  let d = distance(uv, vec2f(0.5 + sin(params.time) * 0.18, 0.5));
  let alpha = smoothstep(0.36, 0.02, d) * 0.78;
  return vec4f(1.0, 0.68, 0.22, alpha);
}
