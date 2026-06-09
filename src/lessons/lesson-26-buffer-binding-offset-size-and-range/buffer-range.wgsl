struct RangeParams {
  color: vec4f,
  centerScale: vec4f,
};

@group(0) @binding(0) var<uniform> params: RangeParams;

struct VertexOut {
  @builtin(position) position: vec4f,
  @location(0) color: vec4f,
};

@vertex
fn vsMain(@builtin(vertex_index) vertexIndex: u32) -> VertexOut {
  var positions = array<vec2f, 3>(
    vec2f(0.0, 0.62),
    vec2f(-0.58, -0.48),
    vec2f(0.58, -0.48),
  );
  let p = positions[vertexIndex] * params.centerScale.zw + params.centerScale.xy;
  var out: VertexOut;
  out.position = vec4f(p, 0.0, 1.0);
  out.color = params.color;
  return out;
}

@fragment
fn fsMain(input: VertexOut) -> @location(0) vec4f {
  return input.color;
}
