struct CullingUniforms {
  frustumPlanes: array<vec4f, 6>,
  instanceCount: u32,
  _padding0: u32,
  _padding1: u32,
  _padding2: u32,
};

struct InstanceData {
  centerRadius: vec4f,
  scaleLod: vec4f,
  color: vec4f,
};

struct VisibleCounter {
  value: atomic<u32>,
};

@group(0) @binding(0) var<uniform> uniforms: CullingUniforms;
@group(0) @binding(1) var<storage, read> instances: array<InstanceData>;
@group(0) @binding(2) var<storage, read_write> visibilityFlags: array<u32>;
@group(0) @binding(3) var<storage, read_write> visibleCounter: VisibleCounter;

fn sphereIntersectsFrustum(center: vec3f, radius: f32) -> bool {
  for (var planeIndex: u32 = 0u; planeIndex < 6u; planeIndex += 1u) {
    let plane = uniforms.frustumPlanes[planeIndex];
    let distance = dot(plane.xyz, center) + plane.w;
    if (distance < -radius) {
      return false;
    }
  }

  return true;
}

@compute @workgroup_size(64)
fn csMain(@builtin(global_invocation_id) globalId: vec3u) {
  let instanceIndex = globalId.x;
  if (instanceIndex >= uniforms.instanceCount) {
    return;
  }

  let instance = instances[instanceIndex];
  let visible = select(0u, 1u, sphereIntersectsFrustum(instance.centerRadius.xyz, instance.centerRadius.w));
  visibilityFlags[instanceIndex] = visible;

  if (visible == 1u) {
    atomicAdd(&visibleCounter.value, 1u);
  }
}
