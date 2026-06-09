struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
};

@group(0) @binding(0) var depthTexture: texture_depth_2d;

@vertex
fn vsDepth(@builtin(vertex_index) vertexIndex: u32) -> @builtin(position) vec4f {
  var positions = array<vec4f, 9>(
    vec4f(-0.92, -0.72, 0.70, 1.0), vec4f(-0.14, -0.72, 0.70, 1.0), vec4f(-0.52, 0.62, 0.12, 1.0),
    vec4f(-0.06, -0.54, 0.36, 1.0), vec4f(0.72, -0.54, 0.36, 1.0), vec4f(0.44, 0.54, 0.26, 1.0),
    vec4f(0.08, 0.12, 0.18, 1.0), vec4f(0.92, 0.12, 0.18, 1.0), vec4f(0.86, 0.82, 0.18, 1.0)
  );
  return positions[vertexIndex];
}

@vertex
fn vsFullscreen(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
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

@fragment
fn fsPresent(input: VertexOutput) -> @location(0) vec4f {
  let panel = select(0.0, 1.0, input.uv.x > 0.5);
  let panelUv = vec2f(fract(input.uv.x * 2.0), input.uv.y);
  let textureSize = vec2f(textureDimensions(depthTexture));
  let sampleCoord = vec2i(clamp(panelUv * textureSize, vec2f(0.0), textureSize - vec2f(1.0)));
  let depthValue = textureLoad(depthTexture, sampleCoord, 0);
  let depthColor = vec3f(1.0 - depthValue, 0.72 - depthValue * 0.22, depthValue * 0.92);
  let stencilPreview = vec3f(0.10, 0.18, 0.27) + vec3f(panelUv.x, panelUv.y, 1.0 - panelUv.x) * 0.35;
  let grid = step(0.975, fract(panelUv.x * 10.0)) + step(0.975, fract(panelUv.y * 6.0));
  let color = select(depthColor, stencilPreview, panel > 0.5) + grid * 0.12;
  return vec4f(color, 1.0);
}
