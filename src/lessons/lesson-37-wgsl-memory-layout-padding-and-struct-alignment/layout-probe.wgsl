struct LayoutProbe {
  tint: vec3f,
  transform: mat4x4f,
  weights: vec3f,
  gain: f32,
};

struct Params {
  time: f32,
  expectedTransformOffset: f32,
  compactTransformOffset: f32,
  alignedTransformOffset: f32,
};

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
};

@group(0) @binding(0) var<uniform> compactData: LayoutProbe;
@group(0) @binding(1) var<uniform> alignedData: LayoutProbe;
@group(0) @binding(2) var<uniform> params: Params;

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

fn visualize(data: LayoutProbe, localUv: vec2f) -> vec3f {
  let wobble = 0.5 + 0.5 * sin(localUv.xyx * vec3f(8.0, 10.0, 12.0) + params.time);
  let matrixSignal = vec3f(
    data.transform[0].x,
    data.transform[1].y,
    data.transform[2].z
  );
  return clamp(data.tint * data.gain + data.weights * 0.22 + matrixSignal * 0.18 + wobble * 0.16, vec3f(0.0), vec3f(1.0));
}

@fragment
fn fsMain(input: VertexOutput) -> @location(0) vec4f {
  let panel = floor(input.uv.x * 3.0);
  let localUv = vec2f(fract(input.uv.x * 3.0), input.uv.y);
  let reference = vec3f(0.18 + localUv.x * 0.24, 0.34 + localUv.y * 0.25, 0.75);
  let compact = visualize(compactData, localUv);
  let aligned = visualize(alignedData, localUv);
  let color = select(select(reference, compact, panel >= 1.0), aligned, panel >= 2.0);
  let divider = step(abs(fract(input.uv.x * 3.0) - 0.005), 0.005);
  return vec4f(mix(color, vec3f(1.0, 0.68, 0.36), divider * 0.55), 1.0);
}
