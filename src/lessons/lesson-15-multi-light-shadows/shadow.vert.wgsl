struct ShadowUniforms {
  lightViewProjectionMatrix: mat4x4f,
  modelMatrix: mat4x4f,
}

struct VertexInput {
  @location(0) position: vec3f,
}

@group(0) @binding(0) var<uniform> uniforms: ShadowUniforms;

@vertex
fn vsMain(input: VertexInput) -> @builtin(position) vec4f {
  return uniforms.lightViewProjectionMatrix * uniforms.modelMatrix * vec4f(input.position, 1.0);
}
