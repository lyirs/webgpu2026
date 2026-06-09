@group(0) @binding(0) var writeTextureView: texture_2d<f32>;
@group(0) @binding(1) var copiedTextureView: texture_2d<f32>;
@group(0) @binding(2) var nearestSampler: sampler;
@group(0) @binding(3) var linearSampler: sampler;

struct VertexOut {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
};

@vertex
fn vsMain(@builtin(vertex_index) vertexIndex: u32) -> VertexOut {
  let positions = array<vec2f, 3>(
    vec2f(-1.0, -1.0),
    vec2f(3.0, -1.0),
    vec2f(-1.0, 3.0)
  );
  let position = positions[vertexIndex];

  var out: VertexOut;
  out.position = vec4f(position, 0.0, 1.0);
  out.uv = position * 0.5 + vec2f(0.5);
  return out;
}

fn panelUv(uv: vec2f) -> vec2f {
  return vec2f(fract(uv.x * 3.0), uv.y);
}

@fragment
fn fsMain(input: VertexOut) -> @location(0) vec4f {
  let panel = input.uv.x * 3.0;
  let uv = panelUv(input.uv);
  let nearestColor = textureSample(writeTextureView, nearestSampler, uv);
  let linearColor = textureSample(writeTextureView, linearSampler, uv);
  let copiedColor = textureSample(copiedTextureView, linearSampler, uv);
  if (panel < 1.0) {
    return nearestColor;
  }
  if (panel < 2.0) {
    return vec4f(linearColor.rgb * vec3f(0.78, 1.0, 0.92), 1.0);
  }
  return vec4f(copiedColor.bgr * vec3f(1.0, 0.86, 1.0), 1.0);
}
