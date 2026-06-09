struct SceneUniforms {
  viewProjectionMatrix: mat4x4f,
  eyePosition: vec4f,
  lightDirection: vec4f,
  ambientColor: vec4f,
  pixelInfo: vec4u,
};

struct SceneFragmentInput {
  @location(0) worldPosition: vec3f,
  @location(1) worldNormal: vec3f,
  @location(2) baseColor: vec4f,
};

@group(0) @binding(0) var<uniform> scene: SceneUniforms;

fn shadeSurface(input: SceneFragmentInput) -> vec3f {
  let normal = normalize(input.worldNormal);
  let lightDirection = normalize(-scene.lightDirection.xyz);
  let viewDirection = normalize(scene.eyePosition.xyz - input.worldPosition);
  let halfVector = normalize(lightDirection + viewDirection);

  let diffuse = max(dot(normal, lightDirection), 0.0);
  let specular = pow(max(dot(normal, halfVector), 0.0), 28.0);
  let fresnel = pow(1.0 - max(dot(normal, viewDirection), 0.0), 2.0);

  let litColor =
    input.baseColor.rgb * (scene.ambientColor.rgb + diffuse * 0.88) +
    vec3f(0.36, 0.42, 0.5) * specular * 0.22 +
    input.baseColor.rgb * fresnel * 0.08;

  return litColor;
}

@fragment
fn fsOpaque(input: SceneFragmentInput) -> @location(0) vec4f {
  return vec4f(shadeSurface(input), 1.0);
}

@fragment
fn fsTransparentBlend(input: SceneFragmentInput) -> @location(0) vec4f {
  return vec4f(shadeSurface(input), input.baseColor.a);
}
