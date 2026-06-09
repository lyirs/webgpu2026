struct SceneUniforms {
  viewProjectionMatrix: mat4x4f,
  viewMatrix: mat4x4f,
  eyePosition: vec4f,
  viewportRect: vec4f,
  clusterInfo: vec4u,
  depthParams: vec4f,
};

struct Light {
  positionRange: vec4f,
  colorIntensity: vec4f,
};

struct FragmentInput {
  @builtin(position) position: vec4f,
  @location(0) worldPosition: vec3f,
  @location(1) worldNormal: vec3f,
  @location(2) baseColor: vec3f,
  @location(3) viewDepth: f32,
};

struct MarkerInput {
  @location(0) color: vec3f,
};

const MAX_LIGHTS_PER_CLUSTER = 36u;

@group(0) @binding(0) var<uniform> scene: SceneUniforms;
@group(0) @binding(1) var<storage, read> lights: array<Light>;
@group(0) @binding(2) var<storage, read> clusterCounts: array<u32>;
@group(0) @binding(3) var<storage, read> clusterLightIndices: array<u32>;

fn shadeLight(input: FragmentInput, light: Light) -> vec3f {
  let toLight = light.positionRange.xyz - input.worldPosition;
  let distance = length(toLight);
  let radius = max(light.positionRange.w, 0.0001);

  if (distance >= radius) {
    return vec3f(0.0);
  }

  let lightDirection = toLight / max(distance, 0.0001);
  let diffuse = max(dot(normalize(input.worldNormal), lightDirection), 0.0);
  let attenuation = pow(1.0 - clamp(distance / radius, 0.0, 1.0), 2.0);
  let viewDirection = normalize(scene.eyePosition.xyz - input.worldPosition);
  let halfVector = normalize(lightDirection + viewDirection);
  let specular = pow(max(dot(normalize(input.worldNormal), halfVector), 0.0), 26.0);

  let diffuseColor =
    input.baseColor * light.colorIntensity.rgb * diffuse * attenuation * light.colorIntensity.a;
  let specularColor = light.colorIntensity.rgb * specular * attenuation * 0.26;

  return diffuseColor + specularColor;
}

fn clusterIndexForFragment(input: FragmentInput) -> u32 {
  let tileCountX = max(scene.clusterInfo.x, 1u);
  let tileCountY = max(scene.clusterInfo.y, 1u);
  let sliceCount = max(scene.clusterInfo.z, 1u);

  let localX = clamp(
    input.position.x - scene.viewportRect.x,
    0.0,
    max(scene.viewportRect.z - 1.0, 0.0)
  );
  let localY = clamp(
    input.position.y - scene.viewportRect.y,
    0.0,
    max(scene.viewportRect.w - 1.0, 0.0)
  );

  let tileWidth = max(scene.viewportRect.z / f32(tileCountX), 1.0);
  let tileHeight = max(scene.viewportRect.w / f32(tileCountY), 1.0);
  let tileX = min(u32(localX / tileWidth), tileCountX - 1u);
  let tileY = min(u32(localY / tileHeight), tileCountY - 1u);

  let nearPlane = scene.depthParams.x;
  let farPlane = scene.depthParams.y;
  let depthT = clamp(
    (input.viewDepth - nearPlane) / max(farPlane - nearPlane, 0.0001),
    0.0,
    0.9999
  );
  let sliceZ = min(u32(depthT * f32(sliceCount)), sliceCount - 1u);

  return (sliceZ * tileCountY + tileY) * tileCountX + tileX;
}

@fragment
fn fsNaive(input: FragmentInput) -> @location(0) vec4f {
  var color = input.baseColor * 0.10;

  for (var lightIndex = 0u; lightIndex < scene.clusterInfo.w; lightIndex = lightIndex + 1u) {
    color = color + shadeLight(input, lights[lightIndex]);
  }

  return vec4f(color, 1.0);
}

@fragment
fn fsClustered(input: FragmentInput) -> @location(0) vec4f {
  var color = input.baseColor * 0.10;
  let clusterIndex = clusterIndexForFragment(input);
  let count = clusterCounts[clusterIndex];
  let base = clusterIndex * MAX_LIGHTS_PER_CLUSTER;

  for (var listIndex = 0u; listIndex < count; listIndex = listIndex + 1u) {
    let lightIndex = clusterLightIndices[base + listIndex];
    color = color + shadeLight(input, lights[lightIndex]);
  }

  let clusterRatio = clamp(
    f32(count) / max(f32(scene.clusterInfo.w), 1.0),
    0.0,
    1.0
  );
  color = color + vec3f(0.016, 0.032, 0.048) * clusterRatio;

  return vec4f(color, 1.0);
}

@fragment
fn fsLightMarker(input: MarkerInput) -> @location(0) vec4f {
  return vec4f(input.color, 1.0);
}
