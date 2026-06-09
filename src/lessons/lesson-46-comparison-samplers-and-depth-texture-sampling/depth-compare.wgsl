struct Params {
  time: f32,
  compareDepth: f32,
  texelX: f32,
  texelY: f32,
};

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
};

@group(0) @binding(0) var depthTexture: texture_depth_2d;
@group(0) @binding(1) var comparisonSampler: sampler_comparison;
@group(0) @binding(2) var<uniform> params: Params;

@vertex
fn vsDepth(@builtin(vertex_index) vertexIndex: u32, @builtin(instance_index) instanceIndex: u32) -> @builtin(position) vec4f {
  var base = array<vec2f, 6>(
    vec2f(-1.0, -1.0),
    vec2f(1.0, -1.0),
    vec2f(-1.0, 1.0),
    vec2f(-1.0, 1.0),
    vec2f(1.0, -1.0),
    vec2f(1.0, 1.0)
  );
  var centers = array<vec2f, 3>(
    vec2f(-0.42, -0.05),
    vec2f(0.18, 0.08),
    vec2f(0.52, -0.22)
  );
  var scales = array<vec2f, 3>(
    vec2f(0.36, 0.72),
    vec2f(0.52, 0.34),
    vec2f(0.24, 0.48)
  );
  var depths = array<f32, 3>(0.34, 0.58, 0.44);
  let wobble = sin(params.time + f32(instanceIndex) * 1.7) * 0.035;
  let position = centers[instanceIndex] + base[vertexIndex] * scales[instanceIndex];
  return vec4f(position, depths[instanceIndex] + wobble, 1.0);
}

@vertex
fn vsFullscreen(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
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

fn samplePcf(uv: vec2f, compareDepth: f32) -> f32 {
  var total = 0.0;
  for (var y = -1; y <= 1; y = y + 1) {
    for (var x = -1; x <= 1; x = x + 1) {
      let offset = vec2f(f32(x) * params.texelX, f32(y) * params.texelY);
      total += textureSampleCompare(depthTexture, comparisonSampler, uv + offset, compareDepth);
    }
  }
  return total / 9.0;
}

@fragment
fn fsMain(input: VertexOutput) -> @location(0) vec4f {
  let panel = floor(input.uv.x * 3.0);
  let localUv = vec2f(fract(input.uv.x * 3.0), input.uv.y);
  let dimensions = vec2f(textureDimensions(depthTexture));
  let loadCoord = vec2i(clamp(localUv * dimensions, vec2f(0.0), dimensions - vec2f(1.0)));
  let rawDepth = textureLoad(depthTexture, loadCoord, 0);
  let singleCompare = textureSampleCompare(depthTexture, comparisonSampler, localUv, params.compareDepth);
  let pcfCompare = samplePcf(localUv, params.compareDepth);
  let rawColor = vec3f(rawDepth, rawDepth * rawDepth, 1.0 - rawDepth);
  let compareColor = mix(vec3f(0.08, 0.12, 0.18), vec3f(0.85, 0.96, 1.0), singleCompare);
  let pcfColor = mix(vec3f(0.08, 0.12, 0.18), vec3f(1.0, 0.82, 0.46), pcfCompare);
  let color = select(select(rawColor, compareColor, panel >= 1.0), pcfColor, panel >= 2.0);
  let grid = step(fract(localUv.x * 16.0), 0.025) + step(fract(localUv.y * 9.0), 0.035);
  return vec4f(mix(color, vec3f(1.0), min(grid, 1.0) * 0.08), 1.0);
}
