struct PresentUniforms {
  panelInfo: vec4f,
};

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
};

struct OccluderData {
  rect: vec4f,
  extras: vec4f,
};

@group(0) @binding(0) var<uniform> presentUniforms: PresentUniforms;
@group(0) @binding(1) var<storage, read> occluders: array<OccluderData>;
@group(0) @binding(2) var<storage, read> naiveValues: array<vec4f>;
@group(0) @binding(3) var<storage, read> restirValues: array<vec4f>;

fn gridWidth() -> u32 { return u32(presentUniforms.panelInfo.z); }
fn gridHeight() -> u32 { return u32(presentUniforms.panelInfo.w); }

fn heatmap(value: f32) -> vec3f {
  let t = clamp(value * 0.18, 0.0, 1.0);
  let shadows = vec3f(0.09, 0.11, 0.17);
  let mids = vec3f(0.48, 0.40, 0.30);
  let highlights = vec3f(1.0, 0.75, 0.42);
  let base = mix(shadows, mids, smoothstep(0.0, 0.55, t));
  return mix(base, highlights, smoothstep(0.42, 1.0, t));
}

fn readPanelValue(panelIndex: u32, gridCoord: vec2u) -> f32 {
  let index = gridCoord.y * gridWidth() + gridCoord.x;
  if (panelIndex == 0u) {
    return naiveValues[index].x;
  }
  return restirValues[index].x;
}

fn occluderTint(index: u32) -> vec3f {
  if (index == 0u) {
    return vec3f(0.22, 0.38, 0.43);
  }
  if (index == 1u) {
    return vec3f(0.42, 0.20, 0.22);
  }
  return vec3f(0.24, 0.30, 0.48);
}

fn drawOccluderBody(panelUv: vec2f, value: f32) -> vec4f {
  var body = vec4f(0.0);
  for (var index = 0u; index < 3u; index += 1u) {
    let rect = occluders[index].rect;
    let withinX = panelUv.x >= rect.x && panelUv.x <= rect.x + rect.z;
    let withinY = panelUv.y >= rect.y && panelUv.y <= rect.y + rect.w;
    if (withinX && withinY) {
      let localY = clamp((panelUv.y - rect.y) / max(rect.w, 1e-4), 0.0, 1.0);
      let lit = clamp(value * 0.08, 0.0, 0.85);
      let material = occluderTint(index) * (0.42 + localY * 0.18 + lit * 0.35);
      body = vec4f(material, 0.72);
    }
  }
  return body;
}

fn drawOccluderLines(panelUv: vec2f) -> f32 {
  var edge = 0.0;
  for (var index = 0u; index < 3u; index += 1u) {
    let rect = occluders[index].rect;
    let withinX = panelUv.x >= rect.x && panelUv.x <= rect.x + rect.z;
    let withinY = panelUv.y >= rect.y && panelUv.y <= rect.y + rect.w;
    let left = abs(panelUv.x - rect.x);
    let right = abs(panelUv.x - (rect.x + rect.z));
    let top = abs(panelUv.y - rect.y);
    let bottom = abs(panelUv.y - (rect.y + rect.w));
    if (withinX && min(top, bottom) < 0.003) {
      edge = max(edge, 1.0);
    }
    if (withinY && min(left, right) < 0.003) {
      edge = max(edge, 1.0);
    }
  }
  return edge;
}

@vertex
fn vsFullscreen(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
  let x = f32((vertexIndex << 1u) & 2u);
  let y = f32(vertexIndex & 2u);
  var output: VertexOutput;
  output.position = vec4f(x * 2.0 - 1.0, 1.0 - y * 2.0, 0.0, 1.0);
  output.uv = vec2f(x, y);
  return output;
}

@fragment
fn fsPresent(input: VertexOutput) -> @location(0) vec4f {
  let panelScaled = input.uv.x * 2.0;
  let panelIndex = select(0u, 1u, panelScaled >= 1.0);
  let panelUv = vec2f(fract(panelScaled), input.uv.y);

  let gridCoord = vec2u(
    min(u32(panelUv.x * f32(gridWidth())), gridWidth() - 1u),
    min(u32(panelUv.y * f32(gridHeight())), gridHeight() - 1u)
  );
  let value = readPanelValue(panelIndex, gridCoord);
  var color = heatmap(value);

  let cellUv = fract(vec2f(panelUv.x * f32(gridWidth()), panelUv.y * f32(gridHeight())));
  let gridLine = smoothstep(0.0, 0.08, min(min(cellUv.x, 1.0 - cellUv.x), min(cellUv.y, 1.0 - cellUv.y)));
  color *= mix(0.78, 1.0, gridLine);

  let occluderBody = drawOccluderBody(panelUv, value);
  color = mix(color, occluderBody.rgb, occluderBody.a);

  let occluderLine = drawOccluderLines(panelUv);
  color = mix(color, vec3f(0.82, 0.88, 0.9), occluderLine * 0.42);

  let divider = 1.0 - smoothstep(0.0, 0.004, abs(input.uv.x - 0.5));
  color = mix(color, vec3f(1.0, 0.72, 0.45), divider * 0.95);
  return vec4f(color, 1.0);
}
