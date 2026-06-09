struct CullingUniforms {
  frustumPlanes: array<vec4f, 6>,
  instanceCount: u32,
  _padding0: u32,
  _padding1: u32,
  _padding2: u32,
};

struct ScanUniforms {
  instanceCount: u32,
  offset: u32,
  indexCount: u32,
  _padding: u32,
};

struct InstanceData {
  centerRadius: vec4f,
  scaleLod: vec4f,
  color: vec4f,
};

struct VisibleCounter {
  value: atomic<u32>,
};

@group(0) @binding(0) var<uniform> cullingUniforms: CullingUniforms;
@group(0) @binding(1) var<storage, read> cullingInstances: array<InstanceData>;
@group(0) @binding(2) var<storage, read_write> visibilityFlags: array<u32>;
@group(0) @binding(3) var<storage, read_write> visibleCounter: VisibleCounter;

@group(1) @binding(0) var<uniform> scanUniforms: ScanUniforms;
@group(1) @binding(1) var<storage, read> scanFlags: array<u32>;
@group(1) @binding(2) var<storage, read> scanRead: array<u32>;
@group(1) @binding(3) var<storage, read_write> scanWrite: array<u32>;

@group(2) @binding(0) var<uniform> compactUniforms: ScanUniforms;
@group(2) @binding(1) var<storage, read> compactFlags: array<u32>;
@group(2) @binding(2) var<storage, read> finalScan: array<u32>;
@group(2) @binding(3) var<storage, read> sourceInstances: array<InstanceData>;
@group(2) @binding(4) var<storage, read_write> compactedInstances: array<InstanceData>;
@group(2) @binding(5) var<storage, read_write> indirectArgs: array<u32>;

fn sphereIntersectsFrustum(center: vec3f, radius: f32) -> bool {
  for (var planeIndex: u32 = 0u; planeIndex < 6u; planeIndex += 1u) {
    let plane = cullingUniforms.frustumPlanes[planeIndex];
    let distance = dot(plane.xyz, center) + plane.w;
    if (distance < -radius) {
      return false;
    }
  }

  return true;
}

@compute @workgroup_size(64)
fn csFrustumFlags(@builtin(global_invocation_id) globalId: vec3u) {
  let instanceIndex = globalId.x;
  if (instanceIndex >= cullingUniforms.instanceCount) {
    return;
  }

  let instance = cullingInstances[instanceIndex];
  let visible = select(0u, 1u, sphereIntersectsFrustum(instance.centerRadius.xyz, instance.centerRadius.w));
  visibilityFlags[instanceIndex] = visible;

  if (visible == 1u) {
    atomicAdd(&visibleCounter.value, 1u);
  }
}

@compute @workgroup_size(64)
fn csSeedScan(@builtin(global_invocation_id) globalId: vec3u) {
  let instanceIndex = globalId.x;
  if (instanceIndex >= scanUniforms.instanceCount) {
    return;
  }

  scanWrite[instanceIndex] = scanFlags[instanceIndex];
}

@compute @workgroup_size(64)
fn csPrefixSumStep(@builtin(global_invocation_id) globalId: vec3u) {
  let instanceIndex = globalId.x;
  if (instanceIndex >= scanUniforms.instanceCount) {
    return;
  }

  var inclusive = scanRead[instanceIndex];
  if (instanceIndex >= scanUniforms.offset) {
    inclusive += scanRead[instanceIndex - scanUniforms.offset];
  }

  scanWrite[instanceIndex] = inclusive;
}

@compute @workgroup_size(64)
fn csCompact(@builtin(global_invocation_id) globalId: vec3u) {
  let instanceIndex = globalId.x;
  if (instanceIndex >= compactUniforms.instanceCount) {
    return;
  }

  if (compactFlags[instanceIndex] == 0u) {
    return;
  }

  let compactIndex = finalScan[instanceIndex] - 1u;
  compactedInstances[compactIndex] = sourceInstances[instanceIndex];
}

@compute @workgroup_size(1)
fn csWriteIndirect(@builtin(global_invocation_id) globalId: vec3u) {
  if (globalId.x > 0u) {
    return;
  }

  var visibleCount = 0u;
  if (compactUniforms.instanceCount > 0u) {
    visibleCount = finalScan[compactUniforms.instanceCount - 1u];
  }
  indirectArgs[0] = compactUniforms.indexCount;
  indirectArgs[1] = visibleCount;
  indirectArgs[2] = 0u;
  indirectArgs[3] = 0u;
  indirectArgs[4] = 0u;
}
