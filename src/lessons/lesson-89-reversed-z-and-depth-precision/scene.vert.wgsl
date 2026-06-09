struct ObjectUniforms {
  modelViewProjectionMatrix: mat4x4f,
  color: vec4f,
};

@group(0) @binding(0) var<uniform> objectUniforms: ObjectUniforms;

struct VertexOutput {
  @builtin(position) clipPosition: vec4f,
  @location(0) color: vec4f,
};

@vertex
fn vsMain(@location(0) position: vec3f) -> VertexOutput {
  var output: VertexOutput;
  output.clipPosition =
    objectUniforms.modelViewProjectionMatrix * vec4f(position, 1.0);
  output.color = objectUniforms.color;
  return output;
}
