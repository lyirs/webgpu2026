struct SceneUniforms {
  cameraViewProjectionMatrix: mat4x4f,
  modelMatrix: mat4x4f,
  lightOneViewProjectionMatrix: mat4x4f,
  lightTwoViewProjectionMatrix: mat4x4f,
  lightOneDirection: vec4f,
  lightOneColor: vec4f,
  lightTwoDirection: vec4f,
  lightTwoColor: vec4f,
}

struct FragmentInput {
  @location(0) color: vec3f,
  @location(1) normal: vec3f,
  @location(2) shadowPositionOne: vec4f,
  @location(3) shadowPositionTwo: vec4f,
}

@group(0) @binding(0) var<uniform> uniforms: SceneUniforms;
@group(0) @binding(1) var shadowTextureOne: texture_depth_2d;
@group(0) @binding(2) var shadowTextureTwo: texture_depth_2d;
@group(0) @binding(3) var shadowSampler: sampler_comparison;

fn sampleShadowVisibility(
  shadowTexture: texture_depth_2d,
  shadowPosition: vec4f
) -> f32 {
  let shadowClip = shadowPosition.xyz / shadowPosition.w;
  let shadowUv = shadowClip.xy * vec2f(0.5, -0.5) + vec2f(0.5, 0.5);
  let clampedShadowUv = clamp(shadowUv, vec2f(0.0), vec2f(1.0));
  let shadowDepth = clamp(shadowClip.z - 0.00005, 0.0, 1.0);
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

  return select(1.0, sampledVisibility, isInsideShadowMap);
}

@fragment
fn fsMain(input: FragmentInput) -> @location(0) vec4f {
  let normal = normalize(input.normal);
  let lightOneDirection = normalize(uniforms.lightOneDirection.xyz);
  let lightTwoDirection = normalize(uniforms.lightTwoDirection.xyz);

  let visibilityOne = sampleShadowVisibility(
    shadowTextureOne,
    input.shadowPositionOne
  );
  let visibilityTwo = sampleShadowVisibility(
    shadowTextureTwo,
    input.shadowPositionTwo
  );

  let lambertOne = max(dot(normal, lightOneDirection), 0.0);
  let lambertTwo = max(dot(normal, lightTwoDirection), 0.0);
  let ambient = 0.18;

  let lightOne = uniforms.lightOneColor.rgb * lambertOne * visibilityOne * 0.52;
  let lightTwo = uniforms.lightTwoColor.rgb * lambertTwo * visibilityTwo * 0.52;
  let litColor = input.color * ambient + input.color * (lightOne + lightTwo);

  return vec4f(min(litColor, vec3f(1.0)), 1.0);
}
