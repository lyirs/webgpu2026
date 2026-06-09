struct VertexOutput {
  @builtin(position) clipPosition: vec4f,
};

@group(0) @binding(0) var sourceDepth: texture_depth_2d;

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
  let dimensions = textureDimensions(sourceDepth);
  let coord = clamp(
    vec2i(position.xy),
    vec2i(0),
    vec2i(dimensions) - vec2i(1)
  );
  let depth = textureLoad(sourceDepth, coord, 0);
  return vec4f(depth, 0.0, 0.0, 1.0);
}
