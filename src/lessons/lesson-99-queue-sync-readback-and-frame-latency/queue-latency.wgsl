struct QueueParams {
  frameIndex: f32,
  slotCount: f32,
  readbackEvery: f32,
  padding: f32,
};

@group(0) @binding(0) var<storage, read_write> timeline: array<vec4f>;
@group(0) @binding(1) var<uniform> params: QueueParams;

@compute @workgroup_size(8)
fn csMain(@builtin(global_invocation_id) globalId: vec3u) {
  let index = globalId.x;
  if (index >= u32(params.slotCount)) {
    return;
  }
  let frame = u32(params.frameIndex);
  let slotCount = u32(params.slotCount);
  let age = f32((frame + slotCount - index) % slotCount) / max(1.0, params.slotCount - 1.0);
  let activeWeight = select(0.24, 1.0, index == frame % slotCount);
  let readbackMark = select(0.0, 1.0, frame % max(1u, u32(params.readbackEvery)) == 0u && index == frame % slotCount);
  timeline[index] = vec4f(age, activeWeight, readbackMark, 1.0);
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
  let slotCount = u32(params.slotCount);
  let slot = min(u32(input.uv.x * f32(slotCount)), slotCount - 1u);
  let data = timeline[slot];
  let localX = fract(input.uv.x * f32(slotCount));
  let bar = localX > 0.08 && localX < 0.92 && input.uv.y > 0.18 && input.uv.y < 0.82;
  let base = vec3f(0.035, 0.07, 0.13);
  let oldColor = vec3f(0.1, 0.42, 0.9);
  let activeColor = vec3f(1.0, 0.62, 0.28);
  let readbackColor = vec3f(0.68, 1.0, 0.86);
  var color = base;
  if (bar) {
    color = mix(oldColor, activeColor, data.y) * (0.35 + 0.65 * (1.0 - data.x));
    color = mix(color, readbackColor, data.z);
  }
  let scan = smoothstep(0.0, 0.01, abs(input.uv.y - 0.5));
  color += vec3f(0.04) * scan;
  return vec4f(color, 1.0);
}
