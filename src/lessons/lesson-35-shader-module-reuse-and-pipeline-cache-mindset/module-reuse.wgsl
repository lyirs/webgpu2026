override MODE: u32 = 0u;

struct CacheStats {
  pulse: f32,
  pipelineCount: f32,
  layoutReuse: f32,
  padding: f32,
};

@group(0) @binding(0) var<uniform> stats: CacheStats;
@group(0) @binding(1) var<storage, read_write> computeOutput: array<vec4f>;

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
  let accent = f32(MODE) / 2.0;
  let wave = 0.5 + 0.5 * sin(input.uv.x * 12.0 + stats.pulse);
  let a = mix(vec3f(0.1, 0.75, 1.0), vec3f(1.0, 0.66, 0.24), accent);
  let b = mix(vec3f(0.9, 0.45, 1.0), vec3f(0.4, 1.0, 0.6), 1.0 - accent);
  return vec4f(mix(a, b, wave) * (0.75 + 0.25 * input.uv.y), 1.0);
}

@compute @workgroup_size(1)
fn csMain() {
  computeOutput[0] = vec4f(stats.pulse, stats.pipelineCount, stats.layoutReuse, f32(MODE));
}
