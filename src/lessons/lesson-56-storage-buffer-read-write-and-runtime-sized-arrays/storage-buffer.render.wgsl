struct OutputCells {
  cells: array<vec4f>,
};

@group(0) @binding(0) var<storage, read> outputCells: OutputCells;

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
  let columns = 8u;
  let cell = outputCells.cells[instanceIndex];
  let grid = vec2f(f32(instanceIndex % columns), f32(instanceIndex / columns));
  let center = vec2f(-0.78, 0.68) + grid * vec2f(0.225, -0.19);
  let size = vec2f(0.082, 0.07 + cell.y * 0.05);
  var out: VertexOut;
  out.position = vec4f(center + quad[vertexIndex] * size, 0.0, 1.0);
  out.color = mix(vec3f(0.13, 0.78, 1.0), vec3f(1.0, 0.68, 0.25), cell.z);
  return out;
}

@fragment
fn fsMain(input: VertexOut) -> @location(0) vec4f {
  return vec4f(input.color, 1.0);
}
