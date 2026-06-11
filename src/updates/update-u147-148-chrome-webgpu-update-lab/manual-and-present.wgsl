struct Params {
  gridWidth: u32,
  gridHeight: u32,
  frame: u32,
  mode: u32,
  dispatchX: u32,
  dispatchY: u32,
  workgroupSizeX: u32,
  workgroupSizeY: u32,
};

@group(0) @binding(0) var<storage, read_write> outputCells: array<u32>;
@group(0) @binding(1) var<uniform> computeParams: Params;

fn encodeCell(globalIndex: u32, workgroupIndex: u32, frame: u32) -> u32 {
  let shade = (globalIndex * 13u + frame * 3u) & 255u;
  let groupTint = (workgroupIndex & 255u) << 8u;
  return shade | groupTint;
}

@compute @workgroup_size(4, 4, 1)
fn csManual(
  @builtin(global_invocation_id) globalId: vec3u,
  @builtin(workgroup_id) workgroupId: vec3u,
  @builtin(num_workgroups) numWorkgroups: vec3u
) {
  if (globalId.x >= computeParams.gridWidth || globalId.y >= computeParams.gridHeight) {
    return;
  }

  let manualGlobalIndex =
    globalId.x +
    globalId.y * computeParams.gridWidth +
    globalId.z * computeParams.gridWidth * computeParams.gridHeight;

  let manualWorkgroupIndex =
    workgroupId.x +
    workgroupId.y * numWorkgroups.x +
    workgroupId.z * numWorkgroups.x * numWorkgroups.y;

  outputCells[manualGlobalIndex] = encodeCell(
    manualGlobalIndex,
    manualWorkgroupIndex,
    computeParams.frame
  );
}

struct VertexOut {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
};

@vertex
fn vsFullscreen(@builtin(vertex_index) vertexIndex: u32) -> VertexOut {
  var positions = array<vec2f, 3>(
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

@group(1) @binding(0) var<storage, read> manualCells: array<u32>;
@group(1) @binding(1) var<storage, read> updateCells: array<u32>;
@group(1) @binding(2) var<uniform> renderParams: Params;

fn cellColor(value: u32, mode: u32, isUpdatePanel: bool) -> vec3f {
  let shade = f32(value & 255u) / 255.0;
  let groupValue = f32((value >> 8u) & 255u) / max(1.0, f32(renderParams.dispatchX * renderParams.dispatchY - 1u));

  var color = vec3f(
    0.08 + shade * 0.52,
    0.32 + groupValue * 0.48,
    0.95 - shade * 0.26
  );

  if (isUpdatePanel && mode == 0u) {
    color = color * 0.72 + vec3f(0.62, 0.36, 0.06) * 0.28;
  }

  return color;
}

@fragment
fn fsFullscreen(input: VertexOut) -> @location(0) vec4f {
  let isUpdatePanel = input.uv.x >= 0.5;
  let panelUv = vec2f(fract(input.uv.x * 2.0), input.uv.y);
  let cell = vec2u(
    min(u32(panelUv.x * f32(renderParams.gridWidth)), renderParams.gridWidth - 1u),
    min(u32((1.0 - panelUv.y) * f32(renderParams.gridHeight)), renderParams.gridHeight - 1u)
  );
  let index = cell.x + cell.y * renderParams.gridWidth;
  let value = select(manualCells[index], updateCells[index], isUpdatePanel);

  var color = cellColor(value, renderParams.mode, isUpdatePanel);

  let cellUv = fract(panelUv * vec2f(f32(renderParams.gridWidth), f32(renderParams.gridHeight)));
  let gridLine = max(
    1.0 - smoothstep(0.0, 0.035, min(cellUv.x, 1.0 - cellUv.x)),
    1.0 - smoothstep(0.0, 0.035, min(cellUv.y, 1.0 - cellUv.y))
  );
  color = color * (1.0 - gridLine * 0.38) + vec3f(0.92, 0.98, 1.0) * gridLine * 0.26;

  let divider = 1.0 - smoothstep(0.0, 0.006, abs(input.uv.x - 0.5));
  color = color * (1.0 - divider) + vec3f(1.0, 0.68, 0.36) * divider;

  return vec4f(color, 1.0);
}
