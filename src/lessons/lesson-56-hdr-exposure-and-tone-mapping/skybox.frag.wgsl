struct FrameUniforms {
  viewProjectionMatrix: mat4x4f,
  skyboxViewProjectionMatrix: mat4x4f,
  lightDirection: vec4f,
  cameraPosition: vec4f,
  sceneParams: vec4f,
}

@group(0) @binding(0) var<uniform> frameUniforms: FrameUniforms;
@group(1) @binding(0) var environmentSampler: sampler;
@group(1) @binding(1) var environmentTexture: texture_cube<f32>;

struct FragmentInput {
  @location(0) sampleDirection: vec3f,
}

fn srgbToLinear(color: vec3f) -> vec3f {
  return pow(color, vec3f(2.2));
}

@fragment
fn fsMain(input: FragmentInput) -> @location(0) vec4f {
  let direction = normalize(input.sampleDirection);
  let baseEnvironment = srgbToLinear(
    textureSample(environmentTexture, environmentSampler, direction).rgb
  );
  let horizonLift = mix(0.46, 0.82, smoothstep(-0.28, 0.42, direction.y));
  let sunAmount = max(dot(direction, normalize(frameUniforms.lightDirection.xyz)), 0.0);
  let sunCore = pow(sunAmount, 260.0);
  let sunGlow = pow(sunAmount, 13.5);
  let sunColor =
    vec3f(48.0, 31.0, 18.0) *
    frameUniforms.sceneParams.x *
    (sunCore + sunGlow * 0.34);
  let color =
    baseEnvironment * frameUniforms.sceneParams.y * horizonLift +
    sunColor;
  return vec4f(color, 1.0);
}
