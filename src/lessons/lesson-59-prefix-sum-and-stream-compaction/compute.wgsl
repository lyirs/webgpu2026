struct ScanUniforms {
  elementCount: u32,
  offset: u32,
  columns: u32,
  _padding: u32,
};

@group(0) @binding(0) var<uniform> uniforms: ScanUniforms;
@group(0) @binding(1) var<storage, read> bufferA: array<u32>;
@group(0) @binding(2) var<storage, read_write> bufferB: array<u32>;
@group(0) @binding(3) var<storage, read_write> bufferC: array<u32>;

@compute @workgroup_size(64)
fn csSeedFlags(@builtin(global_invocation_id) globalId: vec3u) {
  let index = globalId.x;
  if (index >= uniforms.elementCount) {
    return;
  }

  scanIndexWrite(index, bufferA[index * 4u + 1u]);
}

@compute @workgroup_size(64)
fn csPrefixSumStep(@builtin(global_invocation_id) globalId: vec3u) {
  let index = globalId.x;
  if (index >= uniforms.elementCount) {
    return;
  }

  var inclusive = bufferA[index];
  if (index >= uniforms.offset) {
    inclusive += bufferA[index - uniforms.offset];
  }

  scanIndexWrite(index, inclusive);
}

@compute @workgroup_size(64)
fn csCompact(@builtin(global_invocation_id) globalId: vec3u) {
  let index = globalId.x;
  if (index >= uniforms.elementCount) {
    return;
  }

  let itemBase = index * 4u;
  let keepFlag = bufferA[itemBase + 1u];
  if (keepFlag == 0u) {
    return;
  }

  let compactIndex = bufferB[index] - 1u;
  let outputBase = compactIndex * 4u;

  bufferC[outputBase + 0u] = bufferA[itemBase + 0u];
  bufferC[outputBase + 1u] = keepFlag;
  bufferC[outputBase + 2u] = bufferA[itemBase + 2u];
  bufferC[outputBase + 3u] = bufferA[itemBase + 3u];
}

fn scanIndexWrite(index: u32, value: u32) {
  bufferB[index] = value;
}
