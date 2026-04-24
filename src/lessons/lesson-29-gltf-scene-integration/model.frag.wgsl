struct FrameUniforms {
  viewProjectionMatrix: mat4x4f,
  lightDirection: vec4f,
};

@group(0) @binding(0) var<uniform> frameUniforms: FrameUniforms;
@group(2) @binding(0) var baseColorSampler: sampler;
@group(2) @binding(1) var baseColorTexture: texture_2d<f32>;

struct FragmentInput {
  @location(0) worldNormal: vec3f,
  @location(1) uv: vec2f,
};

@fragment
fn fsMain(input: FragmentInput) -> @location(0) vec4f {
  let normal = normalize(input.worldNormal);
  let lightDirection = normalize(frameUniforms.lightDirection.xyz);
  let diffuse = max(dot(normal, lightDirection), 0.0);
  let baseColor = textureSample(baseColorTexture, baseColorSampler, input.uv);
  let ambient = 0.18;
  return vec4f(baseColor.rgb * (ambient + diffuse * 0.82), baseColor.a);
}
