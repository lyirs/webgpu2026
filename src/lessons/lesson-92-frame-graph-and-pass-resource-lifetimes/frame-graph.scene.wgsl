struct TileData {
  values: array<vec4f, 16>,
};

@group(0) @binding(0) var<storage, read> tiles: TileData;

struct VertexOut {
  @builtin(position) position: vec4f,
  @location(0) @interpolate(flat) tileIndex: u32,
};

@vertex
fn vsMain(@builtin(vertex_index) vertexIndex: u32) -> VertexOut {
  let tile = vertexIndex / 6u;
  let corner = vertexIndex % 6u;
  let column = tile % 4u;
  let row = tile / 4u;
  var corners = array<vec2f, 6>(
    vec2f(-0.85, -0.85),
    vec2f(-0.48, -0.85),
    vec2f(-0.85, -0.48),
    vec2f(-0.85, -0.48),
    vec2f(-0.48, -0.85),
    vec2f(-0.48, -0.48),
  );
  let offset = vec2f(f32(column) * 0.44, f32(row) * 0.44);
  var out: VertexOut;
  out.position = vec4f(corners[corner] + offset, 0.0, 1.0);
  out.tileIndex = tile;
  return out;
}

@fragment
fn fsMain(input: VertexOut) -> @location(0) vec4f {
  return tiles.values[input.tileIndex];
}
