struct FrameUniforms {
  viewProjectionMatrix: mat4x4f,
  skyboxViewProjectionMatrix: mat4x4f,
  lightDirection: vec4f,
  cameraPosition: vec4f,
  lightingParams: vec4f,
}

@group(0) @binding(0) var<uniform> frameUniforms: FrameUniforms;
@group(1) @binding(0) var environmentSampler: sampler;
@group(1) @binding(1) var environmentTexture: texture_cube<f32>;

struct FragmentInput {
  @location(0) sampleDirection: vec3f,
}

fn rotateDirectionY(direction: vec3f, angle: f32) -> vec3f {
  let cosine = cos(angle);
  let sine = sin(angle);
  return vec3f(
    direction.x * cosine + direction.z * sine,
    direction.y,
    -direction.x * sine + direction.z * cosine
  );
}

@fragment
fn fsMain(input: FragmentInput) -> @location(0) vec4f {
  let rotatedDirection = normalize(
    rotateDirectionY(input.sampleDirection, frameUniforms.lightingParams.z)
  );
  let color = textureSample(
    environmentTexture,
    environmentSampler,
    rotatedDirection
  ).rgb;
  return vec4f(color, 1.0);
}
