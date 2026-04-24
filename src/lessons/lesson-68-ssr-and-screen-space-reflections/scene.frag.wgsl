struct FrameUniforms {
  viewProjectionMatrix: mat4x4f,
  viewMatrix: mat4x4f,
  lightDirection: vec4f,
};

struct FragmentInput {
  @location(0) viewPosition: vec3f,
  @location(1) viewNormal: vec3f,
  @location(2) colorReflectivity: vec4f,
};

struct FragmentOutput {
  @location(0) color: vec4f,
  @location(1) normalReflectivity: vec4f,
  @location(2) viewPosition: vec4f,
};

@group(0) @binding(0) var<uniform> frameUniforms: FrameUniforms;

@fragment
fn fsMain(input: FragmentInput) -> FragmentOutput {
  let normal = normalize(input.viewNormal);
  let lightDirection = normalize((frameUniforms.viewMatrix * vec4f(-frameUniforms.lightDirection.xyz, 0.0)).xyz);
  let ndl = max(dot(normal, lightDirection), 0.0);
  let viewDirection = normalize(-input.viewPosition);
  let halfVector = normalize(lightDirection + viewDirection);
  let specular = pow(max(dot(normal, halfVector), 0.0), 42.0) * (0.12 + input.colorReflectivity.a * 0.28);
  let fresnel = pow(1.0 - max(dot(normal, viewDirection), 0.0), 3.5);
  let environmentTint = vec3f(0.12, 0.18, 0.24) * (0.35 + fresnel * input.colorReflectivity.a);
  let litColor =
    input.colorReflectivity.rgb * (0.2 + ndl * 0.8) +
    specular +
    environmentTint;

  var output: FragmentOutput;
  output.color = vec4f(litColor, 1.0);
  output.normalReflectivity = vec4f(normal * 0.5 + 0.5, input.colorReflectivity.a);
  output.viewPosition = vec4f(input.viewPosition, 1.0);
  return output;
}
