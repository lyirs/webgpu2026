struct Cells {
  values: array<vec4f>,
};

@group(0) @binding(0) var<storage, read> cells: Cells;

struct VertexOut {
  @builtin(position) position: vec4f,
  @location(0) color: vec3f,
};

@vertex
fn vsMain(@builtin(vertex_index) vertexIndex: u32, @builtin(instance_index) instanceIndex: u32) -> VertexOut {
  var quad = array<vec2f, 6>(
    vec2f(-1.0, -1.0),
    vec2f(1.0, -1.0),
    vec2f(-1.0, 1.0),
    vec2f(-1.0, 1.0),
    vec2f(1.0, -1.0),
    vec2f(1.0, 1.0),
  );
  let cell = cells.values[instanceIndex];
  var out: VertexOut;
  out.position = vec4f(cell.xy + quad[vertexIndex] * vec2f(0.045, 0.075), 0.0, 1.0);
  out.color = mix(vec3f(0.12, 0.72, 1.0), vec3f(1.0, 0.7, 0.24), cell.z);
  return out;
}

@fragment
fn fsMain(input: VertexOut) -> @location(0) vec4f {
  return vec4f(input.color, 1.0);
}
