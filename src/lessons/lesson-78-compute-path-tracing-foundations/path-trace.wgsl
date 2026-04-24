struct TraceParams {
  screen: vec4f,
  eyeAndBounces: vec4f,
  forwardAndSpp: vec4f,
  right: vec4f,
  up: vec4f,
  skyColor: vec4f,
};

struct HitInfo {
  t: f32,
  hitPosition: vec3f,
  normal: vec3f,
  albedo: vec3f,
  emission: vec3f,
  hit: u32,
};

struct BoxData {
  minCorner: vec3f,
  maxCorner: vec3f,
  albedo: vec3f,
  emission: vec3f,
};

@group(0) @binding(0) var<storage, read> sceneData: array<vec4f>;
@group(0) @binding(1) var<storage, read_write> tracePixels: array<vec4f>;
@group(0) @binding(2) var<uniform> params: TraceParams;

fn readBox(index: u32) -> BoxData {
  let base = index * 4u;
  return BoxData(
    sceneData[base].xyz,
    sceneData[base + 1u].xyz,
    sceneData[base + 2u].xyz,
    sceneData[base + 3u].xyz
  );
}

fn tea(seed: u32) -> u32 {
  var value = seed;
  value ^= value >> 16u;
  value *= 2246822519u;
  value ^= value >> 13u;
  value *= 3266489917u;
  value ^= value >> 16u;
  return value;
}

fn nextRandom(state: ptr<function, u32>) -> f32 {
  (*state) = tea((*state) + 747796405u);
  return f32((*state) & 0x00ffffffu) / 16777215.0;
}

fn cosineSampleHemisphere(u1: f32, u2: f32) -> vec3f {
  let radius = sqrt(u1);
  let angle = 6.28318530718 * u2;
  let x = radius * cos(angle);
  let z = radius * sin(angle);
  let y = sqrt(max(0.0, 1.0 - u1));
  return vec3f(x, y, z);
}

fn createBasis(normal: vec3f) -> mat3x3f {
  let helper = select(vec3f(0.0, 1.0, 0.0), vec3f(1.0, 0.0, 0.0), abs(normal.y) > 0.999);
  let tangent = normalize(cross(helper, normal));
  let bitangent = cross(normal, tangent);
  return mat3x3f(tangent, normal, bitangent);
}

fn worldFromLocal(localDirection: vec3f, normal: vec3f) -> vec3f {
  return normalize(createBasis(normal) * localDirection);
}

fn intersectBox(origin: vec3f, direction: vec3f, box: BoxData) -> HitInfo {
  let invDirection = 1.0 / direction;
  let t0 = (box.minCorner - origin) * invDirection;
  let t1 = (box.maxCorner - origin) * invDirection;
  let near3 = min(t0, t1);
  let far3 = max(t0, t1);
  let tNear = max(max(near3.x, near3.y), near3.z);
  let tFar = min(min(far3.x, far3.y), far3.z);

  if (tFar < max(tNear, 0.0001)) {
    return HitInfo(0.0, vec3f(0.0), vec3f(0.0), vec3f(0.0), vec3f(0.0), 0u);
  }

  let hitT = max(tNear, 0.0001);
  let hitPosition = origin + direction * hitT;
  let epsilon = 0.002 + hitT * 0.001;

  var normal = vec3f(0.0, 1.0, 0.0);
  if (abs(hitPosition.x - box.minCorner.x) < epsilon) {
    normal = vec3f(-1.0, 0.0, 0.0);
  } else if (abs(hitPosition.x - box.maxCorner.x) < epsilon) {
    normal = vec3f(1.0, 0.0, 0.0);
  } else if (abs(hitPosition.y - box.minCorner.y) < epsilon) {
    normal = vec3f(0.0, -1.0, 0.0);
  } else if (abs(hitPosition.y - box.maxCorner.y) < epsilon) {
    normal = vec3f(0.0, 1.0, 0.0);
  } else if (abs(hitPosition.z - box.minCorner.z) < epsilon) {
    normal = vec3f(0.0, 0.0, -1.0);
  } else if (abs(hitPosition.z - box.maxCorner.z) < epsilon) {
    normal = vec3f(0.0, 0.0, 1.0);
  }

  return HitInfo(hitT, hitPosition, normal, box.albedo, box.emission, 1u);
}

fn traceScene(origin: vec3f, direction: vec3f) -> HitInfo {
  let boxCount = u32(params.up.w);
  var best = HitInfo(0.0, vec3f(0.0), vec3f(0.0), vec3f(0.0), vec3f(0.0), 0u);
  var bestT = 1e20;

  for (var boxIndex = 0u; boxIndex < boxCount; boxIndex += 1u) {
    let box = readBox(boxIndex);
    let hit = intersectBox(origin, direction, box);
    if (hit.hit == 1u && hit.t < bestT) {
      bestT = hit.t;
      best = hit;
    }
  }

  return best;
}

fn sampleSky(direction: vec3f) -> vec3f {
  let upness = max(direction.y, 0.0);
  return params.skyColor.xyz * (0.6 + upness * 1.4);
}

fn tracePath(origin: vec3f, direction: vec3f, rngState: ptr<function, u32>) -> vec3f {
  var rayOrigin = origin;
  var rayDirection = direction;
  var throughput = vec3f(1.0);
  var radiance = vec3f(0.0);
  let maxBounce = u32(params.eyeAndBounces.w);

  for (var bounce = 0u; bounce < maxBounce; bounce += 1u) {
    let hit = traceScene(rayOrigin, rayDirection);
    if (hit.hit == 0u) {
      radiance += throughput * sampleSky(rayDirection);
      break;
    }

    radiance += throughput * hit.emission;
    if (max(hit.emission.x, max(hit.emission.y, hit.emission.z)) > 0.0) {
      break;
    }

    throughput *= hit.albedo;
    let localDirection = cosineSampleHemisphere(nextRandom(rngState), nextRandom(rngState));
    let worldDirection = worldFromLocal(localDirection, hit.normal);
    rayOrigin = hit.hitPosition + hit.normal * 0.003;
    rayDirection = worldDirection;
  }

  return radiance;
}

@compute @workgroup_size(8, 8, 1)
fn traceMain(@builtin(global_invocation_id) globalId: vec3u) {
  let width = u32(params.screen.x);
  let height = u32(params.screen.y);
  if (globalId.x >= width || globalId.y >= height) {
    return;
  }

  let pixelIndex = globalId.y * width + globalId.x;
  let seed = u32(params.screen.w);
  let spp = max(u32(params.forwardAndSpp.w), 1u);
  var rngState = pixelIndex * 9781u + seed * 6271u + 17u;
  var radiance = vec3f(0.0);

  for (var sampleIndex = 0u; sampleIndex < spp; sampleIndex += 1u) {
    let jitter = vec2f(nextRandom(&rngState), nextRandom(&rngState));
    let uv = (vec2f(globalId.xy) + jitter) / vec2f(f32(width), f32(height));
    let ndc = vec2f(uv.x * 2.0 - 1.0, 1.0 - uv.y * 2.0);
    let rayDirection = normalize(
      params.forwardAndSpp.xyz +
      params.right.xyz * ndc.x +
      params.up.xyz * ndc.y
    );
    radiance += tracePath(params.eyeAndBounces.xyz, rayDirection, &rngState);
  }

  tracePixels[pixelIndex] = vec4f(radiance / f32(spp), 1.0);
}
