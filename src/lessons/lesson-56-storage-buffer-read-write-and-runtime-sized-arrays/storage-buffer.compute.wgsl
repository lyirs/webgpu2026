struct InputValues {
  values: array<f32>,
};

struct OutputCells {
  cells: array<vec4f>,
};

@group(0) @binding(0) var<storage, read> inputValues: InputValues;
@group(0) @binding(1) var<storage, read_write> outputCells: OutputCells;

@compute @workgroup_size(64)
fn csMain(@builtin(global_invocation_id) globalId: vec3u) {
  let count = arrayLength(&inputValues.values);
  if (globalId.x >= count) {
    return;
  }

  let index = globalId.x;
  let normalizedIndex = f32(index) / max(1.0, f32(count - 1u));
  let value = inputValues.values[index];
  let wave = 0.5 + 0.5 * sin(value * 6.28318);
  outputCells.cells[index] = vec4f(normalizedIndex, value, wave, 1.0);
}
