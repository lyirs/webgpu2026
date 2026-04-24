struct FrameUniforms {
  viewProjectionMatrix: mat4x4f,
  skyboxViewProjectionMatrix: mat4x4f,
  cameraPosition: vec4f,
  lightDirection: vec4f,
}

struct ObjectUniforms {
  modelMatrix: mat4x4f,
  baseColor: vec4f,
  materialParams: vec4f,
}

@group(0) @binding(0) var<uniform> frameUniforms: FrameUniforms;
@group(1) @binding(0) var environmentSampler: sampler;
@group(1) @binding(1) var environmentTexture: texture_cube<f32>;
@group(2) @binding(0) var<uniform> objectUniforms: ObjectUniforms;

struct FragmentInput {
  @location(0) worldPosition: vec3f,
  @location(1) worldNormal: vec3f,
}

@fragment
fn fsMain(input: FragmentInput) -> @location(0) vec4f {
  let normal = normalize(input.worldNormal);
  let lightDirection = normalize(-frameUniforms.lightDirection.xyz);
  let lambert = max(dot(normal, lightDirection), 0.0);
  let viewDirection = normalize(frameUniforms.cameraPosition.xyz - input.worldPosition);
  let reflectedDirection = reflect(-viewDirection, normal);
  let environmentColor = textureSample(
    environmentTexture,
    environmentSampler,
    reflectedDirection
  ).rgb;

  let litBaseColor = objectUniforms.baseColor.rgb * (0.2 + lambert * 0.8);
  let fresnel = pow(1.0 - max(dot(viewDirection, normal), 0.0), 4.0);
  let reflectivity = clamp(objectUniforms.materialParams.x + fresnel * 0.18, 0.0, 1.0);
  let finalColor = mix(litBaseColor, environmentColor, reflectivity);

  return vec4f(finalColor, 1.0);
}
