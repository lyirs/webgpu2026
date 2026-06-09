struct ClusterUniforms {
  viewMatrix: mat4x4f,
  counts: vec4u,
  camera: vec4f,
};

struct Light {
  positionRange: vec4f,
  colorIntensity: vec4f,
};

struct ClusterBounds {
  min: vec3f,
  max: vec3f,
};

const MAX_LIGHTS_PER_CLUSTER = 36u;

@group(0) @binding(0) var<uniform> params: ClusterUniforms;
@group(0) @binding(1) var<storage, read> lights: array<Light>;
@group(0) @binding(2) var<storage, read_write> clusterCounts: array<u32>;
@group(0) @binding(3) var<storage, read_write> clusterLightIndices: array<u32>;

fn clusterCount() -> u32 {
  return params.counts.x * params.counts.y * params.counts.z;
}

fn clusterCorner(
  tileX: u32,
  tileY: u32,
  sliceZ: u32,
  xMix: f32,
  yMix: f32,
  zMix: f32
) -> vec3f {
  let depthNear = params.camera.x;
  let depthFar = params.camera.y;
  let tanHalfFovX = params.camera.z;
  let tanHalfFovY = params.camera.w;
  let tileCountX = f32(max(params.counts.x, 1u));
  let tileCountY = f32(max(params.counts.y, 1u));
  let sliceCount = f32(max(params.counts.z, 1u));
  let sliceMinDepth = mix(depthNear, depthFar, f32(sliceZ) / sliceCount);
  let sliceMaxDepth = mix(depthNear, depthFar, f32(sliceZ + 1u) / sliceCount);
  let depth = mix(sliceMinDepth, sliceMaxDepth, zMix);
  let ndcMinX = -1.0 + 2.0 * f32(tileX) / tileCountX;
  let ndcMaxX = -1.0 + 2.0 * f32(tileX + 1u) / tileCountX;
  let ndcMaxY = 1.0 - 2.0 * f32(tileY) / tileCountY;
  let ndcMinY = 1.0 - 2.0 * f32(tileY + 1u) / tileCountY;
  let ndcX = mix(ndcMinX, ndcMaxX, xMix);
  let ndcY = mix(ndcMinY, ndcMaxY, yMix);

  return vec3f(
    ndcX * depth * tanHalfFovX,
    ndcY * depth * tanHalfFovY,
    depth
  );
}

fn clusterBounds(clusterIndex: u32) -> ClusterBounds {
  let tileCountX = max(params.counts.x, 1u);
  let tileCountY = max(params.counts.y, 1u);
  let tileArea = tileCountX * tileCountY;
  let sliceZ = clusterIndex / tileArea;
  let tileIndex = clusterIndex - sliceZ * tileArea;
  let tileY = tileIndex / tileCountX;
  let tileX = tileIndex - tileY * tileCountX;

  let corner0 = clusterCorner(tileX, tileY, sliceZ, 0.0, 0.0, 0.0);
  let corner1 = clusterCorner(tileX, tileY, sliceZ, 1.0, 0.0, 0.0);
  let corner2 = clusterCorner(tileX, tileY, sliceZ, 0.0, 1.0, 0.0);
  let corner3 = clusterCorner(tileX, tileY, sliceZ, 1.0, 1.0, 0.0);
  let corner4 = clusterCorner(tileX, tileY, sliceZ, 0.0, 0.0, 1.0);
  let corner5 = clusterCorner(tileX, tileY, sliceZ, 1.0, 0.0, 1.0);
  let corner6 = clusterCorner(tileX, tileY, sliceZ, 0.0, 1.0, 1.0);
  let corner7 = clusterCorner(tileX, tileY, sliceZ, 1.0, 1.0, 1.0);

  let minCorner = min(
    min(min(corner0, corner1), min(corner2, corner3)),
    min(min(corner4, corner5), min(corner6, corner7))
  );
  let maxCorner = max(
    max(max(corner0, corner1), max(corner2, corner3)),
    max(max(corner4, corner5), max(corner6, corner7))
  );

  return ClusterBounds(minCorner, maxCorner);
}

fn sphereIntersectsBounds(center: vec3f, radius: f32, bounds: ClusterBounds) -> bool {
  let closest = clamp(center, bounds.min, bounds.max);
  let delta = center - closest;
  return dot(delta, delta) <= radius * radius;
}

@compute @workgroup_size(64)
fn csMain(@builtin(global_invocation_id) globalId: vec3u) {
  let clusterIndex = globalId.x;
  let totalClusters = clusterCount();

  if (clusterIndex >= totalClusters) {
    return;
  }

  let bounds = clusterBounds(clusterIndex);
  let base = clusterIndex * MAX_LIGHTS_PER_CLUSTER;
  var count = 0u;

  for (var lightIndex = 0u; lightIndex < params.counts.w; lightIndex = lightIndex + 1u) {
    let light = lights[lightIndex];
    let lightView = params.viewMatrix * vec4f(light.positionRange.xyz, 1.0);
    let center = vec3f(lightView.x, lightView.y, -lightView.z);
    let radius = light.positionRange.w;

    if (center.z + radius < params.camera.x || center.z - radius > params.camera.y) {
      continue;
    }

    if (sphereIntersectsBounds(center, radius, bounds)) {
      if (count < MAX_LIGHTS_PER_CLUSTER) {
        clusterLightIndices[base + count] = lightIndex;
      }
      count = min(count + 1u, MAX_LIGHTS_PER_CLUSTER);
    }
  }

  clusterCounts[clusterIndex] = count;
}
