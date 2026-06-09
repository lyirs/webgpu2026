struct Params {
  groups: u32,
  cellCount: u32,
  timeStep: u32,
  _pad0: u32,
};

struct VertexOut {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
};

@group(0) @binding(0) var<storage, read_write> dispatchArgs: array<u32>;
@group(0) @binding(1) var<uniform> argsParams: Params;

@compute @workgroup_size(1)
fn writeArgs() {
  dispatchArgs[0] = argsParams.groups;
  dispatchArgs[1] = 1u;
  dispatchArgs[2] = 1u;
}

@group(0) @binding(0) var<storage, read_write> cells: array<u32>;
@group(0) @binding(1) var<uniform> fillParams: Params;

@compute @workgroup_size(64)
fn fillCells(@builtin(global_invocation_id) globalId: vec3u) {
  if (globalId.x >= fillParams.cellCount) {
    return;
  }

  cells[globalId.x] = 1u + ((globalId.x + fillParams.timeStep) % 5u);
}

@group(0) @binding(0) var<storage, read> directCells: array<u32>;
@group(0) @binding(1) var<storage, read> indirectCells: array<u32>;
@vertex
fn vsMain(@builtin(vertex_index) vertexIndex: u32) -> VertexOut {
  var positions = array<vec2f, 3>(
    vec2f(-1.0, -1.0),
    vec2f(3.0, -1.0),
    vec2f(-1.0, 3.0),
  );

  let position = positions[vertexIndex];
  var out: VertexOut;
  out.position = vec4f(position, 0.0, 1.0);
  out.uv = position * 0.5 + vec2f(0.5);
  return out;
}

fn palette(value: u32) -> vec3f {
  if (value == 0u) {
    return vec3f(0.035, 0.06, 0.095);
  }
  if (value == 1u) {
    return vec3f(0.22, 0.86, 0.78);
  }
  if (value == 2u) {
    return vec3f(0.38, 0.66, 1.0);
  }
  if (value == 3u) {
    return vec3f(0.94, 0.72, 0.25);
  }
  return vec3f(0.96, 0.42, 0.28);
}

@fragment
fn fsMain(input: VertexOut) -> @location(0) vec4f {
  let panel = min(1u, u32(floor(input.uv.x * 2.0)));
  let localUv = vec2f(fract(input.uv.x * 2.0), input.uv.y);
  let grid = vec2u(clamp(floor(localUv * 16.0), vec2f(0.0), vec2f(15.0)));
  let index = grid.y * 16u + grid.x;
  let value = select(directCells[index], indirectCells[index], panel == 1u);
  let line = select(0.0, 0.16, fract(localUv.x * 16.0) < 0.035 || fract(localUv.y * 16.0) < 0.035);
  return vec4f(palette(value) + line, 1.0);
}
