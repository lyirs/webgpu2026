@group(0) @binding(0) var sceneSampler: sampler;
@group(0) @binding(1) var sceneTexture: texture_2d<f32>;
struct SceneUniforms {
  generation: f32,
  targetWidth: f32,
  targetHeight: f32,
  time: f32,
};

@group(1) @binding(0) var<uniform> sceneUniforms: SceneUniforms;

struct VertexOut {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
};

@vertex
fn vsScene(@builtin(vertex_index) vertexIndex: u32) -> VertexOut {
  var positions = array<vec2f, 6>(
    vec2f(-0.68, -0.42),
    vec2f(0.68, -0.42),
    vec2f(-0.68, 0.42),
    vec2f(-0.68, 0.42),
    vec2f(0.68, -0.42),
    vec2f(0.68, 0.42),
  );
  var out: VertexOut;
  out.position = vec4f(positions[vertexIndex], 0.0, 1.0);
  out.uv = positions[vertexIndex] * 0.5 + vec2f(0.5);
  return out;
}

@fragment
fn fsScene(input: VertexOut) -> @location(0) vec4f {
  let stripes = step(0.5, fract((input.uv.x + input.uv.y) * 12.0));
  let generationBand = fract(sceneUniforms.generation * 0.17);
  let generationTint = vec3f(generationBand, 0.45 + 0.35 * sin(sceneUniforms.generation), 0.9 - generationBand * 0.45);
  let pulse = 0.72 + 0.28 * sin(sceneUniforms.time * 2.2 + input.uv.x * 8.0);
  let color = mix(vec3f(0.18, 0.42, 0.72), vec3f(1.0, 0.66, 0.28), stripes);
  return vec4f(mix(color, generationTint, 0.36) * (0.78 + 0.22 * input.uv.y) * pulse, 1.0);
}

@vertex
fn vsPresent(@builtin(vertex_index) vertexIndex: u32) -> VertexOut {
  var positions = array<vec2f, 6>(
    vec2f(-1.0, -1.0),
    vec2f(1.0, -1.0),
    vec2f(-1.0, 1.0),
    vec2f(-1.0, 1.0),
    vec2f(1.0, -1.0),
    vec2f(1.0, 1.0),
  );
  let pos = positions[vertexIndex];
  var out: VertexOut;
  out.position = vec4f(pos, 0.0, 1.0);
  out.uv = pos * 0.5 + vec2f(0.5);
  return out;
}

@fragment
fn fsPresent(input: VertexOut) -> @location(0) vec4f {
  let color = textureSample(sceneTexture, sceneSampler, input.uv).rgb;
  let marker = step(input.uv.x, fract(sceneUniforms.generation * 0.13));
  let markerBand = step(input.uv.y, 0.055) * marker;
  let border = step(input.uv.x, 0.025) + step(input.uv.y, 0.025) +
    step(0.975, input.uv.x) + step(0.975, input.uv.y);
  let withMarker = mix(color, vec3f(0.98, 0.9, 0.35), markerBand * 0.72);
  return vec4f(mix(withMarker, vec3f(0.78, 0.92, 1.0), min(border, 1.0)), 1.0);
}
