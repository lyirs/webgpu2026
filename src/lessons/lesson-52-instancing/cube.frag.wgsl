struct Uniforms {
  viewProjectionMatrix: mat4x4f,
  modelMatrix: mat4x4f,
  lightDirection: vec4f,
};

@group(0) @binding(0) var<uniform> uniforms: Uniforms;

struct FragmentInput {
  @location(0) worldNormal: vec3f,
  @location(1) baseColor: vec3f,
};

@fragment
fn fsMain(input: FragmentInput) -> @location(0) vec4f {
  let normal = normalize(input.worldNormal);
  let lightDirection = normalize(uniforms.lightDirection.xyz);
  let diffuse = max(dot(normal, lightDirection), 0.0);
  let ambient = 0.22;
  let lighting = ambient + diffuse * 0.78;
  return vec4f(input.baseColor * lighting, 1.0);
}
