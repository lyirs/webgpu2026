struct Uniforms {
  modelViewProjectionMatrix: mat4x4f,
  modelMatrix: mat4x4f,
  baseColor: vec4f,
  lightDirection: vec4f,
};

@group(0) @binding(0) var<uniform> uniforms: Uniforms;

struct FragmentInput {
  @location(0) worldNormal: vec3f,
  @location(1) color: vec4f,
};

@fragment
fn fsMain(input: FragmentInput) -> @location(0) vec4f {
  let normal = normalize(input.worldNormal);
  let lightDirection = normalize(uniforms.lightDirection.xyz);
  let lambert = max(abs(dot(normal, lightDirection)), 0.0);
  let litColor = input.color.rgb * (0.24 + 0.76 * lambert);

  // 这里先把 rgb 乘上 alpha，再配合 one / one-minus-src-alpha 做 premultiplied alpha 混合。
  return vec4f(litColor * input.color.a, input.color.a);
}
