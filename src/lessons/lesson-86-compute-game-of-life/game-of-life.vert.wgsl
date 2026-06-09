struct SimulationUniforms {
  gridSize: vec2u,
  padding: vec2u,
};

@group(0) @binding(0) var<uniform> simulationUniforms: SimulationUniforms;
@group(0) @binding(1) var<storage, read> cellState: array<u32>;

struct VertexOutput {
  @builtin(position) clipPosition: vec4f,
  @location(0) alive: f32,
  @location(1) localUv: vec2f,
};

const quadCorners = array<vec2f, 6>(
  vec2f(0.0, 0.0),
  vec2f(1.0, 0.0),
  vec2f(1.0, 1.0),
  vec2f(0.0, 0.0),
  vec2f(1.0, 1.0),
  vec2f(0.0, 1.0),
);

@vertex
fn vsMain(
  @builtin(vertex_index) vertexIndex: u32,
  @builtin(instance_index) instanceIndex: u32
) -> VertexOutput {
  let width = simulationUniforms.gridSize.x;
  let height = simulationUniforms.gridSize.y;
  let cell = vec2u(instanceIndex % width, instanceIndex / width);
  let grid = vec2f(f32(width), f32(height));

  let uv = quadCorners[vertexIndex];
  let local = uv * 2.0 - vec2f(1.0, 1.0);
  let center = (vec2f(cell) + vec2f(0.5, 0.5)) / grid;
  let clipCenter = vec2f(center.x * 2.0 - 1.0, 1.0 - center.y * 2.0);
  let halfCellSize = vec2f(0.92 / grid.x, 0.92 / grid.y);

  var output: VertexOutput;
  output.clipPosition = vec4f(clipCenter + local * halfCellSize, 0.0, 1.0);
  output.alive = f32(cellState[instanceIndex]);
  output.localUv = uv;
  return output;
}
