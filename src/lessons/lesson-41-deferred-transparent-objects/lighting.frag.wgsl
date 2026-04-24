struct LightUniforms {
  lightPositions: array<vec4f, 3>,
  lightColors: array<vec4f, 3>,
  ambient: vec4f,
}

struct FragmentInput {
  @builtin(position) clipPosition: vec4f,
  @location(0) uv: vec2f,
}

@group(0) @binding(0) var albedoTexture: texture_2d<f32>;
@group(0) @binding(1) var normalTexture: texture_2d<f32>;
@group(0) @binding(2) var worldPositionTexture: texture_2d<f32>;
@group(0) @binding(3) var<uniform> lightUniforms: LightUniforms;

@fragment
fn fsMain(input: FragmentInput) -> @location(0) vec4f {
  let coords = vec2i(input.clipPosition.xy);
  let albedo = textureLoad(albedoTexture, coords, 0);
  let normalSample = textureLoad(normalTexture, coords, 0);
  let worldSample = textureLoad(worldPositionTexture, coords, 0);

  let background = vec3f(0.039, 0.070, 0.133);
  var litColor = background;

  if (worldSample.w > 0.5) {
    let baseColor = albedo.rgb;
    let worldNormal = normalize(normalSample.xyz);
    let worldPosition = worldSample.xyz;
    litColor = baseColor * lightUniforms.ambient.rgb;

    for (var lightIndex = 0u; lightIndex < 3u; lightIndex += 1u) {
      let lightVector = lightUniforms.lightPositions[lightIndex].xyz - worldPosition;
      let distanceSquared = max(dot(lightVector, lightVector), 0.001);
      let lightDirection = normalize(lightVector);
      let lambert = max(dot(worldNormal, lightDirection), 0.0);
      let attenuation = 1.0 / (1.0 + distanceSquared * 0.11);
      litColor += baseColor * lightUniforms.lightColors[lightIndex].rgb * lambert * attenuation;
    }
  }

  return vec4f(litColor, 1.0);
}
