struct FrameUniforms {
  viewProjectionMatrix: mat4x4f,
  lightPosition: vec4f,
  eyePosition: vec4f,
}

struct FragmentInput {
  @location(0) worldPosition: vec3f,
  @location(1) worldNormal: vec3f,
  @location(2) baseColor: vec4f,
}

@group(0) @binding(0) var<uniform> frameUniforms: FrameUniforms;

@fragment
fn fsMain(input: FragmentInput) -> @location(0) vec4f {
  let normal = normalize(input.worldNormal);
  let lightVector = frameUniforms.lightPosition.xyz - input.worldPosition;
  let lightDirection = normalize(lightVector);
  let viewDirection = normalize(frameUniforms.eyePosition.xyz - input.worldPosition);
  let halfVector = normalize(lightDirection + viewDirection);
  let distanceSquared = max(dot(lightVector, lightVector), 0.001);
  let attenuation = 1.0 / (1.0 + distanceSquared * 0.042);
  let lambert = max(dot(normal, lightDirection), 0.0);
  let specular = pow(max(dot(normal, halfVector), 0.0), 28.0);
  let rim = pow(1.0 - max(dot(normal, viewDirection), 0.0), 3.0);
  let baseColor = input.baseColor.rgb;

  let litColor =
    baseColor * vec3f(0.14, 0.16, 0.2) +
    baseColor * lambert * attenuation * 2.15 +
    vec3f(1.0, 0.96, 0.88) * specular * attenuation * 0.44 +
    baseColor * rim * 0.08;

  return vec4f(litColor, input.baseColor.a);
}
