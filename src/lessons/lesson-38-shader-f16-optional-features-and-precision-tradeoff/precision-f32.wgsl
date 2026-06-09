struct PrecisionUniforms {
  time: f32,
  supported: f32,
  mode: f32,
  pad0: f32,
};

@group(0) @binding(0) var<uniform> precisionUniforms: PrecisionUniforms;

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
};

@vertex
fn vsMain(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
  let positions = array<vec2f, 3>(
    vec2f(-1.0, -1.0),
    vec2f(3.0, -1.0),
    vec2f(-1.0, 3.0)
  );
  let position = positions[vertexIndex];
  var output: VertexOutput;
  output.position = vec4f(position, 0.0, 1.0);
  output.uv = position * 0.5 + vec2f(0.5);
  return output;
}

@fragment
fn fsMain(input: VertexOutput) -> @location(0) vec4f {
  let value = fract((input.uv.x * 0.33325195 + input.uv.y * 0.6665039) * 28.0 + precisionUniforms.time * 0.22);
  let bands = smoothstep(0.18, 0.82, value);
  let grid = 1.0 - smoothstep(0.0, 0.014, min(fract(input.uv.x * 18.0), fract(input.uv.y * 10.0)));
  let fallbackTint = select(vec3f(0.0), vec3f(0.18, 0.04, 0.02), precisionUniforms.supported < 0.5 && precisionUniforms.mode > 0.5);
  let color = mix(vec3f(0.16, 0.48, 0.96), vec3f(0.98, 0.82, 0.38), bands) + grid * 0.08 + fallbackTint;
  return vec4f(color, 1.0);
}
