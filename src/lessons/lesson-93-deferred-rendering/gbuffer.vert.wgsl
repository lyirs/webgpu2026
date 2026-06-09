struct ObjectUniforms {
  modelViewProjectionMatrix: mat4x4f,
  modelMatrix: mat4x4f,
  color: vec4f,
}

struct VertexInput {
  @location(0) position: vec3f,
  @location(1) normal: vec3f,
}

struct VertexOutput {
  @builtin(position) clipPosition: vec4f,
  @location(0) worldPosition: vec3f,
  @location(1) worldNormal: vec3f,
}

@group(0) @binding(0) var<uniform> objectUniforms: ObjectUniforms;

@vertex
fn vsMain(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;
  let worldPosition = objectUniforms.modelMatrix * vec4f(input.position, 1.0);
  output.clipPosition = objectUniforms.modelViewProjectionMatrix * vec4f(input.position, 1.0);
  output.worldPosition = worldPosition.xyz;
  output.worldNormal = normalize((objectUniforms.modelMatrix * vec4f(input.normal, 0.0)).xyz);
  return output;
}
