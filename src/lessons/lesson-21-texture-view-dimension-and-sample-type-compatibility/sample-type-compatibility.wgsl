struct VertexOut {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
};

@group(0) @binding(0) var filterSampler: sampler;
@group(0) @binding(1) var filterableTexture: texture_2d<f32>;
@group(0) @binding(2) var arrayTexture: texture_2d_array<f32>;
@group(0) @binding(3) var nearestSampler: sampler;
@group(0) @binding(4) var unfilterableTexture: texture_2d<f32>;

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
  let localUv = vec2f(fract(input.uv.x * 3.0), input.uv.y);
  let filterable = textureSample(filterableTexture, filterSampler, localUv).rgb;
  let arrayLayer = textureSample(arrayTexture, filterSampler, localUv, 1).rgb;
  let unfilterable = textureSample(unfilterableTexture, nearestSampler, localUv).rgb;
  let picked = select(select(unfilterable, arrayLayer, panel == 1u), filterable, panel == 0u);
  let border = step(localUv.x, 0.018) + step(localUv.y, 0.018) + step(0.982, localUv.x) + step(0.982, localUv.y);
  return vec4f(mix(picked, vec3f(1.0), min(border, 1.0) * 0.3), 1.0);
}
