struct FrameUniforms {
  viewProjectionMatrix: mat4x4f,
  lightPosition: vec4f,
  lightDirection: vec4f,
  lightColor: vec4f,
  coneParams: vec4f,
}

struct FragmentInput {
  @location(0) worldPosition: vec3f,
  @location(1) worldNormal: vec3f,
  @location(2) baseColor: vec3f,
}

@group(0) @binding(0) var<uniform> frameUniforms: FrameUniforms;

@fragment
fn fsMain(input: FragmentInput) -> @location(0) vec4f {
  let normal = normalize(input.worldNormal);
  let lightVector = frameUniforms.lightPosition.xyz - input.worldPosition;
  let lightDistance = max(length(lightVector), 0.001);
  let lightDirection = lightVector / lightDistance;
  let attenuation = 1.0 / (1.0 + 0.04 * lightDistance + 0.008 * lightDistance * lightDistance);
  let lambert = max(dot(normal, lightDirection), 0.0);
  let coneDirection = normalize(frameUniforms.lightDirection.xyz);
  let surfaceDirectionFromLight = normalize(input.worldPosition - frameUniforms.lightPosition.xyz);
  let spotCos = dot(surfaceDirectionFromLight, coneDirection);
  let spotFactor = smoothstep(frameUniforms.coneParams.y, frameUniforms.coneParams.x, spotCos);
  let ambient = vec3f(0.16, 0.17, 0.22);
  let diffuse = frameUniforms.lightColor.rgb * lambert * attenuation * spotFactor;
  let litColor = input.baseColor * (ambient + diffuse);
  return vec4f(litColor, 1.0);
}
