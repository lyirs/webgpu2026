struct SyncParams {
  time: f32,
  count: u32,
  padding0: u32,
  padding1: u32,
};

struct Cells {
  values: array<vec4f>,
};

@group(0) @binding(0) var<uniform> params: SyncParams;
@group(0) @binding(1) var<storage, read_write> cells: Cells;

@compute @workgroup_size(64)
fn csMain(@builtin(global_invocation_id) globalId: vec3u) {
  if (globalId.x >= params.count) {
    return;
  }
  let index = globalId.x;
  let t = params.time + f32(index) * 0.19;
  let x = -0.92 + f32(index % 16u) * 0.122;
  let y = 0.72 - f32(index / 16u) * 0.22 + sin(t) * 0.035;
  let energy = 0.5 + 0.5 * sin(t * 1.7);
  cells.values[index] = vec4f(x, y, energy, 1.0);
}
