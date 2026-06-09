struct Params {
  time: f32,
  gridSize: f32,
  pulse: f32,
  padding: f32,
};

@group(0) @binding(0) var<storage, read> inputCells: array<vec4f>;
@group(0) @binding(1) var<storage, read_write> naiveCells: array<vec4f>;
@group(0) @binding(2) var<storage, read_write> tiledCells: array<vec4f>;
@group(0) @binding(3) var<uniform> params: Params;

var<workgroup> tile: array<f32, 100>;

fn gridIndex(x: u32, y: u32) -> u32 {
  let size = u32(params.gridSize);
  return y * size + x;
}

fn sampleInput(x: i32, y: i32) -> f32 {
  let size = i32(params.gridSize);
  let sx = u32(clamp(x, 0, size - 1));
  let sy = u32(clamp(y, 0, size - 1));
  let base = inputCells[gridIndex(sx, sy)].x;
  let shimmer = 0.08 * sin(params.time + f32(sx) * 0.17 + f32(sy) * 0.11);
  return clamp(base + shimmer, 0.0, 1.0);
}

@compute @workgroup_size(8, 8)
fn csMain(
  @builtin(global_invocation_id) globalId: vec3u,
  @builtin(local_invocation_id) localId: vec3u
) {
  let size = u32(params.gridSize);
  let lx = localId.x;
  let ly = localId.y;
  let clampedGlobal = min(globalId.xy, vec2u(size - 1u));
  let x = i32(clampedGlobal.x);
  let y = i32(clampedGlobal.y);
  let tileIndex = (ly + 1u) * 10u + (lx + 1u);

  tile[tileIndex] = sampleInput(x, y);
  if (lx == 0u) {
    tile[(ly + 1u) * 10u] = sampleInput(x - 1, y);
  }
  if (lx == 7u) {
    tile[(ly + 1u) * 10u + 9u] = sampleInput(x + 1, y);
  }
  if (ly == 0u) {
    tile[lx + 1u] = sampleInput(x, y - 1);
  }
  if (ly == 7u) {
    tile[9u * 10u + lx + 1u] = sampleInput(x, y + 1);
  }

  workgroupBarrier();

  let center = sampleInput(x, y);
  let naive = (
    center +
    sampleInput(x - 1, y) +
    sampleInput(x + 1, y) +
    sampleInput(x, y - 1) +
    sampleInput(x, y + 1)
  ) * 0.2;
  let tiled = (
    tile[tileIndex] +
    tile[tileIndex - 1u] +
    tile[tileIndex + 1u] +
    tile[tileIndex - 10u] +
    tile[tileIndex + 10u]
  ) * 0.2;
  if (globalId.x < size && globalId.y < size) {
    let outputIndex = gridIndex(globalId.x, globalId.y);
    naiveCells[outputIndex] = vec4f(naive, abs(naive - center), f32(globalId.x % 8u) / 7.0, 1.0);
    tiledCells[outputIndex] = vec4f(tiled, abs(tiled - naive), f32(localId.y) / 7.0, 1.0);
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

fn heatColor(value: f32, accent: f32) -> vec3f {
  let blue = vec3f(0.05, 0.12, 0.22);
  let cyan = vec3f(0.05, 0.78, 1.0);
  let gold = vec3f(1.0, 0.66, 0.22);
  return mix(mix(blue, cyan, smoothstep(0.0, 0.72, value)), gold, smoothstep(0.58, 1.0, value) * (0.4 + accent * 0.35));
}

@fragment
fn fsMain(input: VertexOutput) -> @location(0) vec4f {
  let leftPanel = input.uv.x < 0.5;
  let panelUv = vec2f(select((input.uv.x - 0.5) * 2.0, input.uv.x * 2.0, leftPanel), input.uv.y);
  let size = u32(params.gridSize);
  let cell = vec2u(clamp(panelUv * f32(size), vec2f(0.0), vec2f(f32(size - 1u))));
  let data = select(tiledCells[gridIndex(cell.x, cell.y)], naiveCells[gridIndex(cell.x, cell.y)], leftPanel);
  let localGrid = abs(fract(panelUv * f32(size / 8u)) - vec2f(0.5));
  let workgroupLine = select(0.0, 0.22, min(localGrid.x, localGrid.y) > 0.485);
  let divider = smoothstep(0.003, 0.0, abs(input.uv.x - 0.5));
  let color = heatColor(data.x, data.y) + workgroupLine;
  return vec4f(mix(color, vec3f(1.0, 0.72, 0.4), divider), 1.0);
}
