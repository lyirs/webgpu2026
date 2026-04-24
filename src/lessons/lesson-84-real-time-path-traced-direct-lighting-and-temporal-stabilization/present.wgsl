struct PresentUniforms {
  displaySize: vec2f,
  sourceSize: vec2f,
};

@group(0) @binding(0) var<uniform> presentUniforms: PresentUniforms;
@group(0) @binding(1) var<storage, read> currentBuffer: array<vec4f>;
@group(0) @binding(2) var<storage, read> naiveBuffer: array<vec4f>;
@group(0) @binding(3) var<storage, read> stabilizedBuffer: array<vec4f>;

fn panelInfo(uv: vec2f) -> vec3f {
  let scaled = uv.x * 3.0;
  return vec3f(floor(scaled), fract(scaled), uv.y);
}

fn fetchColor(bufferIndex: i32, uv: vec2f) -> vec3f {
  let x = u32(clamp(floor(uv.x * presentUniforms.sourceSize.x), 0.0, presentUniforms.sourceSize.x - 1.0));
  let y = u32(clamp(floor(uv.y * presentUniforms.sourceSize.y), 0.0, presentUniforms.sourceSize.y - 1.0));
  let index = y * u32(presentUniforms.sourceSize.x) + x;
  if (bufferIndex == 0) {
    return currentBuffer[index].xyz;
  }
  if (bufferIndex == 1) {
    return naiveBuffer[index].xyz;
  }
  return stabilizedBuffer[index].xyz;
}

@vertex
fn vsFullscreen(@builtin(vertex_index) vertexIndex: u32) -> @builtin(position) vec4f {
  let x = f32((vertexIndex << 1u) & 2u);
  let y = f32(vertexIndex & 2u);
  return vec4f(x * 2.0 - 1.0, 1.0 - y * 2.0, 0.0, 1.0);
}

@fragment
fn fsPresent(@builtin(position) position: vec4f) -> @location(0) vec4f {
  let uv = position.xy / presentUniforms.displaySize;
  let panel = panelInfo(uv);
  let localUv = panel.yz;
  let panelIndex = i32(panel.x);
  let color = fetchColor(panelIndex, localUv);
  let dividerA = smoothstep(0.002, 0.0, abs(uv.x - 1.0 / 3.0));
  let dividerB = smoothstep(0.002, 0.0, abs(uv.x - 2.0 / 3.0));
  let tinted = mix(color, vec3f(1.0, 0.72, 0.46), clamp(dividerA + dividerB, 0.0, 1.0) * 0.55);
  return vec4f(clamp(tinted / 1.8, vec3f(0.0), vec3f(1.0)), 1.0);
}
