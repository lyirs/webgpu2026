struct ViewParams {
  selectedMip: f32,
  selectedLayer: f32,
  mipCount: f32,
  layerCount: f32,
};

@group(0) @binding(0) var viewSampler: sampler;
@group(0) @binding(1) var rangeTexture: texture_2d_array<f32>;
@group(0) @binding(2) var mipTexture: texture_2d<f32>;
@group(0) @binding(3) var layerTexture: texture_2d<f32>;
@group(0) @binding(4) var<uniform> params: ViewParams;

struct VertexOut {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
};

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

fn frame(localUv: vec2f, color: vec3f) -> vec3f {
  let border = step(localUv.x, 0.025) + step(localUv.y, 0.025)
    + step(0.975, localUv.x) + step(0.975, localUv.y);
  return mix(color, vec3f(1.0), min(border, 1.0) * 0.45);
}

@fragment
fn fsMain(input: VertexOut) -> @location(0) vec4f {
  let panel = min(2u, u32(floor(input.uv.x * 3.0)));
  let localUv = vec2f(fract(input.uv.x * 3.0), input.uv.y);
  if (panel == 0u) {
    let layer = i32(clamp(floor(localUv.y * params.layerCount), 0.0, params.layerCount - 1.0));
    let mip = clamp(floor(localUv.x * params.mipCount), 0.0, params.mipCount - 1.0);
    return vec4f(frame(localUv, textureSampleLevel(rangeTexture, viewSampler, localUv, layer, mip).rgb), 1.0);
  }
  if (panel == 1u) {
    return vec4f(frame(localUv, textureSampleLevel(mipTexture, viewSampler, localUv, 0.0).rgb), 1.0);
  }
  return vec4f(frame(localUv, textureSampleLevel(layerTexture, viewSampler, localUv, 0.0).rgb), 1.0);
}
