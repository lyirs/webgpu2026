struct ObjectUniforms {
  color: vec4f,
  transform: vec4f,
  accent: vec4f,
  padding: vec4f,
};

@group(0) @binding(0) var<uniform> objectUniforms: ObjectUniforms;

struct VertexOut {
  @builtin(position) position: vec4f,
  @location(0) local: vec2f,
  @location(1) color: vec4f,
};

@vertex
fn vsMain(@builtin(vertex_index) vertexIndex: u32) -> VertexOut {
  var corners = array<vec2f, 6>(
    vec2f(-0.35, -0.35),
    vec2f(0.35, -0.35),
    vec2f(-0.35, 0.35),
    vec2f(-0.35, 0.35),
    vec2f(0.35, -0.35),
    vec2f(0.35, 0.35),
  );

  let local = corners[vertexIndex];
  let scale = objectUniforms.transform.z;
  let angle = objectUniforms.transform.w;
  let rotated = vec2f(
    local.x * cos(angle) - local.y * sin(angle),
    local.x * sin(angle) + local.y * cos(angle),
  );

  var out: VertexOut;
  out.position = vec4f(rotated * scale + objectUniforms.transform.xy, 0.0, 1.0);
  out.local = local;
  out.color = objectUniforms.color;
  return out;
}

@fragment
fn fsMain(input: VertexOut) -> @location(0) vec4f {
  let grid = smoothstep(0.30, 0.34, max(abs(input.local.x), abs(input.local.y)));
  let glow = 0.72 + 0.28 * cos((input.local.x + input.local.y) * 8.0);
  let edge = mix(input.color.rgb * glow, vec3f(1.0, 0.86, 0.48), grid);
  return vec4f(edge, 1.0);
}
