struct ToneUniforms {
  exposure: f32,
  mode: f32,
  time: f32,
  _pad: f32,
};

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
};

@group(0) @binding(0) var<uniform> tone: ToneUniforms;

@vertex
fn vsMain(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
  var positions = array<vec2f, 3>(
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

fn acesFit(color: vec3f) -> vec3f {
  let a = 2.51;
  let b = 0.03;
  let c = 2.43;
  let d = 0.59;
  let e = 0.14;
  return clamp((color * (a * color + vec3f(b))) / (color * (c * color + vec3f(d)) + vec3f(e)), vec3f(0.0), vec3f(1.0));
}

@fragment
fn fsMain(input: VertexOutput) -> @location(0) vec4f {
  let sun = exp(-24.0 * distance(input.uv, vec2f(0.72 + sin(tone.time * 0.35) * 0.08, 0.34)));
  let panel = smoothstep(0.18, 0.2, input.uv.x) * (1.0 - smoothstep(0.82, 0.84, input.uv.x));
  let hdrColor = vec3f(
    0.15 + input.uv.x * 1.4 + sun * 7.0,
    0.24 + input.uv.y * 1.1 + panel * 1.8,
    0.42 + (1.0 - input.uv.y) * 1.6 + sun * 2.2
  ) * tone.exposure;
  let reinhard = hdrColor / (hdrColor + vec3f(1.0));
  let aces = acesFit(hdrColor);
  let mapped = select(reinhard, aces, tone.mode > 0.5);
  let gammaCorrected = pow(mapped, vec3f(1.0 / 2.2));
  return vec4f(gammaCorrected, 1.0);
}
