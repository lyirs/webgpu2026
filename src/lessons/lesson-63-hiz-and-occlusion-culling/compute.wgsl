struct OcclusionUniforms {
  frustumPlanes: array<vec4f, 6>,
  viewMatrix: mat4x4f,
  projectionMatrix: mat4x4f,
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

@group(0) @binding(0) var<uniform> occlusionUniforms: OcclusionUniforms;
@group(0) @binding(1) var<storage, read> sourceInstances: array<InstanceData>;
@group(0) @binding(2) var<storage, read_write> visibilityFlags: array<u32>;
@group(0) @binding(3) var<storage, read_write> visibilityCounters: array<atomic<u32>, 2>;
@group(0) @binding(4) var hizLevel0: texture_2d<f32>;
@group(0) @binding(5) var hizLevel1: texture_2d<f32>;
@group(0) @binding(6) var hizLevel2: texture_2d<f32>;
@group(0) @binding(7) var hizLevel3: texture_2d<f32>;
@group(0) @binding(8) var hizLevel4: texture_2d<f32>;
@group(0) @binding(9) var hizLevel5: texture_2d<f32>;

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
    let plane = occlusionUniforms.frustumPlanes[planeIndex];
    if (dot(plane.xyz, center) + plane.w < -radius) {
      return false;
    }
  }

  return true;
}

fn projectUv(viewPosition: vec3f) -> vec2f {
  let clip = occlusionUniforms.projectionMatrix * vec4f(viewPosition, 1.0);
  let ndc = clip.xy / max(clip.w, 0.0001);
  return vec2f(ndc.x * 0.5 + 0.5, 0.5 - ndc.y * 0.5);
}

fn projectDepth(viewPosition: vec3f) -> f32 {
  let clip = occlusionUniforms.projectionMatrix * vec4f(viewPosition, 1.0);
  return clip.z / max(clip.w, 0.0001);
}

fn sampleDepthTexture(textureRef: texture_2d<f32>, uv: vec2f) -> f32 {
  let dims = textureDimensions(textureRef);
  let clampedUv = clamp(uv, vec2f(0.0), vec2f(0.99999));
  let coord = clamp(
    vec2i(clampedUv * vec2f(dims)),
    vec2i(0),
    vec2i(dims) - vec2i(1)
  );
  return textureLoad(textureRef, coord, 0).x;
}

fn sampleHiZ(level: u32, uv: vec2f) -> f32 {
  switch level {
    case 0u: {
      return sampleDepthTexture(hizLevel0, uv);
    }
    case 1u: {
      return sampleDepthTexture(hizLevel1, uv);
    }
    case 2u: {
      return sampleDepthTexture(hizLevel2, uv);
    }
    case 3u: {
      return sampleDepthTexture(hizLevel3, uv);
    }
    case 4u: {
      return sampleDepthTexture(hizLevel4, uv);
    }
    default: {
      return sampleDepthTexture(hizLevel5, uv);
    }
  }
}

fn chooseMipLevel(radiusUv: f32) -> u32 {
  let baseWidth = f32(textureDimensions(hizLevel0).x);
  let footprint = max(radiusUv * 2.0 * baseWidth, 1.0);
  let rawLevel = u32(floor(log2(footprint)));
  let maxLevel = max(u32(occlusionUniforms.params.y) - 1u, 0u);
  return min(rawLevel, maxLevel);
}

@compute @workgroup_size(64)
fn csOcclusionFlags(@builtin(global_invocation_id) globalId: vec3u) {
  let instanceIndex = globalId.x;
  let instanceCount = u32(occlusionUniforms.params.x);

  if (instanceIndex >= instanceCount) {
    return;
  }

  let instance = sourceInstances[instanceIndex];
  let center = instance.centerRadius.xyz;
  let radius = instance.centerRadius.w;

  if (!sphereIntersectsFrustum(center, radius)) {
    visibilityFlags[instanceIndex] = 0u;
    return;
  }

  atomicAdd(&visibilityCounters[0], 1u);

  let centerView = (occlusionUniforms.viewMatrix * vec4f(center, 1.0)).xyz;
  if (-centerView.z <= radius + 0.02) {
    visibilityFlags[instanceIndex] = 1u;
    atomicAdd(&visibilityCounters[1], 1u);
    return;
  }

  let centerUv = projectUv(centerView);
  let rightUv = projectUv(centerView + vec3f(radius, 0.0, 0.0));
  let upUv = projectUv(centerView + vec3f(0.0, radius, 0.0));
  let radiusUv = max(abs(rightUv.x - centerUv.x), abs(upUv.y - centerUv.y));
  let mipLevel = chooseMipLevel(radiusUv);

  let frontDepth = projectDepth(vec3f(centerView.xy, centerView.z + radius));
  let sampleRadius = radiusUv * 0.55;
  let sampleOffsets = array<vec2f, 5>(
    vec2f(0.0, 0.0),
    vec2f(sampleRadius, 0.0),
    vec2f(-sampleRadius, 0.0),
    vec2f(0.0, sampleRadius),
    vec2f(0.0, -sampleRadius)
  );

  var occluderDepth = 1.0;
  for (var sampleIndex = 0u; sampleIndex < 5u; sampleIndex += 1u) {
    occluderDepth = min(
      occluderDepth,
      sampleHiZ(mipLevel, centerUv + sampleOffsets[sampleIndex])
    );
  }

  let occlusionBias = occlusionUniforms.params.z;
  let occluded = frontDepth > occluderDepth + occlusionBias;
  visibilityFlags[instanceIndex] = select(1u, 0u, occluded);

  if (!occluded) {
    atomicAdd(&visibilityCounters[1], 1u);
  }
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
