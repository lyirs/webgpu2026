struct LightUniforms {
  lightPositions: array<vec4f, 3>,
  lightColors: array<vec4f, 3>,
  ambient: vec4f,
}

struct FragmentInput {
  @location(0) worldPosition: vec3f,
  @location(1) worldNormal: vec3f,
  @location(2) baseColor: vec4f,
}

@group(1) @binding(0) var<uniform> lightUniforms: LightUniforms;

@fragment
fn fsMain(input: FragmentInput) -> @location(0) vec4f {
  let baseColor = input.baseColor.rgb;
  let alpha = input.baseColor.a;
  let worldNormal = normalize(input.worldNormal);
  let worldPosition = input.worldPosition;

  var litColor = baseColor * lightUniforms.ambient.rgb;

  for (var lightIndex = 0u; lightIndex < 3u; lightIndex += 1u) {
    let lightVector = lightUniforms.lightPositions[lightIndex].xyz - worldPosition;
    let distanceSquared = max(dot(lightVector, lightVector), 0.001);
    let lightDirection = normalize(lightVector);
    let lambert = max(dot(worldNormal, lightDirection), 0.0);
    let attenuation = 1.0 / (1.0 + distanceSquared * 0.11);
    litColor += baseColor * lightUniforms.lightColors[lightIndex].rgb * lambert * attenuation;
  }

  return vec4f(litColor, alpha);
}
