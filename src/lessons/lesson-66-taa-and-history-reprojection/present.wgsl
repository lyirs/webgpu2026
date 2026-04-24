struct VertexOutput {
  @builtin(position) clipPosition: vec4f,
  @location(0) uv: vec2f,
};

@group(0) @binding(0) var presentSampler: sampler;
@group(0) @binding(1) var currentColorTexture: texture_2d<f32>;
@group(0) @binding(2) var taaTexture: texture_2d<f32>;

@vertex
fn vsMain(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
  var clip = array(
    vec2f(-1.0, -1.0),
    vec2f(3.0, -1.0),
    vec2f(-1.0, 3.0)
  );

  let clipPosition = clip[vertexIndex];
  var output: VertexOutput;
  output.clipPosition = vec4f(clipPosition, 0.0, 1.0);
  output.uv = clipPosition * vec2f(0.5, -0.5) + vec2f(0.5);
  return output;
}

@fragment
fn fsMain(input: VertexOutput) -> @location(0) vec4f {
  let isLeft = input.uv.x < 0.5;
  let panelUv = vec2f(select((input.uv.x - 0.5) * 2.0, input.uv.x * 2.0, isLeft), input.uv.y);
  let leftColor = textureSampleLevel(currentColorTexture, presentSampler, panelUv, 0.0).rgb;
  let rightColor = textureSampleLevel(taaTexture, presentSampler, panelUv, 0.0).rgb;
  let dividerMix = smoothstep(0.4975, 0.5, input.uv.x) - smoothstep(0.5, 0.5025, input.uv.x);
  let sceneColor = select(rightColor, leftColor, isLeft);
  let shaded = mix(sceneColor, vec3f(1.0, 0.72, 0.5), dividerMix);
  return vec4f(shaded, 1.0);
}
