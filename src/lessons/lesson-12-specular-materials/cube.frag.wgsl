struct Uniforms {
  modelViewProjectionMatrix: mat4x4f,
  modelMatrix: mat4x4f,
  eyePosition: vec4f,
  materialParams: vec4f,
}

struct FragmentInput {
  @location(0) color: vec3f,
  @location(1) normal: vec3f,
  @location(2) worldPosition: vec3f,
}

@group(0) @binding(0) var<uniform> uniforms: Uniforms;

@fragment
fn fsMain(input: FragmentInput) -> @location(0) vec4f {
  let normal = normalize(input.normal);
  let lightDirection = normalize(vec3f(0.35, 0.8, 0.45));
  let lambert = max(dot(normal, lightDirection), 0.0);
  let ambient = uniforms.materialParams.z;
  let diffuse = ambient + lambert * (1.0 - ambient);

  let viewDirection = normalize(uniforms.eyePosition.xyz - input.worldPosition);
  let reflectDirection = reflect(-lightDirection, normal);
  let shininess = uniforms.materialParams.x;
  let specularStrength = uniforms.materialParams.y;
  let specular = pow(max(dot(viewDirection, reflectDirection), 0.0), shininess) * specularStrength;

  let baseColor = input.color * diffuse;
  return vec4f(baseColor + vec3f(specular), 1.0);
}
