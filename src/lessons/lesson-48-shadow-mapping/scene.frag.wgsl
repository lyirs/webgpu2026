struct SceneUniforms {
  cameraViewProjectionMatrix: mat4x4f,
  modelMatrix: mat4x4f,
  lightViewProjectionMatrix: mat4x4f,
  lightDirection: vec4f,
}

struct FragmentInput {
  @location(0) color: vec3f,
  @location(1) normal: vec3f,
  @location(2) shadowPosition: vec4f,
}

@group(0) @binding(0) var<uniform> uniforms: SceneUniforms;
@group(0) @binding(1) var shadowTexture: texture_depth_2d;
@group(0) @binding(2) var shadowSampler: sampler_comparison;

@fragment
fn fsMain(input: FragmentInput) -> @location(0) vec4f {
  let lightDirection = normalize(uniforms.lightDirection.xyz);
  let lambert = max(dot(normalize(input.normal), lightDirection), 0.0);
  let ambient = 0.2;

  let shadowClip = input.shadowPosition.xyz / input.shadowPosition.w;
  let shadowUv = shadowClip.xy * vec2f(0.5, -0.5) + vec2f(0.5, 0.5);
  let clampedShadowUv = clamp(shadowUv, vec2f(0.0), vec2f(1.0));
  let shadowDepth = clamp(shadowClip.z - 0.003, 0.0, 1.0);
  let sampledVisibility = textureSampleCompare(
    shadowTexture,
    shadowSampler,
    clampedShadowUv,
    shadowDepth
  );
  let isInsideShadowMap =
    shadowUv.x >= 0.0 &&
    shadowUv.x <= 1.0 &&
    shadowUv.y >= 0.0 &&
    shadowUv.y <= 1.0 &&
    shadowClip.z >= 0.0 &&
    shadowClip.z <= 1.0;

  // textureSampleCompare：把当前片元深度和 shadow map 里存的深度做比较，结果越小表示越可能在阴影里。
  let visibility = select(1.0, sampledVisibility, isInsideShadowMap);

  let diffuse = ambient + lambert * visibility * 0.8;
  return vec4f(input.color * diffuse, 1.0);
}
