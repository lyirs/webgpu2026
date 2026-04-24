struct SceneUniforms {
  lightPosition: vec4f,
  eyePosition: vec4f,
  ambient: vec4f,
}

struct FragmentInput {
  @location(0) worldPosition: vec3f,
  @location(1) worldNormal: vec3f,
  @location(2) baseColor: vec4f,
}

@group(1) @binding(0) var<uniform> sceneUniforms: SceneUniforms;

fn extraWork(worldPosition: vec3f, normal: vec3f) -> f32 {
  var accumulation = 0.0;

  for (var index = 0u; index < 12u; index += 1u) {
    let phase = f32(index) * 0.33;
    let wave = sin(worldPosition.x * (1.2 + phase * 0.2) + worldPosition.z * (0.8 + phase * 0.14));
    let ripple = cos(worldPosition.y * (2.0 + phase * 0.1) + normal.x * 2.5 + phase);
    accumulation += abs(wave * ripple);
  }

  return accumulation / 12.0;
}

@fragment
fn fsMain(input: FragmentInput) -> @location(0) vec4f {
  let normal = normalize(input.worldNormal);
  let lightVector = sceneUniforms.lightPosition.xyz - input.worldPosition;
  let lightDirection = normalize(lightVector);
  let viewDirection = normalize(sceneUniforms.eyePosition.xyz - input.worldPosition);
  let halfVector = normalize(lightDirection + viewDirection);
  let distanceSquared = max(dot(lightVector, lightVector), 0.001);
  let attenuation = 1.0 / (1.0 + distanceSquared * 0.055);
  let lambert = max(dot(normal, lightDirection), 0.0);
  let specular = pow(max(dot(normal, halfVector), 0.0), 42.0);
  let microDetail = extraWork(input.worldPosition * 1.12, normal);
  let baseColor = input.baseColor.rgb * (0.84 + microDetail * 0.2);

  let litColor =
    baseColor * sceneUniforms.ambient.rgb +
    baseColor * lambert * attenuation * 2.25 +
    vec3f(1.0, 0.96, 0.88) * specular * attenuation * 0.62;

  return vec4f(litColor, input.baseColor.a);
}
