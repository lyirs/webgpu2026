@group(0) @binding(0) var shadowNoBias: texture_depth_2d;
@group(0) @binding(1) var shadowFixedBias: texture_depth_2d;
@group(0) @binding(2) var shadowSlopeBias: texture_depth_2d;
@group(0) @binding(3) var shadowSampler: sampler_comparison;

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
};

fn lightProject(position: vec3f) -> vec4f {
  let clipX = position.x * 0.72 + position.z * 0.22;
  let clipY = position.z * 0.62 - position.y * 0.52;
  let depth = 0.48 + position.y * 0.24 + position.z * 0.08 - position.x * 0.035;
  return vec4f(clipX, clipY, depth, 1.0);
}

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

fn samplePanel(panel: u32, uv: vec2f, compareDepth: f32) -> f32 {
  let safeUv = clamp(uv, vec2f(0.001), vec2f(0.999));
  let inRange = f32(uv.x >= 0.0 && uv.x <= 1.0 && uv.y >= 0.0 && uv.y <= 1.0);
  let noBias = textureSampleCompare(shadowNoBias, shadowSampler, safeUv, compareDepth);
  let fixedBias = textureSampleCompare(shadowFixedBias, shadowSampler, safeUv, compareDepth);
  let slopeBias = textureSampleCompare(shadowSlopeBias, shadowSampler, safeUv, compareDepth);
  var visibility = noBias;
  visibility = select(visibility, fixedBias, panel == 1u);
  visibility = select(visibility, slopeBias, panel == 2u);
  return mix(1.0, visibility, inRange);
}

@fragment
fn fsMain(input: VertexOutput) -> @location(0) vec4f {
  let panelFloat = floor(input.uv.x * 3.0);
  let panel = u32(clamp(panelFloat, 0.0, 2.0));
  let panelUv = vec2f(fract(input.uv.x * 3.0), input.uv.y);
  let world = vec3f(panelUv.x * 2.0 - 1.0, 0.0, panelUv.y * 2.0 - 1.0);
  let projected = lightProject(world);
  let shadowUv = projected.xy * 0.5 + vec2f(0.5);
  let receiverError = sin(world.x * 85.0) * sin(world.z * 68.0) * 0.0045;
  let visibility = samplePanel(panel, shadowUv, projected.z + receiverError);

  let grid = 0.08 * step(0.985, max(fract(panelUv.x * 12.0), fract(panelUv.y * 8.0)));
  let base = mix(vec3f(0.22, 0.28, 0.22), vec3f(0.72, 0.58, 0.38), panelUv.y) + grid;
  let shadowed = base * vec3f(0.35, 0.32, 0.28);
  var color = mix(shadowed, base, visibility);

  let casterA = step(abs(panelUv.x - 0.5), 0.1) * step(abs(panelUv.y - 0.42), 0.22);
  let casterB = step(abs(panelUv.x - 0.26), 0.07) * step(abs(panelUv.y - 0.72), 0.14);
  color = mix(color, vec3f(0.78, 0.86, 0.92), max(casterA, casterB) * 0.32);

  let divider = step(abs(fract(input.uv.x * 3.0)), 0.006);
  color = mix(color, vec3f(0.95, 0.66, 0.36), divider);
  return vec4f(color, 1.0);
}
