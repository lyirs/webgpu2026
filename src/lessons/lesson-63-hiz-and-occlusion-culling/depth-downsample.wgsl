struct VertexOutput {
  @builtin(position) clipPosition: vec4f,
};

@group(0) @binding(0) var sourceLevel: texture_2d<f32>;

@vertex
fn vsMain(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
  let positions = array<vec2f, 3>(
    vec2f(-1.0, -3.0),
    vec2f(-1.0, 1.0),
    vec2f(3.0, 1.0)
  );

  var output: VertexOutput;
  output.clipPosition = vec4f(positions[vertexIndex], 0.0, 1.0);
  return output;
}

@fragment
fn fsMain(@builtin(position) position: vec4f) -> @location(0) vec4f {
  let sourceSize = vec2i(textureDimensions(sourceLevel));
  let baseCoord = vec2i(position.xy) * 2;
  let coord00 = clamp(baseCoord, vec2i(0), sourceSize - vec2i(1));
  let coord10 = clamp(baseCoord + vec2i(1, 0), vec2i(0), sourceSize - vec2i(1));
  let coord01 = clamp(baseCoord + vec2i(0, 1), vec2i(0), sourceSize - vec2i(1));
  let coord11 = clamp(baseCoord + vec2i(1, 1), vec2i(0), sourceSize - vec2i(1));

  let depth = min(
    min(textureLoad(sourceLevel, coord00, 0).x, textureLoad(sourceLevel, coord10, 0).x),
    min(textureLoad(sourceLevel, coord01, 0).x, textureLoad(sourceLevel, coord11, 0).x)
  );

  return vec4f(depth, 0.0, 0.0, 1.0);
}
