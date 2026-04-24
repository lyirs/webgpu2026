struct FrameUniforms {
  viewProjectionMatrix: mat4x4f,
  skyboxViewProjectionMatrix: mat4x4f,
  lightDirection: vec4f,
  cameraPosition: vec4f,
  sceneParams: vec4f,
}

struct EmitterUniforms {
  modelMatrix: mat4x4f,
  colorIntensity: vec4f,
}

@group(0) @binding(0) var<uniform> frameUniforms: FrameUniforms;
@group(1) @binding(0) var<uniform> emitterUniforms: EmitterUniforms;

struct VertexOutput {
  @builtin(position) clipPosition: vec4f,
};

@vertex
fn vsMain(@location(0) position: vec3f) -> VertexOutput {
  var output: VertexOutput;
  let worldPosition = emitterUniforms.modelMatrix * vec4f(position, 1.0);
  output.clipPosition = frameUniforms.viewProjectionMatrix * worldPosition;
  return output;
}

@fragment
fn fsMain() -> @location(0) vec4f {
  return vec4f(
    emitterUniforms.colorIntensity.rgb * emitterUniforms.colorIntensity.a,
    1.0
  );
}
