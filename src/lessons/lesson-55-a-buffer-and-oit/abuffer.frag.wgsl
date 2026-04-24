struct SceneUniforms {
  viewProjectionMatrix: mat4x4f,
  eyePosition: vec4f,
  lightDirection: vec4f,
  ambientColor: vec4f,
  pixelInfo: vec4u,
};

struct SceneFragmentInput {
  @builtin(position) position: vec4f,
  @location(0) worldPosition: vec3f,
  @location(1) worldNormal: vec3f,
  @location(2) baseColor: vec4f,
};

struct FragmentNode {
  depthBits: u32,
  colorPacked: u32,
};

struct ABufferStats {
  activePixels: atomic<u32>,
  maxLayers: atomic<u32>,
  overflowCount: atomic<u32>,
  storedFragments: atomic<u32>,
};

@group(0) @binding(0) var<uniform> scene: SceneUniforms;
@group(0) @binding(1) var<storage, read_write> counts: array<atomic<u32>>;
@group(0) @binding(2) var<storage, read_write> fragments: array<FragmentNode>;
@group(0) @binding(3) var<storage, read_write> stats: ABufferStats;

fn shadeSurface(input: SceneFragmentInput) -> vec3f {
  let normal = normalize(input.worldNormal);
  let lightDirection = normalize(-scene.lightDirection.xyz);
  let viewDirection = normalize(scene.eyePosition.xyz - input.worldPosition);
  let halfVector = normalize(lightDirection + viewDirection);

  let diffuse = max(dot(normal, lightDirection), 0.0);
  let specular = pow(max(dot(normal, halfVector), 0.0), 28.0);
  let fresnel = pow(1.0 - max(dot(normal, viewDirection), 0.0), 2.0);

  let litColor =
    input.baseColor.rgb * (scene.ambientColor.rgb + diffuse * 0.88) +
    vec3f(0.36, 0.42, 0.5) * specular * 0.22 +
    input.baseColor.rgb * fresnel * 0.08;

  return clamp(litColor, vec3f(0.0), vec3f(1.0));
}

@fragment
fn fsGather(input: SceneFragmentInput) -> @location(0) vec4f {
  let width = max(scene.pixelInfo.x, 1u);
  let height = max(scene.pixelInfo.y, 1u);
  let capacity = max(scene.pixelInfo.z, 1u);
  let pixelX = min(u32(input.position.x), width - 1u);
  let pixelY = min(u32(input.position.y), height - 1u);
  let pixelIndex = pixelY * width + pixelX;
  let slot = atomicAdd(&counts[pixelIndex], 1u);
  let layerCount = slot + 1u;

  if (slot == 0u) {
    atomicAdd(&stats.activePixels, 1u);
  }

  atomicMax(&stats.maxLayers, layerCount);

  if (slot >= capacity) {
    atomicAdd(&stats.overflowCount, 1u);
    return vec4f(0.0);
  }

  let shadedColor = shadeSurface(input);
  let alpha = clamp(input.baseColor.a, 0.0, 1.0);
  let packedColor = pack4x8unorm(vec4f(shadedColor * alpha, alpha));
  let nodeIndex = pixelIndex * capacity + slot;

  fragments[nodeIndex].depthBits = bitcast<u32>(input.position.z);
  fragments[nodeIndex].colorPacked = packedColor;
  atomicAdd(&stats.storedFragments, 1u);

  return vec4f(0.0);
}
