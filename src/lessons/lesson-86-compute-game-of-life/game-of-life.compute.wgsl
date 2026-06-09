struct SimulationUniforms {
  gridSize: vec2u,
  padding: vec2u,
};

@group(0) @binding(0) var<uniform> simulationUniforms: SimulationUniforms;
@group(0) @binding(1) var<storage, read> currentState: array<u32>;
@group(0) @binding(2) var<storage, read_write> nextState: array<u32>;

fn wrapCoordinate(value: i32, limit: u32) -> u32 {
  let size = i32(limit);
  let wrapped = ((value % size) + size) % size;
  return u32(wrapped);
}

fn cellIndex(cell: vec2u) -> u32 {
  return cell.y * simulationUniforms.gridSize.x + cell.x;
}

@compute @workgroup_size(8, 8, 1)
fn csMain(@builtin(global_invocation_id) globalId: vec3u) {
  if (
    globalId.x >= simulationUniforms.gridSize.x ||
    globalId.y >= simulationUniforms.gridSize.y
  ) {
    return;
  }

  let cell = globalId.xy;
  let current = currentState[cellIndex(cell)] == 1u;

  var neighbors = 0u;
  for (var offsetY = -1; offsetY <= 1; offsetY = offsetY + 1) {
    for (var offsetX = -1; offsetX <= 1; offsetX = offsetX + 1) {
      if (offsetX == 0 && offsetY == 0) {
        continue;
      }

      let neighbor = vec2u(
        wrapCoordinate(i32(cell.x) + offsetX, simulationUniforms.gridSize.x),
        wrapCoordinate(i32(cell.y) + offsetY, simulationUniforms.gridSize.y)
      );
      neighbors = neighbors + currentState[cellIndex(neighbor)];
    }
  }

  let survives = current && (neighbors == 2u || neighbors == 3u);
  let born = !current && neighbors == 3u;
  nextState[cellIndex(cell)] = select(0u, 1u, survives || born);
}
