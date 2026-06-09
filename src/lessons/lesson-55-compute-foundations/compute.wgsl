struct ComputeUniforms {
  time: f32,
  elementCount: f32,
  focusIndex: f32,
  pulseStrength: f32,
};

struct ComputeCell {
  phaseSeed: f32,
  bandSeed: f32,
  value: f32,
  workgroupTag: f32,
};

@group(0) @binding(0) var<uniform> uniforms: ComputeUniforms;
@group(0) @binding(1) var<storage, read_write> cells: array<ComputeCell>;

const workgroupSize = 16u;

@compute @workgroup_size(workgroupSize)
fn csMain(
  @builtin(global_invocation_id) globalId: vec3<u32>,
  @builtin(local_invocation_id) localId: vec3<u32>,
  @builtin(workgroup_id) workgroupId: vec3<u32>
) {
  let cellIndex = globalId.x;
  let elementCount = u32(uniforms.elementCount);

  if (cellIndex >= elementCount) {
    return;
  }

  var cell = cells[cellIndex];
  let focusDistance = abs(f32(cellIndex) - uniforms.focusIndex);
  let focusBoost = max(0.0, 1.0 - focusDistance / 18.0);
  let phase = uniforms.time * (0.95 + cell.bandSeed * 0.35);
  let primaryWave = 0.5 + 0.5 * sin(phase + cell.phaseSeed * 6.2831853);
  let localWave = 0.5 + 0.5 * sin(
    uniforms.time * 2.35 +
      f32(localId.x) * 0.42 +
      f32(workgroupId.x) * 0.58 +
      cell.bandSeed
  );
  let targetValue = clamp(
    mix(primaryWave, localWave, 0.36) + focusBoost * uniforms.pulseStrength * 0.38,
    0.0,
    1.0
  );

  cell.value = mix(cell.value, targetValue, 0.18);
  cell.workgroupTag = f32(workgroupId.x);
  cells[cellIndex] = cell;
}
