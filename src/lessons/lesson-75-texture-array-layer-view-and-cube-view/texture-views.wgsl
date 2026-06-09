@group(0) @binding(0) var textureSampler: sampler;
@group(0) @binding(1) var layerArrayTexture: texture_2d_array<f32>;
@group(0) @binding(2) var selectedLayerTexture: texture_2d<f32>;
@group(0) @binding(3) var cubeTexture: texture_cube<f32>;

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
  let panel = floor(input.uv.x * 3.0);
  let panelUv = vec2f(fract(input.uv.x * 3.0), input.uv.y);
  let layerX = floor(panelUv.x * 3.0);
  let layerY = floor((1.0 - panelUv.y) * 2.0);
  let layer = i32(clamp(layerY * 3.0 + layerX, 0.0, 5.0));
  let localUv = vec2f(fract(panelUv.x * 3.0), fract((1.0 - panelUv.y) * 2.0));
  let arrayColor = textureSample(layerArrayTexture, textureSampler, localUv, layer).rgb;
  let layerColor = textureSample(selectedLayerTexture, textureSampler, panelUv).rgb;
  let direction = normalize(vec3f(panelUv * 2.0 - vec2f(1.0), 1.0));
  let cubeColor = textureSample(cubeTexture, textureSampler, direction).rgb;
  var color = arrayColor;
  color = select(color, layerColor, panel >= 1.0 && panel < 2.0);
  color = select(color, cubeColor, panel >= 2.0);

  let divider = step(abs(fract(input.uv.x * 3.0)), 0.005);
  color = mix(color, vec3f(0.95, 0.66, 0.36), divider);
  return vec4f(color, 1.0);
}
