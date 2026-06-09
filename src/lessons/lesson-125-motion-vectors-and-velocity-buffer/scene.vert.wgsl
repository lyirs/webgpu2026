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
  @builtin(position) clipPosition: vec4f,
  @location(0) worldNormal: vec3f,
  @location(1) baseColor: vec4f,
  @location(2) velocity: vec2f,
};

@group(0) @binding(0) var<uniform> frameUniforms: FrameUniforms;
@group(1) @binding(0) var<uniform> objectUniforms: ObjectUniforms;

@vertex
fn vsMain(input: VertexInput) -> VertexOutput {
  let currentWorld =
    objectUniforms.currentModelMatrix * vec4f(input.position, 1.0);
  let previousWorld =
    objectUniforms.previousModelMatrix * vec4f(input.position, 1.0);
  let currentClip =
    frameUniforms.currentViewProjectionMatrix * currentWorld;
  let previousClip =
    frameUniforms.previousViewProjectionMatrix * previousWorld;

  var output: VertexOutput;
  output.clipPosition = currentClip;
  output.worldNormal =
    normalize((objectUniforms.currentModelMatrix * vec4f(input.normal, 0.0)).xyz);
  output.baseColor = objectUniforms.color;
  output.velocity =
    currentClip.xy / max(currentClip.w, 0.0001) -
    previousClip.xy / max(previousClip.w, 0.0001);
  return output;
}
