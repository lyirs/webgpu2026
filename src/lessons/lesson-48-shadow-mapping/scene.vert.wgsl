struct SceneUniforms {
  cameraViewProjectionMatrix: mat4x4f,
  modelMatrix: mat4x4f,
  lightViewProjectionMatrix: mat4x4f,
  lightDirection: vec4f,
}

struct VertexInput {
  @location(0) position: vec3f,
  @location(1) color: vec3f,
  @location(2) normal: vec3f,
}

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) color: vec3f,
  @location(1) normal: vec3f,
  @location(2) shadowPosition: vec4f,
}

@group(0) @binding(0) var<uniform> uniforms: SceneUniforms;

@vertex
fn vsMain(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;
  let worldPosition = uniforms.modelMatrix * vec4f(input.position, 1.0);
  output.position = uniforms.cameraViewProjectionMatrix * worldPosition;
  output.color = input.color;
  output.normal = normalize((uniforms.modelMatrix * vec4f(input.normal, 0.0)).xyz);
  output.shadowPosition = uniforms.lightViewProjectionMatrix * worldPosition;
  return output;
}
