@group(0) @binding(0) var sceneSampler: sampler;
@group(0) @binding(1) var sceneTexture: texture_2d<f32>;

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
  let color = textureSample(sceneTexture, sceneSampler, input.uv);
  let vignette = smoothstep(0.82, 0.2, distance(input.uv, vec2f(0.5)));
  return vec4f(color.rgb * (0.65 + 0.35 * vignette), 1.0);
}
