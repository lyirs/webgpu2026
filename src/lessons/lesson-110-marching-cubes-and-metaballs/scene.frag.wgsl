struct SceneUniforms {
  viewProjectionMatrix: mat4x4f,
  lightPosition: vec4f,
  eyePosition: vec4f,
};

struct FragmentInput {
  @location(0) worldPosition: vec3f,
  @location(1) worldNormal: vec3f,
  @location(2) baseColor: vec3f,
};

@group(0) @binding(0) var<uniform> scene: SceneUniforms;

@fragment
fn fsMain(input: FragmentInput) -> @location(0) vec4f {
  let normal = normalize(input.worldNormal);
  let lightDirection = normalize(scene.lightPosition.xyz - input.worldPosition);
  let viewDirection = normalize(scene.eyePosition.xyz - input.worldPosition);
  let halfVector = normalize(lightDirection + viewDirection);

  let diffuse = max(dot(normal, lightDirection), 0.0);
  let specular = pow(max(dot(normal, halfVector), 0.0), 42.0);
  let rim = pow(1.0 - max(dot(normal, viewDirection), 0.0), 3.0);
  let skyBounce = 0.14 + 0.16 * (normal.y * 0.5 + 0.5);

  let color =
    input.baseColor * (skyBounce + diffuse * 0.86) +
    vec3f(1.0, 0.98, 0.92) * specular * 0.22 +
    input.baseColor * rim * 0.24;

  return vec4f(color, 1.0);
}
