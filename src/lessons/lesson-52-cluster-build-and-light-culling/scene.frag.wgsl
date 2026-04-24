struct SceneUniforms {
  viewProjectionMatrix: mat4x4f,
  eyePosition: vec4f,
  lightPosition: vec4f,
};

struct ObjectVertexOutput {
  @builtin(position) clipPosition: vec4f,
  @location(0) worldPosition: vec3f,
  @location(1) worldNormal: vec3f,
  @location(2) baseColor: vec3f,
};

struct MarkerOutput {
  @builtin(position) clipPosition: vec4f,
  @location(0) color: vec3f,
};

@group(0) @binding(0) var<uniform> sceneUniforms: SceneUniforms;

fn shadeStaticSurface(input: ObjectVertexOutput) -> vec3f {
  let normal = normalize(input.worldNormal);
  let lightDirection = normalize(sceneUniforms.lightPosition.xyz - input.worldPosition);
  let viewDirection = normalize(sceneUniforms.eyePosition.xyz - input.worldPosition);
  let halfVector = normalize(lightDirection + viewDirection);
  let diffuse = max(dot(normal, lightDirection), 0.0);
  let specular = pow(max(dot(normal, halfVector), 0.0), 24.0);
  let rim = pow(1.0 - max(dot(normal, viewDirection), 0.0), 3.0);

  return (
    input.baseColor * (0.16 + diffuse * 0.94) +
    vec3f(1.0, 0.98, 0.92) * specular * 0.14 +
    input.baseColor * rim * 0.07
  );
}

@fragment
fn fsObject(input: ObjectVertexOutput) -> @location(0) vec4f {
  return vec4f(shadeStaticSurface(input), 1.0);
}

@fragment
fn fsLightMarker(input: MarkerOutput) -> @location(0) vec4f {
  return vec4f(input.color, 1.0);
}
