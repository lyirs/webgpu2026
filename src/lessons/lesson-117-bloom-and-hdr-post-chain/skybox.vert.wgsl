struct FrameUniforms {
  viewProjectionMatrix: mat4x4f,
  skyboxViewProjectionMatrix: mat4x4f,
  lightDirection: vec4f,
  cameraPosition: vec4f,
  sceneParams: vec4f,
};

@group(0) @binding(0) var<uniform> frameUniforms: FrameUniforms;

struct VertexInput {
  @location(0) position: vec3f,
};

struct VertexOutput {
  @builtin(position) clipPosition: vec4f,
  @location(0) sampleDirection: vec3f,
};

@vertex
fn vsMain(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;
  output.sampleDirection = normalize(input.position);
  output.clipPosition =
    frameUniforms.skyboxViewProjectionMatrix * vec4f(input.position * 18.0, 1.0);
  output.clipPosition.z = output.clipPosition.w;
  return output;
}
