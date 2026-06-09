enable f16;

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
  let uv16 = vec2<f16>(input.uv);
  let mixed16 = (uv16.x * f16(0.33325) + uv16.y * f16(0.6665)) * f16(28.0) + f16(precisionUniforms.time) * f16(0.22);
  let value = f32(fract(mixed16));
  let bands = smoothstep(0.18, 0.82, value);
  let grid = 1.0 - smoothstep(0.0, 0.014, min(fract(input.uv.x * 18.0), fract(input.uv.y * 10.0)));
  let color = mix(vec3f(0.22, 0.82, 0.88), vec3f(1.0, 0.58, 0.88), bands) + grid * 0.08;
  return vec4f(color, 1.0);
}
