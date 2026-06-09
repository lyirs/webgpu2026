@vertex
fn vsDepth(@builtin(vertex_index) vertexIndex: u32, @builtin(instance_index) instanceIndex: u32) -> @builtin(position) vec4f {
  var base = array<vec2f, 6>(
    vec2f(-1.0, -1.0),
    vec2f(1.0, -1.0),
    vec2f(-1.0, 1.0),
    vec2f(-1.0, 1.0),
    vec2f(1.0, -1.0),
    vec2f(1.0, 1.0)
  );
  var centers = array<vec2f, 3>(
    vec2f(-0.42, -0.05),
    vec2f(0.18, 0.08),
    vec2f(0.52, -0.22)
  );
  var scales = array<vec2f, 3>(
    vec2f(0.36, 0.72),
    vec2f(0.52, 0.34),
    vec2f(0.24, 0.48)
  );
  var depths = array<f32, 3>(0.34, 0.58, 0.44);
  let local = base[vertexIndex];
  let position = centers[instanceIndex] + local * scales[instanceIndex];
  return vec4f(position, depths[instanceIndex], 1.0);
}
