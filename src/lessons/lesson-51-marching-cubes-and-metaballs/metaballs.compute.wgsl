struct ComputeUniforms {
  counts: vec4u,
  surface: vec4f,
  metaballs: array<vec4f, 4>,
};

struct MeshVertex {
  position: vec4f,
  normal: vec4f,
};

struct DrawCounters {
  vertexCount: atomic<u32>,
  instanceCount: u32,
  firstVertex: u32,
  firstInstance: u32,
  activeCells: atomic<u32>,
  pad0: u32,
  pad1: u32,
  pad2: u32,
};

@group(0) @binding(0) var<uniform> params: ComputeUniforms;
@group(0) @binding(1) var<storage, read_write> meshVertices: array<MeshVertex>;
@group(0) @binding(2) var<storage, read_write> counters: DrawCounters;

const CORNER_OFFSETS = array<vec3f, 8>(
  vec3f(0.0, 0.0, 0.0),
  vec3f(1.0, 0.0, 0.0),
  vec3f(1.0, 1.0, 0.0),
  vec3f(0.0, 1.0, 0.0),
  vec3f(0.0, 0.0, 1.0),
  vec3f(1.0, 0.0, 1.0),
  vec3f(1.0, 1.0, 1.0),
  vec3f(0.0, 1.0, 1.0),
);

// 为了避免在 lesson 里塞进完整的 256 项大查表，这里把每个 cube cell
// 拆成 6 个 tetrahedra 来提取等值面；教学目标仍然是“从 cube cell 提面”。
const TETRAHEDRA = array<vec4u, 6>(
  vec4u(0u, 5u, 1u, 6u),
  vec4u(0u, 1u, 2u, 6u),
  vec4u(0u, 2u, 3u, 6u),
  vec4u(0u, 3u, 7u, 6u),
  vec4u(0u, 7u, 4u, 6u),
  vec4u(0u, 4u, 5u, 6u),
);

fn sampleField(position: vec3f) -> f32 {
  var density = 0.0;

  for (var index = 0u; index < params.counts.y; index = index + 1u) {
    let metaball = params.metaballs[index];
    let delta = position - metaball.xyz;
    let radiusSq = max(metaball.w * metaball.w, 0.00001);
    density = density + exp(-dot(delta, delta) / radiusSq);
  }

  return density * params.surface.y;
}

fn sampleGradient(position: vec3f) -> vec3f {
  let delta = vec3f(params.surface.w, 0.0, 0.0);
  let dx = sampleField(position + delta.xyy) - sampleField(position - delta.xyy);
  let dy = sampleField(position + delta.yxy) - sampleField(position - delta.yxy);
  let dz = sampleField(position + delta.yyx) - sampleField(position - delta.yyx);
  return vec3f(dx, dy, dz);
}

fn cellCornerPosition(cell: vec3u, cornerIndex: u32) -> vec3f {
  let offset = CORNER_OFFSETS[cornerIndex];
  let resolution = f32(params.counts.x);
  let uvw = (vec3f(cell) + offset) / resolution;
  let minCorner = vec3f(-params.surface.z);
  let maxCorner = vec3f(params.surface.z);
  return mix(minCorner, maxCorner, uvw);
}

fn interpolateEdge(
  positionA: vec3f,
  positionB: vec3f,
  valueA: f32,
  valueB: f32
) -> vec3f {
  let delta = valueB - valueA;

  if (abs(delta) < 0.00001) {
    return (positionA + positionB) * 0.5;
  }

  let t = clamp((params.surface.x - valueA) / delta, 0.0, 1.0);
  return mix(positionA, positionB, t);
}

fn makeMeshVertex(position: vec3f) -> MeshVertex {
  let gradient = sampleGradient(position);
  let normal = normalize(select(vec3f(0.0, 1.0, 0.0), gradient, length(gradient) > 0.00001));
  return MeshVertex(vec4f(position, 1.0), vec4f(normal, 0.0));
}

fn emitTriangle(positionA: vec3f, positionB: vec3f, positionC: vec3f) {
  var b = positionB;
  var c = positionC;

  let center = (positionA + b + c) / 3.0;
  let faceNormal = cross(b - positionA, c - positionA);
  let gradient = sampleGradient(center);

  if (length(faceNormal) > 0.00001 && dot(faceNormal, gradient) < 0.0) {
    let swapped = b;
    b = c;
    c = swapped;
  }

  let base = atomicAdd(&counters.vertexCount, 3u);
  meshVertices[base] = makeMeshVertex(positionA);
  meshVertices[base + 1u] = makeMeshVertex(b);
  meshVertices[base + 2u] = makeMeshVertex(c);
}

