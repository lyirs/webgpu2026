struct VertexOut {
  @builtin(position) position: vec4f,
  @location(0) color: vec3f,
};

@vertex
fn vsMain(@builtin(vertex_index) vertexIndex: u32) -> VertexOut {
  var positions = array<vec2f, 3>(
    vec2f(-0.62, -0.44),
    vec2f(0.62, -0.44),
    vec2f(0.0, 0.58),
  );
  var colors = array<vec3f, 3>(
    vec3f(0.18, 0.72, 1.0),
    vec3f(0.98, 0.72, 0.32),
    vec3f(0.72, 0.92, 0.48),
  );

  var out: VertexOut;
  out.position = vec4f(positions[vertexIndex], 0.0, 1.0);
  out.color = colors[vertexIndex];
  return out;
}

@fragment
fn fsMain(input: VertexOut) -> @location(0) vec4f {
  let vignette = 0.82 + input.position.y * 0.00012;
  return vec4f(input.color * vignette, 1.0);
}
