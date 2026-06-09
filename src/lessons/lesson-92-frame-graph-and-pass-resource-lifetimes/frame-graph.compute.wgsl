struct TileData {
  values: array<vec4f, 16>,
};

@group(0) @binding(0) var<storage, read_write> tiles: TileData;

@compute @workgroup_size(16)
fn csMain(@builtin(local_invocation_id) localId: vec3u) {
  let index = localId.x;
  let t = f32(index) / 15.0;
  tiles.values[index] = vec4f(
    0.16 + 0.72 * t,
    0.78 - 0.34 * t,
    1.0 - 0.55 * t,
    1.0,
  );
}
