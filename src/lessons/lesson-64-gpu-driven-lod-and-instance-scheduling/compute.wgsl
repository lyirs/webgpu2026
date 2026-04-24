struct LodUniforms {
  frustumPlanes: array<vec4f, 6>,
  eyePosition: vec4f,
  params: vec4f,
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

@group(0) @binding(0) var<uniform> lodUniforms: LodUniforms;
@group(0) @binding(1) var<storage, read> sourceInstances: array<InstanceData>;
@group(0) @binding(2) var<storage, read_write> visibleFlags: array<u32>;
@group(0) @binding(3) var<storage, read_write> lod0Flags: array<u32>;
@group(0) @binding(4) var<storage, read_write> lod1Flags: array<u32>;
@group(0) @binding(5) var<storage, read_write> lod2Flags: array<u32>;

@group(1) @binding(0) var<uniform> scanUniforms: ScanUniforms;
@group(1) @binding(1) var<storage, read> scanFlags: array<u32>;
@group(1) @binding(2) var<storage, read> scanRead: array<u32>;
@group(1) @binding(3) var<storage, read_write> scanWrite: array<u32>;

@group(2) @binding(0) var<uniform> compactUniforms: ScanUniforms;
@group(2) @binding(1) var<storage, read> compactFlags: array<u32>;
@group(2) @binding(2) var<storage, read> compactScan: array<u32>;
@group(2) @binding(3) var<storage, read> compactSource: array<InstanceData>;
@group(2) @binding(4) var<storage, read_write> compactedInstances: array<InstanceData>;
@group(2) @binding(5) var<storage, read_write> indirectArgs: array<u32>;

fn sphereIntersectsFrustum(center: vec3f, radius: f32) -> bool {
  for (var planeIndex = 0u; planeIndex < 6u; planeIndex += 1u) {
    let plane = lodUniforms.frustumPlanes[planeIndex];
    if (dot(plane.xyz, center) + plane.w < -radius) {
      return false;
    }
  }

  return true;
}

@compute @workgroup_size(64)
fn csClassifyVisibilityAndLod(@builtin(global_invocation_id) globalId: vec3u) {
  let instanceIndex = globalId.x;
  let instanceCount = u32(lodUniforms.params.x);

  if (instanceIndex >= instanceCount) {
    return;
  }

  let instance = sourceInstances[instanceIndex];
  let center = instance.centerRadius.xyz;
  let radius = instance.centerRadius.w;
  let visible = sphereIntersectsFrustum(center, radius);

  visibleFlags[instanceIndex] = select(0u, 1u, visible);
  lod0Flags[instanceIndex] = 0u;
  lod1Flags[instanceIndex] = 0u;
  lod2Flags[instanceIndex] = 0u;

  if (!visible) {
    return;
  }

  let eyePosition = lodUniforms.eyePosition.xyz;
  let distanceToEye = distance(center, eyePosition);
  let distanceScale = lodUniforms.params.y;
  let lod1Distance = 16.0 * distanceScale + instance.scaleLod.w * 4.0;
  let lod2Distance = 29.0 * distanceScale + instance.scaleLod.w * 6.0;

  if (distanceToEye < lod1Distance) {
    lod0Flags[instanceIndex] = 1u;
    return;
  }

  if (distanceToEye < lod2Distance) {
    lod1Flags[instanceIndex] = 1u;
    return;
  }

  lod2Flags[instanceIndex] = 1u;
}

@compute @workgroup_size(64)
fn csSeedScan(@builtin(global_invocation_id) globalId: vec3u) {
  let instanceIndex = globalId.x;
  if (instanceIndex >= scanUniforms.instanceCount) {
    return;
  }

  scanWrite[instanceIndex] = select(0u, scanFlags[instanceIndex - 1u], instanceIndex > 0u);
}

@compute @workgroup_size(64)
fn csPrefixSumStep(@builtin(global_invocation_id) globalId: vec3u) {
  let instanceIndex = globalId.x;
  if (instanceIndex >= scanUniforms.instanceCount) {
    return;
  }

  let baseValue = scanRead[instanceIndex];
  let previousValue = select(0u, scanRead[instanceIndex - scanUniforms.offset], instanceIndex >= scanUniforms.offset);
  scanWrite[instanceIndex] = baseValue + previousValue;
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

  let outputIndex = compactScan[instanceIndex];
  compactedInstances[outputIndex] = compactSource[instanceIndex];
}

@compute @workgroup_size(1)
fn csWriteIndirect() {
  var visibleCount = 0u;
  let lastIndex = compactUniforms.instanceCount - 1u;
  if (compactUniforms.instanceCount > 0u) {
    visibleCount = compactScan[lastIndex] + compactFlags[lastIndex];
  }

  indirectArgs[0] = compactUniforms.indexCount;
  indirectArgs[1] = visibleCount;
  indirectArgs[2] = 0u;
  indirectArgs[3] = 0u;
  indirectArgs[4] = 0u;
}
