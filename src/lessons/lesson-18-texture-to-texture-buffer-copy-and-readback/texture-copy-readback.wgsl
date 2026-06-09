struct VertexOut {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
};

@group(0) @binding(0) var textureSampler: sampler;
@group(0) @binding(1) var sourceTexture: texture_2d<f32>;
@group(0) @binding(2) var copiedTexture: texture_2d<f32>;
@group(0) @binding(3) var readbackTexture: texture_2d<f32>;

@vertex
fn vsMain(@builtin(vertex_index) vertexIndex: u32) -> VertexOut {
  var positions = array<vec2f, 3>(
    vec2f(-1.0, -1.0),
    vec2f(3.0, -1.0),
    vec2f(-1.0, 3.0),
  );

  let position = positions[vertexIndex];
  var out: VertexOut;
  out.position = vec4f(position, 0.0, 1.0);
  out.uv = position * 0.5 + vec2f(0.5);
  return out;
}

@fragment
fn fsMain(input: VertexOut) -> @location(0) vec4f {
  let panel = min(2u, u32(floor(input.uv.x * 3.0)));
  let panelUv = vec2f(fract(input.uv.x * 3.0), input.uv.y);
  let sourceColor = textureSample(sourceTexture, textureSampler, panelUv).rgb;
  let copiedColor = textureSample(copiedTexture, textureSampler, panelUv).rgb;
  let readbackColor = textureSample(readbackTexture, textureSampler, panelUv).rgb;
  let copiedOrSource = select(sourceColor, copiedColor, panel == 1u);
  let color = select(copiedOrSource, readbackColor, panel == 2u);

  let divider = select(0.0, 0.28, fract(input.uv.x * 3.0) < 0.012);
  return vec4f(color + vec3f(divider, divider * 0.75, 0.0), 1.0);
}
