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
@group(0) @binding(1) var<storage, read_write> outputCells: OutputCells;

@compute @workgroup_size(8, 4, 1)
fn csMain(
  @builtin(global_invocation_id) globalId: vec3u,
  @builtin(local_invocation_id) localId: vec3u,
  @builtin(workgroup_id) workgroupId: vec3u
) {
  if (globalId.x >= params.columns || globalId.y >= params.rows) {
    return;
  }

  let index = globalId.y * params.columns + globalId.x;
  let localColor = vec3f(f32(localId.x) / 7.0, f32(localId.y) / 3.0, 0.65);
  let groupStripe = f32((workgroupId.x + workgroupId.y) % 2u) * 0.18;
  outputCells.cells[index] = vec4f(localColor + groupStripe, 1.0);
}
