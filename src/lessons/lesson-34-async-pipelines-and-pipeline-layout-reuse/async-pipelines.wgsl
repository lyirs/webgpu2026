struct FrameUniforms {
  time: f32,
  mode: f32,
  pad0: vec2f,
};

@group(0) @binding(0) var<uniform> frame: FrameUniforms;

struct VertexOut {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
};

@vertex
fn vsMain(@builtin(vertex_index) vertexIndex: u32) -> VertexOut {
  var positions = array<vec2f, 6>(
    vec2f(-1.0, -1.0),
    vec2f(1.0, -1.0),
    vec2f(-1.0, 1.0),
    vec2f(-1.0, 1.0),
    vec2f(1.0, -1.0),
    vec2f(1.0, 1.0),
  );
  let pos = positions[vertexIndex];
  var out: VertexOut;
  out.position = vec4f(pos, 0.0, 1.0);
  out.uv = pos * 0.5 + vec2f(0.5);
  return out;
}

@fragment
fn fsMain(input: VertexOut) -> @location(0) vec4f {
  let wave = 0.5 + 0.5 * sin((input.uv.x + input.uv.y) * 14.0 + frame.time);
  let syncColor = vec3f(0.18, 0.54, 1.0);
  let asyncColor = vec3f(0.98, 0.62, 0.28);
  let base = mix(syncColor, asyncColor, frame.mode);
  return vec4f(base * (0.56 + 0.44 * wave), 1.0);
}
