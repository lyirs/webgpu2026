struct SortUniforms {
  paramsU32: vec4u,
  paramsF32: vec4f,
};

struct SortItem {
  payload: vec4f,
};

@group(0) @binding(0) var<uniform> sortUniforms: SortUniforms;
@group(0) @binding(1) var<storage, read> items: array<SortItem>;

struct VertexOutput {
  @builtin(position) clipPosition: vec4f,
  @location(0) color: vec4f,
  @location(1) columnShade: f32,
};

const quad = array<vec2f, 6>(
  vec2f(-0.5, 0.0),
  vec2f(0.5, 0.0),
  vec2f(0.5, 1.0),
  vec2f(-0.5, 0.0),
  vec2f(0.5, 1.0),
  vec2f(-0.5, 1.0),
);

@vertex
fn vsMain(
  @builtin(vertex_index) vertexIndex: u32,
  @builtin(instance_index) instanceIndex: u32
) -> VertexOutput {
  let item = items[instanceIndex].payload;
  let itemCount = f32(sortUniforms.paramsU32.x);
  let barWidth = 1.92 / itemCount;
  let local = quad[vertexIndex];
  let centerX = -0.96 + barWidth * (f32(instanceIndex) + 0.5);
  let baseY = -0.9;
  let height = item.x * 1.72;
  let normalizedIndex = select(
    0.0,
    f32(instanceIndex) / max(itemCount - 1.0, 1.0),
    itemCount > 1.0
  );
  let baseColor = mix(
    vec3f(0.24, 0.66, 0.93),
    vec3f(0.97, 0.76, 0.28),
    normalizedIndex
  );

  var output: VertexOutput;
  output.clipPosition = vec4f(
    centerX + local.x * barWidth * 0.82,
    baseY + local.y * height,
    0.0,
    1.0
  );
  output.color = vec4f(baseColor, 1.0);
  output.columnShade = local.y;
  return output;
}
