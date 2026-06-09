struct Uniforms {
  time: f32,
  pulse: f32,
  padding0: f32,
  padding1: f32,
};

struct VertexInput {
  @location(0) position: vec2f,
  @location(1) color: vec3f,
};

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) color: vec3f,
};

@group(0) @binding(0) var<uniform> uniforms: Uniforms;

@vertex
fn vsMain(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;

  let angle = uniforms.time * 0.9;
  let sine = sin(angle);
  let cosine = cos(angle);
  let rotation = mat2x2f(
    cosine, -sine,
    sine, cosine
  );
  let scale = 0.92 + uniforms.pulse * 0.08;
  let transformed = rotation * (input.position * scale);

  output.position = vec4f(transformed, 0.0, 1.0);
  output.color = input.color;

  return output;
}

@fragment
fn fsMain(input: VertexOutput) -> @location(0) vec4f {
  let animatedTint = vec3f(
    0.5 + 0.5 * sin(uniforms.time + 0.0),
    0.5 + 0.5 * sin(uniforms.time + 2.1),
    0.5 + 0.5 * sin(uniforms.time + 4.2)
  );
  let finalColor = input.color * 0.7 + animatedTint * 0.3;
  return vec4f(finalColor, 1.0);
}
