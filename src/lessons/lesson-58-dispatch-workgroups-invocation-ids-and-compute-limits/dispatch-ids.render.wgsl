struct DispatchParams {
  columns: u32,
  rows: u32,
  activeCount: u32,
  padding: u32,
};

struct OutputCells {
  cells: array<vec4f>,
};

@group(0) @binding(0) var<uniform> params: DispatchParams;
@group(0) @binding(1) var<storage, read> outputCells: OutputCells;

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
  let column = instanceIndex % params.columns;
  let row = instanceIndex / params.columns;
  let cellSize = vec2f(1.84 / f32(params.columns), 1.58 / f32(params.rows));
  let center = vec2f(-0.92, 0.79) + vec2f(f32(column), -f32(row)) * cellSize + vec2f(cellSize.x, -cellSize.y) * 0.5;
  var out: VertexOut;
  out.position = vec4f(center + quad[vertexIndex] * cellSize * 0.42, 0.0, 1.0);
  out.color = outputCells.cells[instanceIndex].rgb;
  return out;
}

@fragment
fn fsMain(input: VertexOut) -> @location(0) vec4f {
  return vec4f(input.color, 1.0);
}
