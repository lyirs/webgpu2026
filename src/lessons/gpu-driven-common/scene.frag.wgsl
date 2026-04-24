struct FrameUniforms {
  viewProjectionMatrix: mat4x4f,
  lightDirection: vec4f,
  eyePosition: vec4f,
};

struct DrawUniforms {
  tintColor: vec4f,
  options: vec4f,
};

struct FragmentInput {
  @location(0) worldPosition: vec3f,
  @location(1) worldNormal: vec3f,
  @location(2) color: vec4f,
  @location(3) visible: f32,
};

@group(0) @binding(0) var<uniform> frameUniforms: FrameUniforms;
@group(0) @binding(3) var<uniform> drawUniforms: DrawUniforms;

@fragment
fn fsMain(input: FragmentInput) -> @location(0) vec4f {
  if (input.visible < 0.5) {
    discard;
    return vec4f(0.0);
  }

  let normal = normalize(input.worldNormal);
  let lightDirection = normalize(-frameUniforms.lightDirection.xyz);
  let viewDirection = normalize(frameUniforms.eyePosition.xyz - input.worldPosition);
  let halfVector = normalize(lightDirection + viewDirection);
  let lambert = max(dot(normal, lightDirection), 0.0);
  let specular = pow(max(dot(normal, halfVector), 0.0), 24.0);
  let ambient = input.color.rgb * 0.32;
  let diffuse = input.color.rgb * (0.44 + lambert * 0.76);
  let highlight = vec3f(0.9, 0.92, 0.98) * specular * 0.22;
  let alpha = drawUniforms.options.y;

  return vec4f(ambient + diffuse + highlight, alpha);
}