fn polygonizeTetrahedron(
  positions: array<vec3f, 4>,
  values: array<f32, 4>
) -> u32 {
  var insideIndices: array<u32, 4>;
  var outsideIndices: array<u32, 4>;
  var insideCount = 0u;
  var outsideCount = 0u;

  for (var index = 0u; index < 4u; index = index + 1u) {
    if (values[index] >= params.surface.x) {
      insideIndices[insideCount] = index;
      insideCount = insideCount + 1u;
    } else {
      outsideIndices[outsideCount] = index;
      outsideCount = outsideCount + 1u;
    }
  }

  if (insideCount == 0u || insideCount == 4u) {
    return 0u;
  }

  if (insideCount == 1u) {
    let inside = insideIndices[0];
    let outsideA = outsideIndices[0];
    let outsideB = outsideIndices[1];
    let outsideC = outsideIndices[2];
    let edgeA = interpolateEdge(positions[inside], positions[outsideA], values[inside], values[outsideA]);
    let edgeB = interpolateEdge(positions[inside], positions[outsideB], values[inside], values[outsideB]);
    let edgeC = interpolateEdge(positions[inside], positions[outsideC], values[inside], values[outsideC]);
    emitTriangle(edgeA, edgeB, edgeC);
    return 1u;
  }

  if (insideCount == 3u) {
    let outside = outsideIndices[0];
    let insideA = insideIndices[0];
    let insideB = insideIndices[1];
    let insideC = insideIndices[2];
    let edgeA = interpolateEdge(positions[outside], positions[insideA], values[outside], values[insideA]);
    let edgeB = interpolateEdge(positions[outside], positions[insideB], values[outside], values[insideB]);
    let edgeC = interpolateEdge(positions[outside], positions[insideC], values[outside], values[insideC]);
    emitTriangle(edgeA, edgeC, edgeB);
    return 1u;
  }

  let insideA = insideIndices[0];
  let insideB = insideIndices[1];
  let outsideA = outsideIndices[0];
  let outsideB = outsideIndices[1];

  let edgeA = interpolateEdge(positions[insideA], positions[outsideA], values[insideA], values[outsideA]);
  let edgeB = interpolateEdge(positions[insideA], positions[outsideB], values[insideA], values[outsideB]);
  let edgeC = interpolateEdge(positions[insideB], positions[outsideA], values[insideB], values[outsideA]);
  let edgeD = interpolateEdge(positions[insideB], positions[outsideB], values[insideB], values[outsideB]);

  emitTriangle(edgeA, edgeB, edgeC);
  emitTriangle(edgeC, edgeB, edgeD);
  return 2u;
}

@compute @workgroup_size(4, 4, 4)
fn csMain(@builtin(global_invocation_id) globalId: vec3u) {
  let cellResolution = params.counts.x;

  if (
    globalId.x >= cellResolution ||
    globalId.y >= cellResolution ||
    globalId.z >= cellResolution
  ) {
    return;
  }

  var cornerPositions: array<vec3f, 8>;
  var cornerValues: array<f32, 8>;

  for (var cornerIndex = 0u; cornerIndex < 8u; cornerIndex = cornerIndex + 1u) {
    let position = cellCornerPosition(globalId, cornerIndex);
    cornerPositions[cornerIndex] = position;
    cornerValues[cornerIndex] = sampleField(position);
  }

  var emittedTriangles = 0u;

  for (var tetraIndex = 0u; tetraIndex < 6u; tetraIndex = tetraIndex + 1u) {
    let tetra = TETRAHEDRA[tetraIndex];
    var tetraPositions: array<vec3f, 4>;
    var tetraValues: array<f32, 4>;

    tetraPositions[0] = cornerPositions[tetra.x];
    tetraPositions[1] = cornerPositions[tetra.y];
    tetraPositions[2] = cornerPositions[tetra.z];
    tetraPositions[3] = cornerPositions[tetra.w];

    tetraValues[0] = cornerValues[tetra.x];
    tetraValues[1] = cornerValues[tetra.y];
    tetraValues[2] = cornerValues[tetra.z];
    tetraValues[3] = cornerValues[tetra.w];

    emittedTriangles = emittedTriangles + polygonizeTetrahedron(tetraPositions, tetraValues);
  }

  if (emittedTriangles > 0u) {
    atomicAdd(&counters.activeCells, 1u);
  }
}
