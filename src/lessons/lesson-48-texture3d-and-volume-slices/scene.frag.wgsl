struct SceneUniforms {
  viewProjectionMatrix: mat4x4f,
  eyePosition: vec4f,
  lightPosition: vec4f,
  sliceParams: vec4f,
};

struct FragmentInput {
  @location(0) worldPosition: vec3f,
  @location(1) worldNormal: vec3f,
  @location(2) localPosition: vec3f,
  @location(3) objectColor: vec4f,
  @location(4) surfaceParams: vec4f,
};

@group(0) @binding(0) var<uniform> sceneUniforms: SceneUniforms;
@group(2) @binding(0) var volumeTexture: texture_3d<f32>;
@group(2) @binding(1) var volumeSampler: sampler;

fn litColor(input: FragmentInput) -> vec3f {
  let normal = normalize(input.worldNormal);
  let lightDirection = normalize(sceneUniforms.lightPosition.xyz - input.worldPosition);
  let viewDirection = normalize(sceneUniforms.eyePosition.xyz - input.worldPosition);
  let halfVector = normalize(lightDirection + viewDirection);

  let lambert = max(dot(normal, lightDirection), 0.0);
  let specular = pow(max(dot(normal, halfVector), 0.0), 24.0);
  let ambient = vec3f(0.09, 0.11, 0.14);

  var baseColor = input.objectColor.rgb;
  if (input.surfaceParams.x > 0.5) {
    let detailScale = max(0.0001, input.surfaceParams.y);
    let gridUv = abs(fract(input.worldPosition.xz * detailScale) - 0.5);
    let gridLine = 1.0 - smoothstep(0.45, 0.5, min(gridUv.x, gridUv.y));
    baseColor += vec3f(0.14, 0.18, 0.24) * gridLine;
  }

  return ambient + baseColor * (0.24 + lambert * 0.92) + vec3f(0.85) * specular * 0.16;
}

fn buildSliceUvw(localPosition: vec3f, axisMode: f32, sliceDepth: f32) -> vec3f {
  let planeUv = localPosition.xy * 0.5 + 0.5;
  let depth = clamp(sliceDepth * 0.5 + 0.5, 0.0, 1.0);

  if (axisMode < 0.5) {
    return vec3f(planeUv.x, planeUv.y, depth);
  }

  if (axisMode < 1.5) {
    return vec3f(planeUv.x, depth, planeUv.y);
  }

  return vec3f(depth, planeUv.x, planeUv.y);
}

fn densityColor(density: f32, densityGain: f32) -> vec3f {
  let shapedDensity = clamp(max(0.0, density - 0.08) * densityGain, 0.0, 1.0);
  let cool = mix(vec3f(0.06, 0.12, 0.2), vec3f(0.18, 0.84, 1.0), shapedDensity);
  let warm = vec3f(1.0, 0.72, 0.34) * smoothstep(0.32, 0.95, shapedDensity) * 0.62;
  return cool + warm;
}

@fragment
fn opaqueFragment(input: FragmentInput) -> @location(0) vec4f {
  return vec4f(litColor(input), 1.0);
}

@fragment
fn sliceFragment(input: FragmentInput) -> @location(0) vec4f {
  let sliceDepth = sceneUniforms.sliceParams.x;
  let densityGain = sceneUniforms.sliceParams.y;
  let axisMode = sceneUniforms.sliceParams.z;
  let textureSize = max(sceneUniforms.sliceParams.w, 1.0);

  let planeUv = input.localPosition.xy * 0.5 + 0.5;
  let uvw = buildSliceUvw(input.localPosition, axisMode, sliceDepth);
  let density = textureSampleLevel(volumeTexture, volumeSampler, uvw, 0.0).r;
  let shapedDensity = clamp(max(0.0, density - 0.08) * densityGain, 0.0, 1.0);

  let voxelUv = planeUv * textureSize;
  let voxelCell = abs(fract(voxelUv) - 0.5);
  let texelGrid = 1.0 - smoothstep(0.42, 0.5, min(voxelCell.x, voxelCell.y));
  let contour = 1.0 - smoothstep(0.16, 0.5, abs(fract(density * densityGain * 9.0) - 0.5));
  let frameFade = smoothstep(1.0, 0.78, max(abs(input.localPosition.x), abs(input.localPosition.y)));

  let baseColor = densityColor(density, densityGain);
  let highlightedColor =
    baseColor +
    vec3f(0.18, 0.24, 0.28) * texelGrid +
    vec3f(0.28, 0.16, 0.08) * contour;
  let color = highlightedColor * frameFade;
  let alpha = mix(0.18, 0.94, shapedDensity) * frameFade;
  return vec4f(color, alpha);
}
