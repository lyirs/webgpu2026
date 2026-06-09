struct VertexOut {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
};

struct Samples {
  values: array<vec4f, 16>,
};

@group(0) @binding(0) var<uniform> samples: Samples;

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
  let column = min(15u, u32(floor(input.uv.x * 16.0)));
  let localX = fract(input.uv.x * 16.0);
  let value = samples.values[column].x;
  let bar = select(0.18, 1.0, input.uv.y < value);
  let stripe = select(0.0, 0.12, localX < 0.08 || localX > 0.92);
  let color = vec3f(0.15 + value * 0.75, 0.36 + f32(column) * 0.025, 0.85) * bar + stripe;
  return vec4f(color, 1.0);
}
