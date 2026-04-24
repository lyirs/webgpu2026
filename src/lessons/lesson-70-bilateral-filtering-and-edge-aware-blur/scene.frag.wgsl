struct FrameUniforms {
  viewProjectionMatrix: mat4x4f,
  viewMatrix: mat4x4f,
  lightDirection: vec4f,
};

struct ObjectUniforms {
  modelMatrix: mat4x4f,
  color: vec4f,
};

struct FragmentOutput {
  @location(0) color: vec4f,
  @location(1) normal: vec4f,
  @location(2) position: vec4f,
};

@group(0) @binding(0) var<uniform> frameUniforms: FrameUniforms;
@group(0) @binding(1) var<uniform> objectUniforms: ObjectUniforms;

@fragment
fn fsMain(
  @location(0) viewNormal: vec3f,
  @location(1) viewPosition: vec3f
) -> FragmentOutput {
  let normal = normalize(viewNormal);
  let lightDirection = normalize(frameUniforms.lightDirection.xyz);
  let diffuse = max(dot(normal, -lightDirection), 0.0);
  let ambient = 0.28;
  let rim = pow(1.0 - max(dot(normal, vec3f(0.0, 0.0, 1.0)), 0.0), 1.8) * 0.14;
  let baseColor = objectUniforms.color.rgb;
  let litColor = baseColor * (ambient + diffuse * 0.92) + rim;

  var output: FragmentOutput;
  output.color = vec4f(litColor, 1.0);
  output.normal = vec4f(normal * 0.5 + 0.5, 1.0);
  output.position = vec4f(viewPosition, 1.0);
  return output;
}
