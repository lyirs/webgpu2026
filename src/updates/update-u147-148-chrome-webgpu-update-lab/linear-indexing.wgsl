requires linear_indexing;

struct Params {
  gridWidth: u32,
  gridHeight: u32,
  frame: u32,
  mode: u32,
  dispatchX: u32,
  dispatchY: u32,
  workgroupSizeX: u32,
  workgroupSizeY: u32,
};

@group(0) @binding(0) var<storage, read_write> outputCells: array<u32>;
@group(0) @binding(1) var<uniform> params: Params;

fn encodeCell(globalIndex: u32, workgroupIndex: u32, frame: u32) -> u32 {
  let shade = (globalIndex * 13u + frame * 3u) & 255u;
  let groupTint = (workgroupIndex & 255u) << 8u;
  return shade | groupTint;
}

@compute @workgroup_size(4, 4, 1)
fn csLinear(
  @builtin(global_invocation_id) globalId: vec3u,
  @builtin(global_invocation_index) globalIndex: u32,
  @builtin(workgroup_index) workgroupIndex: u32
) {
  if (globalId.x >= params.gridWidth || globalId.y >= params.gridHeight) {
    return;
  }

  outputCells[globalIndex] = encodeCell(globalIndex, workgroupIndex, params.frame);
}
