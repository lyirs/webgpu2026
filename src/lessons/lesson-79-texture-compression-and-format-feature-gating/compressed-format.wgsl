struct Params {
  featureMode: f32,
  time: f32,
  _pad0: f32,
  _pad1: f32,
};

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
};

@group(0) @binding(0) var sampledTexture: texture_2d<f32>;
@group(0) @binding(1) var sampledSampler: sampler;
@group(0) @binding(2) var<uniform> params: Params;

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

@fragment
fn fsMain(input: VertexOutput) -> @location(0) vec4f {
  let panel = floor(input.uv.x * 3.0);
  let localUv = vec2f(fract(input.uv.x * 3.0), input.uv.y);
  let color = textureSample(sampledTexture, sampledSampler, localUv);
  let featureTint = mix(vec3f(0.24, 0.34, 0.52), vec3f(0.14, 0.72, 0.58), params.featureMode);
  let uploadPanel = vec3f(color.rgb);
  let gatePanel = color.rgb * 0.7 + featureTint * 0.3;
  let fallbackPanel = mix(color.bgr, vec3f(1.0, 0.72, 0.34), 0.18 + 0.12 * sin(params.time));
  let result = select(select(uploadPanel, gatePanel, panel >= 1.0), fallbackPanel, panel >= 2.0);
  return vec4f(result, 1.0);
}
