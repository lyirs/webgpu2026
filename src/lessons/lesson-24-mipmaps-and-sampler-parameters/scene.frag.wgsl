struct Uniforms {
  modelViewProjectionMatrix: mat4x4f,
  modelMatrix: mat4x4f,
  lightDirection: vec4f,
};

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(1) @binding(0) var panelSampler: sampler;
@group(1) @binding(1) var panelTexture: texture_2d<f32>;

struct FragmentInput {
  @location(0) worldNormal: vec3f,
  @location(1) uv: vec2f,
};

@fragment
fn fsMain(input: FragmentInput) -> @location(0) vec4f {
  let normal = normalize(input.worldNormal);
  let lightDirection = normalize(uniforms.lightDirection.xyz);
  let lambert = max(dot(normal, lightDirection), 0.0);
  let sampled = textureSample(panelTexture, panelSampler, input.uv);
  let litColor = sampled.rgb * (0.22 + 0.78 * lambert);
  return vec4f(litColor, 1.0);
}
