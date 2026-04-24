struct FrameUniforms {
  currentViewProjectionMatrix: mat4x4f,
  previousViewProjectionMatrix: mat4x4f,
  lightDirection: vec4f,
};

struct ObjectUniforms {
  currentModelMatrix: mat4x4f,
  previousModelMatrix: mat4x4f,
  color: vec4f,
};

struct VertexInput {
  @location(0) position: vec3f,
  @location(1) normal: vec3f,
};

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) color: vec4f,
  @location(1) normal: vec3f,
  @location(2) currentClip: vec4f,
  @location(3) previousClip: vec4f,
};

@group(0) @binding(0) var<uniform> frameUniforms: FrameUniforms;
@group(0) @binding(1) var<uniform> objectUniforms: ObjectUniforms;

@vertex
fn vsMain(input: VertexInput) -> VertexOutput {
  let currentWorld = objectUniforms.currentModelMatrix * vec4f(input.position, 1.0);
  let previousWorld = objectUniforms.previousModelMatrix * vec4f(input.position, 1.0);
  let currentClip = frameUniforms.currentViewProjectionMatrix * currentWorld;
  let previousClip = frameUniforms.previousViewProjectionMatrix * previousWorld;
  let worldNormal = normalize((objectUniforms.currentModelMatrix * vec4f(input.normal, 0.0)).xyz);

  var output: VertexOutput;
  output.position = currentClip;
  output.color = objectUniforms.color;
  output.normal = worldNormal;
  output.currentClip = currentClip;
  output.previousClip = previousClip;
  return output;
}
