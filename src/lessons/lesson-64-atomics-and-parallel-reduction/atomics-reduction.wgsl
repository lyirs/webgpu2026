struct AtomicParams {
  sampleCount: f32,
  threshold: f32,
  binCount: f32,
  maxValue: f32,
};

@group(0) @binding(0) var<storage, read> values: array<u32>;
@group(0) @binding(1) var<storage, read_write> histogram: array<atomic<u32>>;
@group(0) @binding(2) var<storage, read_write> summary: array<atomic<u32>>;
@group(0) @binding(3) var<storage, read_write> displayBins: array<vec4f>;
@group(0) @binding(4) var<uniform> params: AtomicParams;

@compute @workgroup_size(64)
fn csAccumulate(@builtin(global_invocation_id) globalId: vec3u) {
  let index = globalId.x;
  if (index >= u32(params.sampleCount)) {
    return;
  }

  let value = values[index];
  let bin = min(value / 16u, u32(params.binCount) - 1u);
  atomicAdd(&histogram[bin], 1u);
  if (value >= u32(params.threshold)) {
    atomicAdd(&summary[0], 1u);
  }
  atomicMax(&summary[1], value);
}

@compute @workgroup_size(16)
fn csNormalize(@builtin(global_invocation_id) globalId: vec3u) {
  let bin = globalId.x;
  if (bin < u32(params.binCount)) {
    let count = atomicLoad(&histogram[bin]);
    displayBins[bin] = vec4f(f32(count), f32(bin), 0.0, 1.0);
  }
  if (bin == 0u) {
    displayBins[16] = vec4f(f32(atomicLoad(&summary[0])), f32(atomicLoad(&summary[1])), 0.0, 1.0);
  }
}

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
};

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
  let binCount = u32(params.binCount);
  let bin = min(u32(input.uv.x * f32(binCount)), binCount - 1u);
  let data = displayBins[bin];
  let maxBar = max(1.0, params.sampleCount / f32(binCount) * 1.8);
  let barHeight = clamp(data.x / maxBar, 0.02, 1.0);
  let inside = input.uv.y < barHeight;
  let stripe = smoothstep(0.0, 0.025, abs(fract(input.uv.x * f32(binCount)) - 0.5));
  let hot = smoothstep(params.threshold / params.maxValue, 1.0, (data.y * 16.0) / params.maxValue);
  let base = mix(vec3f(0.04, 0.09, 0.18), vec3f(0.08, 0.65, 1.0), select(0.0, 1.0, inside));
  let color = mix(base, vec3f(1.0, 0.56, 0.22), hot * select(0.2, 0.85, inside));
  let grid = vec3f(stripe * 0.08);
  return vec4f(color + grid, 1.0);
}
