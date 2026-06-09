struct Counters {
  left: atomic<u32>,
  right: atomic<u32>,
};

@group(0) @binding(0) var<storage, read_write> counters: Counters;

@compute @workgroup_size(64)
fn csMain(@builtin(global_invocation_id) globalId: vec3u) {
  if (globalId.x >= 64u) {
    return;
  }

  atomicAdd(&counters.left, 1u);
  atomicAdd(&counters.right, 1u);
}
