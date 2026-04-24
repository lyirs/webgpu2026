struct BoundsUniforms {
  color: vec4f,
  options: vec4f,
};

struct FragmentInput {
  @location(0) worldNormal: vec3f,
  @location(1) visible: f32,
};

@group(0) @binding(3) var<uniform> boundsUniforms: BoundsUniforms;

@fragment
fn fsMain(input: FragmentInput) -> @location(0) vec4f {
  if (input.visible < 0.5) {
    discard;
    return vec4f(0.0);
  }

  let rim = 0.38 + (1.0 - abs(normalize(input.worldNormal).y)) * 0.44;
  let alpha = boundsUniforms.options.y * rim;
  return vec4f(boundsUniforms.color.rgb, alpha);
}
